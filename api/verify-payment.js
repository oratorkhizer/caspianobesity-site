// Vercel Serverless Function - verifies a Razorpay payment signature.
// Marks a payment as genuine only when the HMAC signature matches, then (if the order
// carried a promo code) marks that code as USED so it can never be redeemed again.
import crypto from "crypto";
import Razorpay from "razorpay";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  return { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };
}
async function claimPromo(code, order, email) {
  if (!SB_URL || !SB_KEY || !code) return;
  try {
    const url = `${SB_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&used=is.false`;
    await fetch(url, {
      method: "PATCH",
      headers: Object.assign(sbHeaders(), { Prefer: "return=representation" }),
      body: JSON.stringify({
        used: true, used_at: new Date().toISOString(),
        used_by_order: order || null, used_by_email: email || null,
      }),
    });
  } catch {
    /* best-effort; never block a genuine payment on this */
  }
}
async function markApplicationPaid(appId, paymentId, code) {
  if (!SB_URL || !SB_KEY || !appId) return;
  try {
    await fetch(`${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}`, {
      method: "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ status: "paid", payment_id: paymentId || null, promo_code: code || null }),
    });
  } catch {
    /* best-effort */
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return res.status(500).json({ error: "Payment is not configured on the server." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: "Missing fields" });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
  } catch {
    match = false;
  }
  if (!match) return res.status(400).json({ verified: false });

  // Signature valid. If the order used a promo code, mark it used (single-use enforcement).
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (SB_URL && SB_KEY && keyId) {
      const rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await rz.orders.fetch(razorpay_order_id);
      const code = order && order.notes && order.notes.promo;
      const appId = order && order.notes && order.notes.appId;
      if (code) await claimPromo(String(code), razorpay_payment_id, null);
      if (appId) await markApplicationPaid(String(appId), razorpay_payment_id, code ? String(code) : null);
    }
  } catch {
    /* never fail verification because of promo bookkeeping */
  }

  return res.status(200).json({ verified: true, paymentId: razorpay_payment_id });
}
