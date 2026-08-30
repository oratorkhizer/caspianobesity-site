// Vercel Serverless Function - public enrolment counter for the founding batch.
// Returns ONLY an aggregate: { taken }. No personal data leaves the database.
//
// There is no seat cap. The hall holds 100 and every doctor who enrols is taken,
// so the homepage shows how many have joined rather than how many are left.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  if (!SB_URL || !SB_KEY) return res.status(200).json({});
  try {
    const r = await fetch(`${SB_URL}/rest/v1/applications?select=id&status=eq.paid`, {
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    const cr = r.headers.get("content-range"); // e.g. "0-0/3"
    const total = cr && cr.includes("/") ? parseInt(cr.split("/")[1], 10) : NaN;
    if (!Number.isFinite(total)) return res.status(200).json({});
    return res.status(200).json({ taken: total });
  } catch {
    return res.status(200).json({});
  }
}
