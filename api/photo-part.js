// Vercel Serverless Function - a course ID photo bigger than 4 MB, in parts.
//
// The browser uploads the photo through caspianobesity.com/sbx (a rewrite to
// Supabase), because some Indian networks block supabase.co. Vercel caps one
// request at about 4.5 MB, so a photo over 4 MB (the page allows up to 6 MB)
// is sent here as raw 4 MB parts, one request each, in order:
//   POST /api/photo-part?app=<application id>&n=<0..of-1>&of=<2>&type=image/jpeg
// Each part is kept in applicant-photos/_parts/<app>/<n>; when the last part
// arrives they are joined byte for byte into applicant-photos/<app>.jpg (the
// same path /api/profile signs) and the parts are removed. Nothing is
// recompressed. Only a paid or submitted application that asked for a photo
// slot (photo_path set by /api/profile) is accepted.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const PART = 4 * 1024 * 1024, MAX = 6 * 1024 * 1024;

const auth = (extra) => Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }, extra || {});

async function rawBody(req, limit) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new Error("too big"); chunks.push(c); }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ ok: false, error: "Not available right now." });
  const q = req.query || {};
  const app = String(q.app || ""), n = Number(q.n), of = Number(q.of), type = String(q.type || "");
  if (!UUID.test(app) || !Number.isInteger(n) || !Number.isInteger(of) || of < 2 || of > Math.ceil(MAX / PART) || n < 0 || n >= of || !TYPES.includes(type))
    return res.status(400).json({ ok: false, error: "Bad request." });
  try {
    const look = await fetch(`${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(app)}&select=id,status,photo_path`, { headers: auth() });
    const rows = look.ok ? await look.json() : [];
    const row = Array.isArray(rows) && rows[0];
    if (!row || (row.status !== "paid" && row.status !== "submitted") || row.photo_path !== `applicant-photos/${app}.jpg`)
      return res.status(404).json({ ok: false, error: "Application not found." });

    const body = await rawBody(req, PART);
    if (!body.length || (n < of - 1 && body.length !== PART)) return res.status(400).json({ ok: false, error: "Bad part." });
    const partPath = (i) => `applicant-photos/_parts/${app}/${i}`;
    const put = await fetch(`${SB_URL}/storage/v1/object/${partPath(n)}`, {
      method: "POST", headers: auth({ "Content-Type": type, "x-upsert": "true" }), body,
    });
    if (!put.ok) return res.status(502).json({ ok: false, error: "Could not store the part." });
    if (n < of - 1) return res.status(200).json({ ok: true, part: n });

    const bufs = [];
    for (let i = 0; i < of; i++) {
      const r = await fetch(`${SB_URL}/storage/v1/object/authenticated/${partPath(i)}`, { headers: auth(), cache: "no-store" });
      if (!r.ok) return res.status(400).json({ ok: false, error: "A part is missing. Please choose the photo again." });
      bufs.push(Buffer.from(await r.arrayBuffer()));
    }
    const whole = Buffer.concat(bufs);
    if (whole.length > MAX) return res.status(400).json({ ok: false, error: "Please choose an image under 6 MB." });
    const up = await fetch(`${SB_URL}/storage/v1/object/applicant-photos/${app}.jpg`, {
      method: "POST", headers: auth({ "Content-Type": type, "x-upsert": "true" }), body: whole,
    });
    if (!up.ok) return res.status(502).json({ ok: false, error: "Could not save the photo." });
    await fetch(`${SB_URL}/storage/v1/object/applicant-photos`, {
      method: "DELETE", headers: auth({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: Array.from({ length: of }, (_, i) => `_parts/${app}/${i}`) }),
    }).catch(() => {});
    return res.status(200).json({ ok: true, size: whole.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Could not save the photo." });
  }
}
