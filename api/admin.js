// Vercel Serverless Function - private applications dashboard feed.
// POST { key } -> { counts, apps, promos } when key matches ADMIN_KEY (constant-time).
// Returns an OPERATIONAL subset only (no DOB, no addresses, no registration numbers,
// no photos) - the full record stays in Supabase.
//
// Env vars: ADMIN_KEY (set this in Vercel to enable /admin), SUPABASE_URL, SUPABASE_SERVICE_KEY
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
    return res.status(503).json({ error: "Admin access is not configured yet. Add an ADMIN_KEY environment variable in Vercel (Project Settings → Environment Variables), then redeploy." });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!safeEqual(body.key, ADMIN_KEY)) {
    await new Promise((r) => setTimeout(r, 900)); // slow brute force
    return res.status(401).json({ error: "Wrong passcode." });
  }
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });

  const h = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };
  try {
    const appsR = await fetch(
      `${SB_URL}/rest/v1/applications?select=created_at,salutation,full_name,email,phone,city,specialty,qualification,years_practice,dietary,status,promo_code,payment_id,hear_about&order=created_at.desc&limit=300`,
      { headers: h }
    );
    const apps = appsR.ok ? await appsR.json() : [];
    const promosR = await fetch(
      `${SB_URL}/rest/v1/promo_codes?select=code,type,value,label,used,used_at,used_by_email&order=code.asc`,
      { headers: h }
    );
    const promos = promosR.ok ? await promosR.json() : [];
    const counts = { total: apps.length, paid: 0, submitted: 0, other: 0 };
    apps.forEach((a) => {
      if (a.status === "paid") counts.paid++;
      else if (a.status === "submitted") counts.submitted++;
      else counts.other++;
    });
    return res.status(200).json({ counts, apps, promos });
  } catch {
    return res.status(500).json({ error: "Could not load the data." });
  }
}
