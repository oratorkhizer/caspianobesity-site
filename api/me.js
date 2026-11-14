// Vercel Serverless Function - "My course" sign-in for caspianobesity.com/me.
//
// A doctor with an application (paid or submitted, never superseded) signs in
// either with Google or with a 6-digit code sent BY EMAIL to the address on
// their application. Pattern copied from Beta Cell Academy (caspian-cme,
// server/profile-login.ts), adapted to this site's Supabase REST setup.
//
//   GET  /api/me?do=config            -> { enabled, googleClientId }
//   POST /api/me?do=send   {identifier}          -> { ok, sentTo, resendIn }
//   POST /api/me?do=verify {identifier, code}    -> { ok } + session cookie
//   POST /api/me?do=google {credential}          -> { ok } + session cookie
//   GET  /api/me?do=me                           -> the signed-in doctor's course page data
//   POST /api/me?do=signout                      -> revoke this device
//   POST /api/me?do=signout_all                  -> revoke every device of this doctor
//
// Sessions: one row per device in co_sessions. The browser holds a random
// token in an HttpOnly cookie (co_sess); the table keeps only SHA-256(pepper:token).
// Codes: only SHA-256(pepper:appId:code) is kept (co_signin_codes). The resend
// gap, hourly cap and 5 wrong tries are enforced inside Postgres functions so
// parallel requests cannot get round them. Per-IP limits use co_rate_hits.
// Errors and failures are written to co_auth_events for spike alerts.
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY   database (already used by the site)
//   SIGNIN_PEPPER                        secret salt for codes, tokens and IP hashes
//   RESEND_API_KEY                       email
//   RESEND_FROM          optional, default "CASPIAN Course <signin@caspianobesity.com>"
//   RESEND_FROM_FALLBACK optional, default "CASPIAN Course <signin@caspianhealthcare.in>"
//                        used when Resend says the first domain is not verified
//   GOOGLE_CLIENT_ID     Google button is hidden until this is set
//   SIGNIN_ENABLED       "off" turns sign-in off (page shows a note, API answers 503)
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const PEPPER = process.env.SIGNIN_PEPPER || "";

const COOKIE = "co_sess";
const SESSION_DAYS = 180;
const CODE_TTL_SECS = 10 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const REPLY_TO = "drkhizer@caspianobesity.com";

const MSG_NOT_FOUND =
  "We could not find a CASPIAN application with this. Please use the mobile number or email you gave when you applied.";
const MSG_WRONG = "That code is not right, or it has expired. Please check it or ask for a new one.";
const MSG_BUSY = "Too many tries. Please wait a few minutes and try again.";

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function enabled() {
  const v = String(process.env.SIGNIN_ENABLED || "on").trim().toLowerCase();
  return !(v === "off" || v === "false" || v === "0" || v === "no");
}
function googleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}
function text(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function codeHash(appId, code) {
  return sha(`${PEPPER}:code:${appId}:${code}`);
}
function tokenHash(token) {
  return sha(`${PEPPER}:session:${token}`);
}
function ipHash(req) {
  const xf = String(req.headers["x-forwarded-for"] || "");
  const ip = xf.split(",")[0].trim() || String(req.headers["x-real-ip"] || "") || "unknown";
  return sha(`${PEPPER}:ip:${ip}`).slice(0, 32);
}

// 10 digits, from 98480 12345 / 098480... / +91 98480... / 91-98480...
export function normaliseMobile(raw) {
  const d = text(raw).replace(/\D/g, "");
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 13 && d.startsWith("091")) return d.slice(3);
  return "";
}
function cleanEmail(v) {
  const t = text(v).trim().toLowerCase();
  if (!t || t.length > 160 || !EMAIL_RE.test(t)) return null;
  return t;
}
function maskEmail(e) {
  const [user, domain] = String(e || "").split("@");
  if (!user || !domain) return "your email";
  const shown = user.length <= 2 ? user[0] : user.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(3, Math.min(8, user.length - shown.length)))}@${domain}`;
}
function firstName(raw) {
  const c = text(raw).replace(/\s+/g, " ").trim().replace(/^((dr|doctor|prof|professor|mr|mrs|ms)\.?\s+)+/gi, "");
  return (c.split(" ")[0] || "").slice(0, 40);
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function body(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return req.body;
}
function cookieToken(req) {
  const raw = String(req.headers.cookie || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE) {
      const v = decodeURIComponent(part.slice(i + 1).trim());
      return /^[A-Za-z0-9_-]{40,60}$/.test(v) ? v : "";
    }
  }
  return "";
}
function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie",
    `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}
