// Vercel Serverless Function - the attendance register.
//
//   POST /api/attendance { key }                    -> roster + marks + modules
//   POST /api/attendance { key, marks: [...] }      -> save, then return the same
//
// Certification needs attendance at 10 of the 12 modules, so this has to be a
// record rather than a memory. It is complicated by the founding batch: half of
// them missed Module 1 for the NEET exam and will sit it with the next batch, so
// a mark carries the batch it was earned in.
//
// The attendance table has RLS on and no policies at all, so the public anon key
// can neither read nor write it. Everything goes through here behind ADMIN_KEY.
//
// Env vars: ADMIN_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
import crypto from "crypto";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_KEY = process.env.ADMIN_KEY;

const REQUIRED = 10;   // modules needed to sit the examination
const TOTAL = 12;

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

async function load() {
  const [rRoster, rMarks, rMods] = await Promise.all([
    sb("applications?select=id,salutation,full_name,specialty,city,phone&status=eq.paid&order=full_name.asc"),
    sb("attendance?select=module_no,application_id,present,sat_with_batch,note,marked_at"),
    sb("schedule?select=module_no,title,session_date,status&order=module_no.asc")
  ]);
  if (!rRoster.ok || !rMarks.ok) throw new Error("read failed");
  const roster = await rRoster.json();
  const marks = await rMarks.json();
  const modules = rMods.ok ? await rMods.json() : [];

  // Attendance count per doctor, so the eligibility question is answered here
  // rather than being recomputed in three different places on the page.
  const byDoctor = new Map();
  for (const m of marks) {
    if (!m.present) continue;
    byDoctor.set(m.application_id, (byDoctor.get(m.application_id) || 0) + 1);
  }
  for (const d of roster) {
    d.attended = byDoctor.get(d.id) || 0;
    d.short_by = Math.max(0, REQUIRED - d.attended);
  }
  return { roster, marks, modules, required: REQUIRED, total: TOTAL };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Database is not configured." });
  if (!ADMIN_KEY) return res.status(503).json({ error: "Attendance is not configured yet. Add an ADMIN_KEY environment variable in Vercel, then redeploy." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!safeEqual(body.key, ADMIN_KEY)) {
    await new Promise((r) => setTimeout(r, 900)); // slow brute force
    return res.status(401).json({ error: "Wrong passcode." });
  }

  if (body.marks) {
    const marks = Array.isArray(body.marks) ? body.marks : [body.marks];
    if (marks.length > 400) return res.status(400).json({ error: "Too many marks in one request." });

    const up = [];
    const del = [];
    for (const m of marks) {
      const module_no = Number(m.module_no);
      const application_id = String(m.application_id || "");
      if (!(module_no >= 1 && module_no <= TOTAL)) return res.status(400).json({ error: `Module ${m.module_no} is not valid.` });
      if (!/^[0-9a-f-]{36}$/i.test(application_id)) return res.status(400).json({ error: "Bad doctor id." });
      // Absent is stored as the absence of a row, so the table stays a record of
      // who was actually there rather than a row per doctor per module.
      if (m.present === false) { del.push({ module_no, application_id }); continue; }
      up.push({
        module_no,
        application_id,
        present: true,
        sat_with_batch: Number(m.sat_with_batch) || 1,
        note: m.note ? String(m.note).slice(0, 300) : null,
        marked_at: new Date().toISOString()
      });
    }

    if (up.length) {
      const r = await sb("attendance?on_conflict=module_no,application_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(up)
      });
      if (!r.ok) return res.status(500).json({ error: "Could not save the attendance." });
    }
    for (const d of del) {
      const r = await sb(`attendance?module_no=eq.${d.module_no}&application_id=eq.${d.application_id}`, { method: "DELETE" });
      if (!r.ok) return res.status(500).json({ error: "Could not save the attendance." });
    }
  }

  try {
    return res.status(200).json({ ...(await load()), saved: !!body.marks });
  } catch {
    return res.status(500).json({ error: "Could not load the register." });
  }
}
