// Vercel Serverless Function - completes an application AFTER payment.
//
// The application form used to ask for a passport photo and a five-question
// goals survey before the doctor could pay (steps 4 and 5 of 6). Both now live
// on /thanks, after the seat is reserved. This route saves those answers on to
// the existing application row and hands back a signed URL for the photo.
//
// The application id is a UUID that only the applicant's browser was given; it
// is the only key needed. Only the fields listed below can be written, and only
// on a row that is already paid or submitted, so a stray id cannot be used to
// touch anything that matters.
//
// POST { appId }                      -> { ok, name, hasPhoto, answered }
// POST { appId, ...answers, photo:1 } -> { ok, uploadUrl }
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sbHeaders(extra) {
  return Object.assign(
    { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    extra || {}
  );
}
function str(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}
function bool(v) { return v === true || v === "true" || v === "on" || v === 1; }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Not available right now." });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const appId = str(b.appId, 40);
    if (!appId || !UUID.test(appId)) return res.status(400).json({ error: "Missing application id." });

    const look = await fetch(
      `${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}` +
        `&select=id,status,salutation,full_name,photo_path,why_enrolling,runs_service,patient_volume,prior_training,topics_interest,hear_about`,
      { headers: sbHeaders() }
    );
    if (!look.ok) return res.status(500).json({ error: "Could not read the application." });
    const rows = await look.json();
    const app = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!app || (app.status !== "paid" && app.status !== "submitted")) {
      return res.status(404).json({ error: "Application not found." });
    }

    const name = ((app.salutation ? app.salutation + " " : "") + (app.full_name || "")).trim();
    const answered = !!(app.why_enrolling || app.runs_service || app.patient_volume || app.prior_training || app.topics_interest || app.hear_about);

    // Read-only call: the page uses it to greet the doctor and to skip what is done.
    const hasAnswers = ["why_enrolling", "runs_service", "patient_volume", "prior_training", "topics_interest", "hear_about", "consent_photo", "photo"]
      .some((k) => b[k] !== undefined);
    if (!hasAnswers) {
      return res.status(200).json({ ok: true, name, hasPhoto: !!app.photo_path, answered });
    }

    const patch = {};
    if (b.why_enrolling !== undefined) patch.why_enrolling = str(b.why_enrolling, 1000);
    if (b.runs_service !== undefined) patch.runs_service = str(b.runs_service, 40);
    if (b.patient_volume !== undefined) patch.patient_volume = str(b.patient_volume, 40);
    if (b.prior_training !== undefined) patch.prior_training = str(b.prior_training, 40);
    if (b.topics_interest !== undefined) patch.topics_interest = str(b.topics_interest, 400);
    if (b.hear_about !== undefined) patch.hear_about = str(b.hear_about, 120);
    if (b.consent_photo !== undefined) patch.consent_photo = bool(b.consent_photo);

    if (Object.keys(patch).length) {
      const upd = await fetch(`${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}`, {
        method: "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify(patch),
      });
      if (!upd.ok) return res.status(500).json({ error: "Could not save your answers." });
    }

    // Signed upload URL for the photo, only when the browser says it has one.
    // NB: no Content-Type header on this call - an empty JSON body makes storage reject it.
    let uploadUrl = null;
    if (bool(b.photo)) {
      const photoPath = `${appId}.jpg`;
      try {
        const sign = await fetch(
          `${SB_URL}/storage/v1/object/upload/sign/applicant-photos/${photoPath}`,
          { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
        );
        if (sign.ok) {
          const j = await sign.json();
          if (j && j.url) {
            uploadUrl = `${SB_URL}/storage/v1${j.url}`;
            await fetch(`${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}`, {
              method: "PATCH",
              headers: sbHeaders(),
              body: JSON.stringify({ photo_path: `applicant-photos/${photoPath}` }),
            });
          }
        }
      } catch {
        /* the photo is optional; never fail the answers because of it */
      }
    }

    return res.status(200).json({ ok: true, uploadUrl });
  } catch (err) {
    return res.status(500).json({ error: "Could not save." });
  }
}
