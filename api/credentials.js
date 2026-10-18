// Vercel Serverless Function - certificates, Kahoot top scorers and alumnus
// referral codes. One route on purpose, to keep the function count low.
//
// PUBLIC
//   GET  /api/credentials?id=CASP-OM-2027-0002   -> verify one certificate
//   POST { action:"myref", appId }                -> the doctor's own referral code
//   POST { action:"myref", phone, email }         -> same, looked up by mobile + email
//
// ADMIN (same ADMIN_KEY passcode as /admin)
//   POST { key, action:"list" }                   -> certificates, top scorers, codes, roster
//   POST { key, action:"issue", application_id, exam_score?, distinction?, issued_on? }
//   POST { key, action:"revoke", cert_id, revoked, reason? }
//   POST { key, action:"top", module_no, application_id, batch_no?, remove? }
//
// Tables certificates, kahoot_top_scorers and referral_codes have RLS on and no
// policies, so only this route (service key) can read or write them.
//
// Env vars: ADMIN_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CERT_ID = /^CASP-OM-\d{4}-\d{4}$/;
const COURSE = "CASPIAN Certificate in Obesity Medicine";
const ISSUER = "Caspian Healthcare Foundation, Hyderabad";

function safeEqual(a, b) {
  try {
    const A = Buffer.from(String(a || ""));
    const B = Buffer.from(String(b || ""));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}
function sb(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}
async function rpc(fn, args) {
  const r = await sb(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && (j.message || j.hint)) || "Database error.";
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }
  return j;
}
function digits(v) {
  return String(v || "").replace(/\D/g, "").slice(-10);
}
function firstName(full) {
  return String(full || "").replace(/^\s*dr\.?\s+/i, "").trim().split(/\s+/)[0] || "";
}

// ---------- public: verify ----------
async function verify(id, res) {
  if (!CERT_ID.test(id)) return res.status(404).json({ found: false });
  const r = await sb(
    `certificates?cert_id=eq.${encodeURIComponent(id)}&select=cert_id,application_id,full_name,qualification,issued_on,distinction,modules_attended,revoked`
  );
  const rows = r.ok ? await r.json() : [];
  const c = rows[0];
  if (!c) return res.status(404).json({ found: false });
  const t = await sb(
    `kahoot_top_scorers?application_id=eq.${c.application_id}&select=module_no,batch_no&order=module_no.asc`
  );
  const tops = t.ok ? await t.json() : [];
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    found: true,
    id: c.cert_id,
    name: c.full_name,
    qualification: c.qualification || null,
    course: COURSE,
    issued: c.issued_on,
    result: c.distinction ? "Pass with Distinction" : "Pass",
    distinction: !!c.distinction,
    modules_attended: c.modules_attended,
    top_scorer_modules: [...new Set(tops.map((x) => x.module_no))],
    status: c.revoked ? "revoked" : "issued",
    issuer: ISSUER,
  });
}

// ---------- public: a doctor's own referral code ----------
async function myRef(b, res) {
  let app = null;
  const sel = "select=id,salutation,full_name,status,email,phone";
  if (b.appId && UUID.test(String(b.appId))) {
    const r = await sb(`applications?id=eq.${b.appId}&${sel}`);
    app = r.ok ? (await r.json())[0] : null;
  } else {
    const phone = digits(b.phone);
    const email = String(b.email || "").trim();
    if (phone.length !== 10 || !/.+@.+\..+/.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter your 10-digit mobile number and the email you applied with." });
    }
    const r = await sb(`applications?email=ilike.${encodeURIComponent(email)}&status=eq.paid&${sel}`);
    const rows = r.ok ? await r.json() : [];
    app = rows.find((x) => digits(x.phone) === phone) || null;
    if (!app) {
      await new Promise((r2) => setTimeout(r2, 600));
      return res.status(200).json({ ok: false, error: "We could not find an enrolled doctor with that mobile and email. Use the same details you gave when you applied, or WhatsApp +91 89784 54547." });
    }
  }
  if (!app || app.status !== "paid") return res.status(200).json({ ok: false, error: "A referral code is given once your seat is paid." });
  const code = await rpc("ccom_referral_code", { p_app: app.id });
  return res.status(200).json({ ok: true, code, first_name: firstName(app.full_name) });
}