function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
// POSTs that change state must come from this site. Browsers send Origin on
// cross-site POSTs; requests with no Origin (curl, old browsers) are allowed.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    const host = new URL(o).host;
    return host === req.headers.host || host === req.headers["x-forwarded-host"];
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Supabase (PostgREST)
// ---------------------------------------------------------------------------

function sbHeaders(extra) {
  return Object.assign({ apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" }, extra || {});
}
async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`read ${path.split("?")[0]} ${r.status}`);
  return r.json();
}
async function sbRpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: sbHeaders(), body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`rpc ${fn} ${r.status}`);
  return r.json();
}
async function sbPatch(path, patch) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH", headers: sbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`patch ${path.split("?")[0]} ${r.status}`);
}
async function sbInsert(table, row) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST", headers: sbHeaders({ Prefer: "return=minimal" }), body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`insert ${table} ${r.status}`);
}

// Never lets logging break a sign-in.
async function logEvent(kind, ok, detail) {
  try {
    await sbInsert("co_auth_events", { kind, ok, detail: detail ? String(detail).slice(0, 300) : null });
  } catch { /* ignore */ }
}

async function rateOk(req, bucket, limit, windowSecs) {
  try {
    return await sbRpc("co_rate_ok", { p_bucket: bucket, p_ip_hash: ipHash(req), p_limit: limit, p_window_secs: windowSecs });
  } catch {
    return true; // the limiter itself failing must not lock everyone out
  }
}

// Live applications behind a number or email, paid first then newest.
async function personRows(phone10, email) {
  const rows = await sbRpc("co_person_rows", { p_phone10: phone10 || null, p_email: email || null });
  return Array.isArray(rows) ? rows : [];
}
async function resolveIdentifier(identifier) {
  const raw = text(identifier).trim();
  if (!raw) return [];
  if (raw.includes("@")) {
    const e = cleanEmail(raw);
    return e ? personRows(null, e) : [];
  }
  const m = normaliseMobile(raw);
  return m ? personRows(m, null) : [];
}

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

