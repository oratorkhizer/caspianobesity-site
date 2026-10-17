// Vercel Serverless Function - the one write path for the public forms that used
// to post straight from the browser to Supabase (anon key) or to FormSubmit.
// Bot checks run first (see ./_guard.js), then the row is written with the
// service key, or the enquiry is relayed to FormSubmit.
//
// POST { form: "feedback", ...row, turnstile, ms, website }   (/feedback)
// POST { form: "interest", ...row, turnstile, ms, website }   (/next, Batch 2 list)
// POST { form: "enquiry",  ...fields, turnstile, ms, website } (homepage enquiry)
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, TURNSTILE_SECRET_KEY (optional)
import { HUMAN_MSG, clientIp, isTrap, looksRandom, verifyTurnstile } from "./_guard.js";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const FORMSUBMIT = "https://formsubmit.co/ajax/drkhizer@caspianobesity.com";

function str(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}
function score(v, lo, hi) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}

async function insert(table, row) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  return r.ok;
}

const STATEMENTS = [
  "obj_clear", "relevant", "teaching_clear", "cases_helped",
  "slides_clear", "pace_right", "use_this_week", "venue_ok",
];

function feedbackRow(b) {
  const module_no = score(b.module_no, 1, 12);
  if (!module_no) return null;
  const row = {
    module_no,
    role: str(b.role, 80),
    most_useful: str(b.most_useful, 2000),
    improve: str(b.improve, 2000),
    future_topic: str(b.future_topic, 1000),
    respondent_name: str(b.respondent_name, 120),
    can_quote: b.can_quote === true,
    format_pref: str(b.format_pref, 200),
    nps: score(b.nps, 0, 10),
  };
  for (const k of STATEMENTS) {
    row[k] = score(b[k], 1, 5);
    if (row[k] == null) return null;
  }
  if (row.nps == null) return null;
  return row;
}

function interestRow(b) {
  const name = str(b.name, 120);
  const phone = str(b.phone, 20);
  const city = str(b.city, 80);
  if (!name || !phone || !city) return null;
  return {
    name,
    phone,
    email: str(b.email, 120),
    city,
    mode: str(b.mode, 60),
    timing: str(b.timing, 60),
    source: str(b.source, 200),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let b;
  try {
    b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    return res.status(400).json({ error: "Bad request." });
  }
  const form = String(b.form || "");
  if (!["feedback", "interest", "enquiry"].includes(form)) {
    return res.status(400).json({ error: "Unknown form." });
  }

  // 1 and 2: silent drop, the sender sees the normal success reply.
  const name = form === "feedback" ? b.respondent_name : b.name;
  if (isTrap(b) || looksRandom(name, b.email)) return res.status(200).json({ ok: true });

  // 3: Turnstile (skipped while TURNSTILE_SECRET_KEY is unset).
  if (!(await verifyTurnstile(b.turnstile, clientIp(req)))) {
    return res.status(400).json({ error: HUMAN_MSG });
  }

  try {
    if (form === "enquiry") {
      const data = {
        name: str(b.name, 120) || "",
        email: str(b.email, 160) || "",
        phone: str(b.phone, 40) || "",
        city: str(b.city, 80) || "",
        role: str(b.role, 80) || "",
        question: str(b.question, 3000) || "",
        _subject: "New seat enquiry, CASPIAN Obesity Medicine",
        _template: "table",
      };
      if (!data.name || !data.email) return res.status(400).json({ error: "Name and email are required." });
      const r = await fetch(FORMSUBMIT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          // FormSubmit ties the inbox to the site it was activated from.
          Origin: "https://caspianobesity.com",
          Referer: "https://caspianobesity.com/",
        },
        body: JSON.stringify(data),
      });
      let j = null;
      try { j = await r.json(); } catch { /* not JSON */ }
      const ok = r.ok && !(j && (j.success === false || j.success === "false"));
      return res.status(ok ? 200 : 502).json(ok ? { ok: true } : { error: "Could not send right now." });
    }

    if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Not available right now." });

    if (form === "feedback") {
      const row = feedbackRow(b);
      if (!row) return res.status(400).json({ error: "Please answer every rating question." });
      const ok = await insert("feedback", row);
      return res.status(ok ? 200 : 500).json(ok ? { ok: true } : { error: "Could not save." });
    }

    const row = interestRow(b);
    if (!row) return res.status(400).json({ error: "Name, WhatsApp number and city are required." });
    const ok = await insert("waitlist", row);
    return res.status(ok ? 200 : 500).json(ok ? { ok: true } : { error: "Could not save." });
  } catch {
    return res.status(500).json({ error: "Could not save." });
  }
}
