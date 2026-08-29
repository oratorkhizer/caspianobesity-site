// Vercel Serverless Function - private session feedback feed for /results.
// POST { key } -> { rows } when key matches ADMIN_KEY (constant-time compare).
//
// The public feedback form writes with the anon key under an INSERT-only RLS
// policy, so nothing can read responses back from the browser. This route is
// the only way to read them, and it needs the same passcode as /admin.
//
// Env vars: ADMIN_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY;

function safeEqual(a, b) {
  try {
    const A = Buffer.from(String(a || ""));
    const B = Buffer.from(String(b || ""));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Results access is not configured yet. Add an ADMIN_KEY environment variable in Vercel, then redeploy." });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!safeEqual(body.key, ADMIN_KEY)) {
    await new Promise((r) => setTimeout(r, 900)); // slow brute force
    return res.status(401).json({ error: "Wrong passcode." });
  }
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });

  const cols = [
    "created_at", "module_no", "role",
    "obj_clear", "relevant", "teaching_clear", "cases_helped",
    "slides_clear", "pace_right", "use_this_week", "venue_ok",
    "most_useful", "improve", "future_topic",
    "nps", "respondent_name", "can_quote"
  ].join(",");

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/feedback?select=${cols}&order=created_at.desc&limit=2000`,
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
    );
    if (!r.ok) return res.status(500).json({ error: "Could not load the feedback." });
    const rows = await r.json();
    return res.status(200).json({ rows });
  } catch {
    return res.status(500).json({ error: "Could not load the feedback." });
  }
}