function codeEmail(app, code) {
  const first = firstName(app.full_name);
  const title = (text(app.salutation).trim() || "Dr").replace(/\.$/, "");
  const greeting = first ? `Dear ${title} ${first},` : "Dear Doctor,";
  const subject = `${code} is your CASPIAN Course sign-in code`;
  const lines = [
    greeting,
    "",
    "Use this code to sign in to My course on caspianobesity.com:",
    "",
    code,
    "",
    "The code works for 10 minutes. If you did not ask for it, you can ignore this email. Nobody can sign in without the code.",
    "",
    "CASPIAN Certificate in Obesity Medicine",
    "Caspian Healthcare Foundation, Hyderabad",
  ];
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14202e;background:#f4f6f9">
<div style="background:#ffffff;border:1px solid #e3e9f0;border-radius:10px;padding:26px 22px">
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">${esc(greeting)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 14px">Use this code to sign in to <b>My course</b> on caspianobesity.com:</p>
<div style="font-family:monospace;font-size:32px;letter-spacing:8px;text-align:center;background:#f1f3ea;color:#4f5d2f;font-weight:700;padding:16px;border-radius:8px;margin:14px 0">${esc(code)}</div>
<p style="font-size:13px;line-height:1.6;color:#5a6b7a;margin:14px 0 0">The code works for 10 minutes. If you did not ask for it, you can ignore this email. Nobody can sign in without the code.</p>
</div>
<p style="font-size:12px;color:#7b8b9c;text-align:center;margin-top:18px">CASPIAN Certificate in Obesity Medicine &middot; Caspian Healthcare Foundation, Hyderabad</p>
</body></html>`;
  return { subject, html, text: lines.join("\n") };
}

async function resendSend(from, to, msg) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], reply_to: REPLY_TO, subject: msg.subject, html: msg.html, text: msg.text }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, message: String((j && (j.message || j.error)) || "") };
}

// Try the site's own domain first; if Resend says it is not verified yet,
// send from the verified caspianhealthcare.in domain instead.
async function sendCodeEmail(to, msg) {
  if (!process.env.RESEND_API_KEY) return { ok: false, detail: "RESEND_API_KEY missing" };
  const primary = process.env.RESEND_FROM || "CASPIAN Course <signin@caspianobesity.com>";
  const fallback = process.env.RESEND_FROM_FALLBACK || "CASPIAN Course <signin@caspianhealthcare.in>";
  const first = await resendSend(primary, to, msg);
  if (first.ok) return { ok: true, via: "primary" };
  const domainProblem = (first.status === 403 || first.status === 422) && /domain|verif/i.test(first.message);
  if (domainProblem && fallback && fallback !== primary) {
    const second = await resendSend(fallback, to, msg);
    if (second.ok) return { ok: true, via: "fallback" };
    return { ok: false, detail: `fallback ${second.status} ${second.message}`.slice(0, 200) };
  }
  return { ok: false, detail: `primary ${first.status} ${first.message}`.slice(0, 200) };
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function verifyGoogle(credential) {
  const clientId = googleClientId();
  if (!clientId || !credential || credential.length > 4096 || !/^[A-Za-z0-9_\-.]+$/.test(credential)) return null;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!r.ok) return null;
  const t = await r.json().catch(() => null);
  if (!t || t.aud !== clientId || !GOOGLE_ISSUERS.has(String(t.iss))) return null;
  if (!(t.email_verified === true || t.email_verified === "true")) return null;
  if (Number(t.exp) * 1000 < Date.now()) return null;
  const email = cleanEmail(t.email);
  if (!email || !t.sub) return null;
  return { email, sub: String(t.sub) };
}

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

// provedEmail: the email this device has just proved it owns (the code went
// there, or Google verified it). A session only ever shows applications with
// this exact email. It is never widened by phone number, because the phone on
// an application is typed by the applicant and never checked.
async function startSession(req, res, appId, method, provedEmail) {
  const token = crypto.randomBytes(32).toString("base64url"); // 43 chars
  await sbInsert("co_sessions", {
    token_hash: tokenHash(token),
    app_id: appId,
    proved_email: cleanEmail(provedEmail) || null,
    method,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 200) || null,
  });
  setSessionCookie(res, token);
}

// The signed-in session and the doctor's current best application row, or null.
async function currentSession(req) {
  const token = cookieToken(req);
  if (!token) return null;
  const th = tokenHash(token);
  const rows = await sbGet(`co_sessions?token_hash=eq.${th}&revoked_at=is.null&select=id,app_id,method,created_at,last_seen_at,proved_email&limit=1`);
  const s = rows[0];
  if (!s) return null;
  if (Date.now() - new Date(s.last_seen_at).getTime() > SESSION_DAYS * 86400e3) return null;
  if (Date.now() - new Date(s.last_seen_at).getTime() > 3600e3) {
    sbPatch(`co_sessions?id=eq.${s.id}`, { last_seen_at: new Date().toISOString() }).catch(() => {});
  }
  // The application the session was opened on may since have been superseded
  // or joined by a paid one: always show the person's best live application.
  // Only applications with the email this device proved. Sessions made before
  // proved_email existed are refused, so the person simply signs in again.
  const proved = cleanEmail(s.proved_email);
  if (!proved) return null;
  const people = (await personRows(null, proved)).filter((p) => cleanEmail(p.email) === proved);
  const best = people[0];
  if (!best) return null;
  return { session: s, appId: best.id, allIds: Array.from(new Set(people.map((p) => p.id))) };
}

// ---------------------------------------------------------------------------
// the course page data
// ---------------------------------------------------------------------------

async function signStorageUrl(spec) {
  // spec: storage:<bucket>/<path>
  const rest = spec.slice("storage:".length).replace(/^\/+/, "");
  if (!/^[A-Za-z0-9_.\-/]+$/.test(rest) || rest.includes("..")) return null;
  const r = await fetch(`${SB_URL}/storage/v1/object/sign/${rest}`, {
    method: "POST", headers: sbHeaders(), body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const signed = j && (j.signedURL || j.signedUrl);
  return signed ? `${SB_URL}/storage/v1${signed}` : null;
}

async function coursePage(ctx) {
  const appId = ctx.appId;
  const a = (await sbGet(
    `applications?id=eq.${appId}&select=id,created_at,status,payment_id,salutation,full_name,email,phone,city,specialty,qualification,workplace,council,registration_no,photo_path,why_enrolling,runs_service,patient_volume,prior_training,topics_interest,hear_about&limit=1`
  ))[0];
  if (!a) return null;
  const paid = a.status === "paid";

  const schedule = await sbGet("schedule?select=module_no,title,subtitle,session_date,start_time,end_time,venue_name,venue_address,map_url,note,status&order=module_no.asc");
  const attendance = paid
    ? await sbGet(`attendance?application_id=eq.${appId}&select=module_no,present,sat_with_batch`)
    : [];
  const ref = paid ? (await sbGet(`referral_codes?application_id=eq.${appId}&select=code&limit=1`))[0] : null;
  const cert = paid
    ? (await sbGet(`certificates?application_id=eq.${appId}&revoked=is.false&select=cert_id,issued_on,distinction&limit=1`))[0]
    : null;

  const mats = await sbGet("course_materials?active=is.true&select=id,module_no,title,url,paid_only,sort&order=sort.asc,id.asc");
  const materials = [];
  for (const m of mats) {
    if (m.paid_only && !paid) continue;
    let url = String(m.url || "");
    if (url.startsWith("storage:")) url = await signStorageUrl(url);
    else if (!(url.startsWith("/") || url.startsWith("https://"))) url = null;
    if (!url) continue;
    materials.push({ module_no: m.module_no, title: m.title, url, paid_only: m.paid_only });
  }

  const devices = await sbGet(`co_sessions?app_id=in.(${ctx.allIds.join(",")})&revoked_at=is.null&select=id`);
  const answered = !!(a.why_enrolling || a.runs_service || a.patient_volume || a.prior_training || a.topics_interest || a.hear_about);

  return {
    ok: true,
    person: {
      appId: a.id,
      name: ((a.salutation ? a.salutation + " " : "") + (a.full_name || "")).trim(),
      salutation: a.salutation || "",
      fullName: a.full_name || "",
      email: a.email || "",
      phone: a.phone || "",
      city: a.city || "",
      specialty: a.specialty || "",
      qualification: a.qualification || "",
      workplace: a.workplace || "",
      council: a.council || "",
      registrationNo: a.registration_no || "",
      appliedOn: a.created_at,
    },
    status: paid ? "paid" : "submitted",
    complimentary: paid && a.payment_id === "free",
    profileComplete: !!a.photo_path && answered,
    schedule,
    attendance,
    referralCode: ref ? ref.code : null,
    certificate: cert || null,
    materials,
    signedInWith: ctx.session.method,
    devices: devices.length,
  };
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String((req.query && req.query.do) || "");

  if (action === "config" && req.method === "GET") {
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ enabled: enabled(), googleClientId: enabled() ? googleClientId() || null : null });
  }
  if (!enabled()) {
    return res.status(503).json({ ok: false, disabled: true, message: "Sign-in is switched off for now. Please WhatsApp +91 89784 54547 if you need anything." });
  }
  if (!SB_URL || !SB_KEY || !PEPPER) {
    return res.status(503).json({ ok: false, message: "Sign-in is not set up on the server yet." });
  }

  try {
    if (action === "me" && req.method === "GET") {
      const ctx = await currentSession(req);
      if (!ctx) {
        if (cookieToken(req)) clearSessionCookie(res);
        return res.status(401).json({ ok: false, signedIn: false });
      }
      const page = await coursePage(ctx);
      if (!page) return res.status(401).json({ ok: false, signedIn: false });
      return res.status(200).json(page);
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });
    if (!sameOrigin(req)) return res.status(403).json({ ok: false, message: "Please use the form on caspianobesity.com/me." });
    const b = body(req);

    // ---- step 1: send a code -------------------------------------------
    if (action === "send") {
      if (!(await rateOk(req, "send", 10, 15 * 60))) {
        await logEvent("rate_limited", false, "send");
        return res.status(429).json({ ok: false, message: MSG_BUSY });
      }
      const identifier = text(b.identifier).trim().slice(0, 160);
      if (!identifier) return res.status(400).json({ ok: false, field: "identifier", message: "Please enter your mobile number or email." });
      if (identifier.includes("@") ? !cleanEmail(identifier) : !normaliseMobile(identifier)) {
        return res.status(400).json({ ok: false, field: "identifier", message: identifier.includes("@") ? "Please check the email address." : "Please enter your 10-digit mobile number, or your email." });
      }
      const people = await resolveIdentifier(identifier);
      if (!people.length) {
        await logEvent("not_found", true, identifier.includes("@") ? "email" : "mobile");
        return res.status(200).json({ ok: false, reason: "not_found", field: "identifier", message: MSG_NOT_FOUND });
      }
      const best = people[0];
      const to = cleanEmail(best.email);
      if (!to) {
        return res.status(200).json({ ok: false, reason: "no_email", message: `We do not have an email address on your application, so we cannot send a code. Please WhatsApp +91 89784 54547.` });
      }
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      const gate = String(await sbRpc("co_new_code", { p_app: best.id, p_hash: codeHash(best.id, code), p_sent_to: to, p_ttl_secs: CODE_TTL_SECS }));
      if (gate.startsWith("wait:")) {
        return res.status(200).json({ ok: true, already: true, sentTo: maskEmail(to), resendIn: Math.max(1, parseInt(gate.slice(5), 10) || 45) });
      }
      if (gate === "limit") {
        await logEvent("code_limit", false, "5 per hour reached");
        return res.status(429).json({ ok: false, message: "Too many codes for this number in the last hour. Please try again later." });
      }
      const app = (await sbGet(`applications?id=eq.${best.id}&select=salutation,full_name&limit=1`))[0] || {};
      const sent = await sendCodeEmail(to, codeEmail(app, code));
      if (!sent.ok) {
        await logEvent("send_fail", false, sent.detail);
        return res.status(502).json({ ok: false, message: "Could not send the code just now. Please try again in a minute." });
      }
      await logEvent("send", true, sent.via === "fallback" ? "from fallback domain" : null);
      return res.status(200).json({ ok: true, sentTo: maskEmail(to), resendIn: 45 });
    }

    // ---- step 2: check the code ----------------------------------------
    if (action === "verify") {
      if (!(await rateOk(req, "verify", 30, 15 * 60))) {
        await logEvent("rate_limited", false, "verify");
        return res.status(429).json({ ok: false, message: MSG_BUSY });
      }
      const code = text(b.code).replace(/\D/g, "");
      if (code.length !== 6) return res.status(400).json({ ok: false, field: "code", message: "Please enter the 6-digit code." });
      const people = await resolveIdentifier(text(b.identifier).slice(0, 160));
      if (!people.length) return res.status(400).json({ ok: false, field: "code", message: MSG_WRONG });
      const best = people[0];
      const result = String(await sbRpc("co_check_code", { p_app: best.id, p_hash: codeHash(best.id, code) }));
      if (result === "locked") {
        await logEvent("bad_code", false, "locked after 5 tries");
        return res.status(429).json({ ok: false, field: "code", message: "Too many wrong tries for this code. Please ask for a new code." });
      }
      if (result !== "ok") {
        await logEvent("bad_code", false, result);
        return res.status(400).json({ ok: false, field: "code", message: MSG_WRONG });
      }
      await startSession(req, res, best.id, "email_code", best.email);
      return res.status(200).json({ ok: true });
    }

    // ---- Sign in with Google -------------------------------------------
    if (action === "google") {
      if (!(await rateOk(req, "google", 30, 15 * 60))) {
        await logEvent("rate_limited", false, "google");
        return res.status(429).json({ ok: false, message: MSG_BUSY });
      }
      if (!googleClientId()) return res.status(503).json({ ok: false, message: "Google sign-in is not set up yet. Please use your mobile number." });
      const g = await verifyGoogle(text(b.credential));
      if (!g) {
        await logEvent("google_fail", false, "credential not verified");
        return res.status(401).json({ ok: false, message: "Google could not confirm this sign-in. Please try again, or use your mobile number." });
      }
      // A Google account already linked to an application wins; otherwise match the email.
      let best = null;
      const linked = await sbGet(`applications?google_sub=eq.${encodeURIComponent(g.sub)}&status=in.(paid,submitted)&select=id,phone,email&limit=1`);
      let proved = g.email;
      if (linked[0] && cleanEmail(linked[0].email)) {
        proved = cleanEmail(linked[0].email);
        best = (await personRows(null, proved))[0] || null;
      }
      if (!best) {
        proved = g.email;
        best = (await personRows(null, g.email))[0] || null;
      }
      if (!best) {
        await logEvent("google_no_match", true, null);
        return res.status(200).json({
          ok: false,
          reason: "not_found",
          message: `${g.email} is not the email on any CASPIAN application. Please sign in with your mobile number instead.`,
        });
      }
      if (!best.google_sub) {
        await sbPatch(`applications?id=eq.${best.id}&google_sub=is.null`, { google_sub: g.sub }).catch(() => {});
      }
      await startSession(req, res, best.id, "google", proved);
      return res.status(200).json({ ok: true });
    }

    // ---- sign out ------------------------------------------------------
    if (action === "signout" || action === "signout_all") {
      const token = cookieToken(req);
      clearSessionCookie(res);
      if (!token) return res.status(200).json({ ok: true });
      const now = new Date().toISOString();
      if (action === "signout") {
        await sbPatch(`co_sessions?token_hash=eq.${tokenHash(token)}&revoked_at=is.null`, { revoked_at: now });
        return res.status(200).json({ ok: true });
      }
      const ctx = await currentSession(req);
      if (ctx) {
        await sbPatch(`co_sessions?app_id=in.(${ctx.allIds.join(",")})&revoked_at=is.null`, { revoked_at: now });
      } else {
        await sbPatch(`co_sessions?token_hash=eq.${tokenHash(token)}&revoked_at=is.null`, { revoked_at: now });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ ok: false, message: "Unknown action." });
  } catch (err) {
    await logEvent("error", false, `${action}: ${err && err.message ? err.message : "unknown"}`);
    return res.status(500).json({ ok: false, message: "Something went wrong on our side. Please try again in a minute." });
  }
}
