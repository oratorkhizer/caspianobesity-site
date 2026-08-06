// Vercel Serverless Function — verifies a Razorpay payment signature.
// Marks a payment as genuine only when the HMAC signature matches.
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ error: "Payment is not configured on the server." });
  }

  const body =
    typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
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
    match = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(String(razorpay_signature))
    );
  } catch {
    match = false; // length mismatch etc.
  }

  if (!match) {
    return res.status(400).json({ verified: false });
  }

  // Signature is valid. In a fuller build you'd persist the successful payment here.
  return res.status(200).json({ verified: true, paymentId: razorpay_payment_id });
}
