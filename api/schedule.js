// Vercel Serverless Function - the course schedule.
//
//   GET  /api/schedule            -> { rows }            (public, no key)
//   POST /api/schedule { key, ... } -> { rows }          (admin passcode)
//
// The schedule is the single source of truth for the twelve module dates and
// the venue. The public /schedule page reads it, and /api/calendar builds the
// .ics from it, so changing the venue here changes it everywhere at once.
//
// Any change to a date, a time, the venue or the status bumps that module's
// SEQUENCE counter. Calendar apps use SEQUENCE together with the event UID to
// recognise a re-issued invitation as an update to an event they already hold
// rather than as a new one.
//
// Env vars: ADMIN_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY;

const COLS = [
  "module_no", "title", "subtitle", "session_date", "start_time", "end_time",
  "venue_name", "venue_address", "map_url", "note", "status", "seq", "updated_at"
].join(",");

// Fields the passcode holder is allowed to change.
const EDITABLE = [
  "title", "subtitle", "session_date", "start_time", "end_time",
  "venue_name", "venue_address", "map_url", "note", "status"
];
// Changing any of these means people need to be told, so bump SEQUENCE.
const MATERIAL = ["session_date", "start_time", "end_time", "venue_name", "venue_address", "status"];

const STATUSES = ["confirmed", "tentative", "cancelled", "completed"];

function safeEqual(a, b) {
  try {
    const A = Buffer.from(String(a || ""));
    const B = Buffer.from(String(b || ""));
    return A.length === B.length && crypto.timingSafeEqual(A, B);
  } catch {
    return false;
  }
}

async function sb(path, init = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: "Bearer " + SB_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
}

async function readAll() {
  const r = await sb(`schedule?select=${COLS}&order=module_no.asc`);
  if (!r.ok) throw new Error("read failed");
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });

  if (req.method === "GET") {
    try {
      return res.status(200).json({ rows: await readAll() });
    } catch {
      return res.status(500).json({ error: "Could not load the schedule." });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!ADMIN_KEY) {
    return res.status(503).json({ error: "Editing is not configured yet. Add an ADMIN_KEY environment variable in Vercel, then redeploy." });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!safeEqual(body.key, ADMIN_KEY)) {
    await new Promise((r) => setTimeout(r, 900)); // slow brute force
    return res.status(401).json({ error: "Wrong passcode." });
  }

  // A bare { key } is a sign-in check: hand back the rows to edit.
  if (!body.updates) {
    try {
      return res.status(200).json({ rows: await readAll() });
    } catch {
      return res.status(500).json({ error: "Could not load the schedule." });
    }
  }

  const updates = Array.isArray(body.updates) ? body.updates : [body.updates];
  if (updates.length > 12) return res.status(400).json({ error: "Too many modules in one request." });

  let current;
  try {
    current = await readAll();
  } catch {
    return res.status(500).json({ error: "Could not load the schedule." });
  }
  const byNo = new Map(current.map((r) => [r.module_no, r]));

  for (const u of updates) {
    const no = Number(u.module_no);
    const row = byNo.get(no);
    if (!row) return res.status(400).json({ error: `Module ${u.module_no} is not in the schedule.` });

    const patch = {};
    for (const f of EDITABLE) {
      if (!(f in u)) continue;
      let v = u[f];
      if (typeof v === "string") v = v.trim();
      if (v === "") v = null;
      if (f === "status") {
        if (!STATUSES.includes(v)) return res.status(400).json({ error: `Unknown status "${v}".` });
      }
      if (f === "session_date" && v !== null && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        return res.status(400).json({ error: `Module ${no}: the date must look like 2027-01-03.` });
      }
      if ((f === "start_time" || f === "end_time") && v !== null && !/^\d{2}:\d{2}$/.test(v)) {
        return res.status(400).json({ error: `Module ${no}: the time must look like 10:00.` });
      }
      if (typeof v === "string" && v.length > 400) {
        return res.status(400).json({ error: `Module ${no}: "${f}" is too long.` });
      }
      if (String(row[f] ?? "") !== String(v ?? "")) patch[f] = v;
    }
    if (!Object.keys(patch).length) continue;

    if (MATERIAL.some((f) => f in patch)) patch.seq = (row.seq || 0) + 1;
    patch.updated_at = new Date().toISOString();

    const r = await sb(`schedule?module_no=eq.${no}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch)
    });
    if (!r.ok) return res.status(500).json({ error: `Could not save module ${no}.` });
  }

  try {
    return res.status(200).json({ rows: await readAll(), saved: true });
  } catch {
    return res.status(200).json({ saved: true });
  }
}
