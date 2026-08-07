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

async function notifySeat(appId, paymentId, promo, order) {
  // Email the course team for every confirmed seat. Best-effort: never throws,
  // never blocks payment verification.
  try {
    let app = null;
    if (SB_URL && SB_KEY && appId) {
      const r = await fetch(
        `${SB_URL}/rest/v1/applications?id=eq.${encodeURIComponent(appId)}&select=salutation,full_name,email,phone,city,specialty,qualification,dietary`,
        { headers: sbHeaders() }
      );
      if (r.ok) {
        const rows = await r.json();
        app = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    }
    let paid = null;
    if (SB_URL && SB_KEY) {
      const r = await fetch(`${SB_URL}/rest/v1/applications?select=id&status=eq.paid`, {
        headers: Object.assign(sbHeaders(), { Prefer: "count=exact", Range: "0-0" }),
      });
      const cr = r.headers.get("content-range");
      const n = cr && cr.includes("/") ? parseInt(cr.split("/")[1], 10) : NaN;
      if (Number.isFinite(n)) paid = n;
    }
    const name = app ? ((app.salutation ? app.salutation + " " : "") + (app.full_name || "")).trim() : "(details not on file)";
    const amount = order && order.amount ? "Rs " + (order.amount / 100).toLocaleString("en-IN") : "";
    await fetch("https://formsubmit.co/ajax/drkhizer@caspianobesity.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: "PAID seat" + (paid ? " #" + paid : "") + " — " + name + " — CASPIAN founding batch",
        _template: "table",
        seats: paid ? paid + " of 40 founding seats now paid" : "(count unavailable)",
        name: name,
        city: (app && app.city) || "",
        specialty: (app && app.specialty) || "",
        qualification: (app && app.qualification) || "",
        phone: (app && app.phone) || "",
        email: (app && app.email) || "",
        meal: (app && app.dietary) || "",
        amount_paid: amount,
        promo_code: promo || "none",
        payment_id: paymentId || "",
        where_next: "Full record: caspianobesity.com/admin · Payment: Razorpay dashboard",
      }),
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
      await notifySeat(appId ? String(appId) : null, razorpay_payment_id, code ? String(code) : null, order);
    }
  } catch {
    /* never fail verification because of promo bookkeeping */
  }

  return res.status(200).json({ verified: true, paymentId: razorpay_payment_id });
}
