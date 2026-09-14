// Vercel Serverless Function - private Batch 2 intent feed for /list.
// POST { key } -> { rows } when key matches ADMIN_KEY (constant-time compare).
//
// The public /next form writes with the anon key under an INSERT-only RLS
// policy, so nothing can read the list back from the browser. This route is
// the only way to read it, and it needs the same passcode as /admin.
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
    return res.status(503).json({ error: "List access is not configured yet. Add an ADMIN_KEY environment variable in Vercel, then redeploy." });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!safeEqual(body.key, ADMIN_KEY)) {
    await new Promise((r) => setTimeout(r, 900)); // slow brute force
    return res.status(401).json({ error: "Wrong passcode." });
  }
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });

  const headers = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };

  try {
    if (body.action === "status" && body.id) {
      const status = String(body.status || "new").slice(0, 20);
      const r = await fetch(`${SB_URL}/rest/v1/waitlist?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ status })
      });
      return res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    }

    const cols = "id,created_at,name,phone,email,city,mode,timing,source,status";
    const r = await fetch(
      `${SB_URL}/rest/v1/waitlist?select=${cols}&order=created_at.desc&limit=5000`,
      { headers }
    );
    if (!r.ok) return res.status(500).json({ error: "Could not load the list." });
    const rows = await r.json();
    return res.status(200).json({ rows });
  } catch {
    return res.status(500).json({ error: "Could not load the list." });
  }
}
