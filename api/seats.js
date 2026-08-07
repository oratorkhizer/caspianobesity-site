// Vercel Serverless Function - public seat counter for the founding batch.
// Returns ONLY an aggregate: { cap, taken }. No personal data leaves the database.
// The homepage shows real numbers once enough seats are taken (client-side threshold).
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, optional SEAT_CAP (default 40)
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  const cap = Math.max(1, parseInt(process.env.SEAT_CAP, 10) || 40);
  if (!SB_URL || !SB_KEY) return res.status(200).json({ cap });
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
    if (!Number.isFinite(total)) return res.status(200).json({ cap });
    return res.status(200).json({ cap, taken: total });
  } catch {
    return res.status(200).json({ cap });
  }
}
