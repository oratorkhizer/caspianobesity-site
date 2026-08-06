// Vercel Serverless Function — creates a Razorpay order.
// Secrets are read from environment variables (never hardcoded, never sent to the browser).
import Razorpay from "razorpay";

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
    // Vercel parses JSON bodies automatically; fall back just in case.
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const amount = Math.round(Number(body.amount));
    const currency = body.currency || "INR";
    const receipt = body.receipt || "caspian_" + Date.now();

    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).json({ error: "Amount must be at least 100 paise." });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({ amount, currency, receipt });

    // key_id is the publishable key — safe to return for the checkout modal.
    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    const status = err && err.statusCode === 401 ? 401 : 500;
    return res.status(status).json({ error: "Could not create the payment order." });
  }
}
