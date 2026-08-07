// Vercel Serverless Function - confirms a COMPLIMENTARY (free) seat.
// A free promo code grants a seat with no payment, so the code must be claimed here,
// atomically and once. Returns { ok:true } only if THIS request claimed the code.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(extra) {
  return Object.assign(
    { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    extra || {}
  );
}
async function sbLookup(code) {
  const url = `${SB_URL}/rest/v1/promo_codes?select=code,type,label,used&code=eq.${encodeURIComponent(code)}`;
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
async function sbClaim(code, email) {
  const url = `${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&used=is.false`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=representation" }),
    body: JSON.stringify({
      used: true, used_at: new Date().toISOString(),
      used_by_order: "free", used_by_email: email || null,
    }),
  });
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ ok: false, error: "Promo codes aren't available right now" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const code = (body.promo || "").toString().trim().toUpperCase();
  const email = (body.email || "").toString().trim() || null;
  const appId = (body.appId || "").toString().trim() || null;
  if (!code) return res.status(400).json({ ok: false, error: "No code provided" });

  const row = await sbLookup(code);
  if (!row || String(row.type).toLowerCase() !== "free") {
    return res.status(200).json({ ok: false, error: "Invalid code" });
  }
  if (row.used) return res.status(200).json({ ok: false, error: "This code has already been used" });

  const claimed = await sbClaim(code, email);
  if (!claimed) return res.status(200).json({ ok: false, error: "This code has already been used" });

  // Mark the linked application as enrolled via a complimentary seat.
  if (appId) {
    try {
      await fetch(`${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}`, {
        method: "PATCH", headers: sbHeaders(),
        body: JSON.stringify({ status: "paid", payment_id: "free", promo_code: code }),
      });
    } catch { /* best-effort */ }
  }

  return res.status(200).json({ ok: true, label: row.label || "Complimentary seat" });
}