// ---------- admin ----------
async function adminList(res) {
  const [rApps, rCerts, rTops, rCodes, rAtt, rRef] = await Promise.all([
    sb("applications?select=id,salutation,full_name,qualification,phone,email&status=eq.paid&order=full_name.asc"),
    sb("certificates?select=cert_id,application_id,full_name,qualification,issued_on,exam_score,distinction,modules_attended,revoked,revoked_reason&order=cert_id.asc"),
    sb("kahoot_top_scorers?select=batch_no,module_no,application_id,recorded_at&order=batch_no.asc,module_no.asc"),
    sb("referral_codes?select=code,application_id"),
    sb("attendance?select=application_id&present=eq.true"),
    sb("applications?select=referred_by,promo_code,full_name&status=eq.paid&referred_by=not.is.null"),
  ]);
  if (!rApps.ok || !rCerts.ok || !rTops.ok || !rCodes.ok) throw new Error("read failed");
  const roster = await rApps.json();
  const certs = await rCerts.json();
  const tops = await rTops.json();
  let codes = await rCodes.json();
  const att = rAtt.ok ? await rAtt.json() : [];
  const refs = rRef.ok ? await rRef.json() : [];

  // Any enrolled doctor still without a code gets one now.
  const have = new Set(codes.map((c) => c.application_id));
  for (const a of roster) {
    if (!have.has(a.id)) {
      try {
        const code = await rpc("ccom_referral_code", { p_app: a.id });
        if (code) codes.push({ code, application_id: a.id });
      } catch { /* shown as blank; retried on next load */ }
    }
  }
  const codeBy = new Map(codes.map((c) => [c.application_id, c.code]));
  const attBy = new Map();
  for (const m of att) attBy.set(m.application_id, (attBy.get(m.application_id) || 0) + 1);
  // A paid referral: a paid seat whose order carried a REF- code.
  const refBy = new Map();
  for (const r of refs) {
    if (!/^REF-/i.test(String(r.promo_code || ""))) continue;
    if (!refBy.has(r.referred_by)) refBy.set(r.referred_by, []);
    refBy.get(r.referred_by).push(r.full_name);
  }
  for (const a of roster) {
    a.attended = attBy.get(a.id) || 0;
    a.ref_code = codeBy.get(a.id) || null;
    a.paid_referrals = (refBy.get(a.id) || []).length;
    a.referred_names = refBy.get(a.id) || [];
  }
  return res.status(200).json({ roster, certs, tops, rules: { pass: 60, distinction: 75, attendance: 10, modules: 12 } });
}

async function adminIssue(b, res) {
  const app = String(b.application_id || "");
  if (!UUID.test(app)) return res.status(400).json({ error: "Pick a doctor." });
  let score = null;
  if (b.exam_score !== undefined && b.exam_score !== null && String(b.exam_score).trim() !== "") {
    score = Number(b.exam_score);
    if (!Number.isFinite(score) || score < 0 || score > 100) return res.status(400).json({ error: "Score must be a percentage from 0 to 100." });
  }
  let issued = String(b.issued_on || "").trim();
  if (issued && !/^\d{4}-\d{2}-\d{2}$/.test(issued)) return res.status(400).json({ error: "Issue date must be YYYY-MM-DD." });
  if (!issued) issued = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // today in India
  const cert = await rpc("ccom_issue_certificate", {
    p_app: app, p_issued_on: issued, p_distinction: b.distinction === true, p_score: score,
  });
  return res.status(200).json({ ok: true, cert });
}

async function adminRevoke(b, res) {
  const id = String(b.cert_id || "").toUpperCase();
  if (!CERT_ID.test(id)) return res.status(400).json({ error: "Bad certificate ID." });
  const revoked = b.revoked !== false;
  const r = await sb(`certificates?cert_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ revoked, revoked_reason: revoked ? String(b.reason || "").slice(0, 300) || null : null }),
  });
  if (!r.ok) return res.status(500).json({ error: "Could not update the certificate." });
  return res.status(200).json({ ok: true });
}

async function adminTop(b, res) {
  const module_no = Number(b.module_no);
  const batch_no = Number(b.batch_no) || 1;
  const app = String(b.application_id || "");
  if (!(module_no >= 1 && module_no <= 12)) return res.status(400).json({ error: "Module must be 1 to 12." });
  if (!(batch_no >= 1 && batch_no <= 99)) return res.status(400).json({ error: "Bad batch number." });
  if (!UUID.test(app)) return res.status(400).json({ error: "Pick a doctor." });
  if (b.remove) {
    const r = await sb(`kahoot_top_scorers?batch_no=eq.${batch_no}&module_no=eq.${module_no}&application_id=eq.${app}`, { method: "DELETE" });
    if (!r.ok) return res.status(500).json({ error: "Could not remove." });
    return res.status(200).json({ ok: true });
  }
  const r = await sb("kahoot_top_scorers?on_conflict=batch_no,module_no,application_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ batch_no, module_no, application_id: app }),
  });
  if (!r.ok) return res.status(500).json({ error: "Could not save the top scorer." });
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });
  try {
    if (req.method === "GET") {
      const id = String((req.query && req.query.id) || "").trim().toUpperCase().replace(/\s+/g, "");
      return await verify(id, res);
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    if (b.action === "myref") return await myRef(b, res);

    if (!ADMIN_KEY) return res.status(503).json({ error: "Admin access is not configured yet." });
    if (!safeEqual(b.key, ADMIN_KEY)) {
      await new Promise((r) => setTimeout(r, 900)); // slow brute force
      return res.status(401).json({ error: "Wrong passcode." });
    }
    if (b.action === "list") return await adminList(res);
    if (b.action === "issue") return await adminIssue(b, res);
    if (b.action === "revoke") return await adminRevoke(b, res);
    if (b.action === "top") return await adminTop(b, res);
    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(e && e.status ? e.status : 500).json({ error: (e && e.status && e.message) || "Something went wrong." });
  }
}
