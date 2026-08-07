// Vercel Serverless Function - creates a Razorpay order.
// Secrets are read from environment variables (never hardcoded, never sent to the browser).
//
// Pricing is decided ON THE SERVER. The browser may send an optional { promo } code,
// but never the price - this prevents anyone paying an amount they chose themselves.
//
// Promo codes are stored in Supabase and are SINGLE-USE: a code that has already been
// redeemed is rejected here. (The code is actually marked "used" only when payment
// succeeds - see verify-payment.js - or when a free seat is confirmed - see redeem-free.js.)
//
// Env vars:
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   (required for payments)
//   FOUNDING_FEE_PAISE                      base price in paise (default 299900 = Rs 2,999)
//   SUPABASE_URL, SUPABASE_SERVICE_KEY      (required for promo codes)
import Razorpay from "razorpay";

const MIN_PAISE = 100;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
}
async function sbLookup(code) {
  const url = `${SB_URL}/rest/v1/promo_codes?select=code,type,value,label,used&code=eq.${encodeURIComponent(code)}`;
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
function applyPromo(basePaise, def) {
  const type = String(def.type || "").toLowerCase();
  if (type === "free") return { amount: 0, free: true };
  if (type === "percent") {
    const pct = Math.max(0, Math.min(100, Number(def.value) || 0));
    if (pct >= 100) return { amount: 0, free: true };
    return { amount: Math.max(MIN_PAISE, Math.round(basePaise * (1 - pct / 100))), free: false };
  }
  if (type === "flat") {
    const off = Math.max(0, Math.round((Number(def.value) || 0) * 100));
    const amt = basePaise - off;
    if (amt <= 0) return { amount: 0, free: true };
    return { amount: Math.max(MIN_PAISE, amt), free: false };
  }
  return { amount: basePaise, free: false };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Payment is not configured on the server." });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const basePaise = Math.max(MIN_PAISE, Math.round(Number(process.env.FOUNDING_FEE_PAISE) || 299900));
    const currency = body.currency || "INR";
    const receipt = body.receipt || "caspian_" + Date.now();

    const codeRaw = (body.promo || "").toString().trim().toUpperCase();
    let promoInfo = { code: codeRaw || null, applied: false, label: null };
    let amount = basePaise;
    let free = false;

    if (codeRaw) {
      if (!SB_URL || !SB_KEY) {
        promoInfo = { code: codeRaw, applied: false, error: "Promo codes aren't available right now" };
      } else {
        const row = await sbLookup(codeRaw);
        if (!row) {
          promoInfo = { code: codeRaw, applied: false, error: "Invalid code" };
        } else if (row.used) {
          promoInfo = { code: codeRaw, applied: false, error: "This code has already been used" };
        } else {
          const r = applyPromo(basePaise, row);
          amount = r.amount;
          free = r.free;
          promoInfo = { code: row.code, applied: true, label: row.label || "Discount applied", free };
        }
      }
    }

    // Free seat - no Razorpay order; the code is claimed in redeem-free.js when the seat is confirmed.
    if (free) {
      return res.status(200).json({ free: true, base: basePaise, amount: 0, currency, promo: promoInfo });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount, currency, receipt,
      notes: { promo: promoInfo.applied ? promoInfo.code : "" },
    });

    return res.status(200).json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId, base: basePaise, promo: promoInfo,
    });
  } catch (err) {
    const status = err && err.statusCode === 401 ? 401 : 500;
    return res.status(status).json({ error: "Could not create the payment order." });
  }
}
