// Vercel Serverless Function — creates a Razorpay order.
// Secrets are read from environment variables (never hardcoded, never sent to the browser).
//
// Pricing is decided ON THE SERVER. The browser may send an optional { promo } code,
// but never the price — this prevents anyone from paying an amount they chose themselves.
//
// Optional env vars:
//   FOUNDING_FEE_PAISE   base price in paise (default 299900 = ₹2,999)
//   PROMO_CODES          JSON map of codes, e.g.
//     {"WELCOME20":{"type":"percent","value":20,"label":"20% off"},
//      "FRIEND500":{"type":"flat","value":500,"label":"₹500 off"},
//      "FACULTY100":{"type":"free","label":"Complimentary seat"}}
//     type "percent" -> value is a percentage; "flat" -> value is rupees off;
//     "free" -> 100% off (no payment; seat confirmed on enrolment).
import Razorpay from "razorpay";

const MIN_PAISE = 100; // Razorpay minimum chargeable amount

function loadPromos() {
  try {
    const raw = process.env.PROMO_CODES;
    if (!raw) return {};
    const obj = JSON.parse(raw);
    // normalise keys to upper-case
    const out = {};
    for (const k of Object.keys(obj)) out[k.trim().toUpperCase()] = obj[k];
    return out;
  } catch {
    return {};
  }
}

function applyPromo(basePaise, promoDef) {
  // returns { amount, free }
  if (!promoDef || typeof promoDef !== "object") return { amount: basePaise, free: false };
  const type = String(promoDef.type || "").toLowerCase();
  if (type === "free") return { amount: 0, free: true };
  if (type === "percent") {
    const pct = Math.max(0, Math.min(100, Number(promoDef.value) || 0));
    if (pct >= 100) return { amount: 0, free: true };
    return { amount: Math.max(MIN_PAISE, Math.round(basePaise * (1 - pct / 100))), free: false };
  }
  if (type === "flat") {
    const offPaise = Math.max(0, Math.round((Number(promoDef.value) || 0) * 100));
    const amt = basePaise - offPaise;
    if (amt <= 0) return { amount: 0, free: true };
    return { amount: Math.max(MIN_PAISE, amt), free: false };
  }
  return { amount: basePaise, free: false };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Payment is not configured on the server." });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const basePaise = Math.max(
      MIN_PAISE,
      Math.round(Number(process.env.FOUNDING_FEE_PAISE) || 299900)
    );
    const currency = body.currency || "INR";
    const receipt = body.receipt || "caspian_" + Date.now();

    // Resolve promo code (server-side; the browser never sets the price).
    const promos = loadPromos();
    const codeRaw = (body.promo || "").toString().trim().toUpperCase();
    let promoInfo = { code: codeRaw || null, applied: false, label: null };
    let amount = basePaise;
    let free = false;

    if (codeRaw) {
      const def = promos[codeRaw];
      if (def) {
        const r = applyPromo(basePaise, def);
        amount = r.amount;
        free = r.free;
        promoInfo = { code: codeRaw, applied: true, label: def.label || "Discount applied", free };
      } else {
        promoInfo = { code: codeRaw, applied: false, label: null, error: "Invalid or expired code" };
      }
    }

    // Free seat — no Razorpay order; the client captures enrolment details.
    if (free) {
      return res.status(200).json({
        free: true,
        base: basePaise,
        amount: 0,
        currency,
        promo: promoInfo,
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({ amount, currency, receipt });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      base: basePaise,
      promo: promoInfo,
    });
  } catch (err) {
    const status = err && err.statusCode === 401 ? 401 : 500;
    return res.status(status).json({ error: "Could not create the payment order." });
  }
}
