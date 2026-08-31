// Vercel Serverless Function - saves a course application to Supabase and returns
// the new application id plus a short-lived signed URL the browser uses to upload
// the applicant photo directly to private storage.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function sbHeaders(extra) {
  return Object.assign(
    { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    extra || {}
  );
}
function str(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}
function bool(v) { return v === true || v === "true" || v === "on" || v === 1; }
function intOrNull(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SB_URL || !SB_KEY) return res.status(503).json({ error: "Applications are not available right now." });

  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const full_name = str(b.full_name, 120);
    const email = str(b.email, 160);
    const phone = str(b.phone, 40);
    if (!full_name || !email || !phone) {
      return res.status(400).json({ error: "Name, email and phone are required." });
    }
    if (!bool(b.consent_data) || !bool(b.attendance_ack)) {
      return res.status(400).json({ error: "Please accept the required consents." });
    }

    const sameAddr = b.correspondence_same === undefined ? true : bool(b.correspondence_same);
    const row = {
      salutation: str(b.salutation, 16),
      full_name,
      name_confirmed: bool(b.name_confirmed),
      dob: str(b.dob, 20),
      gender: str(b.gender, 24),
      council: str(b.council, 80),
      registration_no: str(b.registration_no, 60),
      registration_year: intOrNull(b.registration_year),
      qualification: str(b.qualification, 120),
      specialty: str(b.specialty, 80),
      years_practice: str(b.years_practice, 40),
      workplace: str(b.workplace, 160),
      city: str(b.city, 80),
      email,
      phone,
      permanent_address: str(b.permanent_address, 400),
      correspondence_same: sameAddr,
      correspondence_address: sameAddr ? null : str(b.correspondence_address, 400),
      why_enrolling: str(b.why_enrolling, 1000),
      runs_service: str(b.runs_service, 40),
      patient_volume: str(b.patient_volume, 40),
      prior_training: str(b.prior_training, 40),
      topics_interest: str(b.topics_interest, 400),
      dietary: str(b.dietary, 40),
      hear_about: str(b.hear_about, 120),
      consent_data: bool(b.consent_data),
      consent_photo: bool(b.consent_photo),
      consent_comms: bool(b.consent_comms),
      attendance_ack: bool(b.attendance_ack),
      status: "submitted",
    };

    // Has this doctor been here before?
    //
    // A doctor whose payment failed had no way back to the application they had
    // just filled, so they filled all six steps again, and again. Three doctors
    // produced five of the seven unpaid rows on the books that way, one of them
    // filling the form four times in a single day. So: reuse the unpaid row
    // instead of laying down another one, and flag an email that has already
    // paid so the browser can stop before charging a second time.
    let existing = [];
    try {
      // ilike with no wildcard is a case-insensitive exact match.
      const look = await fetch(
        `${SB_URL}/rest/v1/applications?email=ilike.${encodeURIComponent(email)}` +
          `&select=id,status,photo_path&order=created_at.desc`,
        { headers: sbHeaders() }
      );
      if (look.ok) existing = await look.json();
    } catch {
      /* a lookup failure must never stop someone applying */
    }
    const unpaid = existing.find((r) => r.status === "submitted");
    const paidBefore = existing.some((r) => r.status === "paid");

    let id, photoAlready = null;
    if (unpaid) {
      const upd = await fetch(`${SB_URL}/rest/v1/applications?id=eq.${unpaid.id}`, {
        method: "PATCH",
        headers: sbHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(row),
      });
      if (!upd.ok) return res.status(500).json({ error: "Could not save the application." });
      id = unpaid.id;
      photoAlready = unpaid.photo_path || null;
    } else {
      const ins = await fetch(`${SB_URL}/rest/v1/applications`, {
        method: "POST",
        headers: sbHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify(row),
      });
      if (!ins.ok) {
        return res.status(500).json({ error: "Could not save the application." });
      }
      id = (await ins.json())[0].id;
    }

    // Signed upload URL for the photo (optional client-side use).
    // NB: no Content-Type header on this call - an empty JSON body makes storage reject it.
    let uploadUrl = null;
    const photoPath = `${id}.jpg`;
    void photoAlready; // the path is per-id, so a resumed application overwrites its own photo
    try {
      const sign = await fetch(
        `${SB_URL}/storage/v1/object/upload/sign/applicant-photos/${photoPath}`,
        { method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
      );
      if (sign.ok) {
        const j = await sign.json();
        if (j && j.url) {
          uploadUrl = `${SB_URL}/storage/v1${j.url}`;
          await fetch(`${SB_URL}/rest/v1/applications?id=eq.${id}`, {
            method: "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify({ photo_path: `applicant-photos/${photoPath}` }),
          });
        }
      }
    } catch {
      /* photo is optional; never block the application on it */
    }

    return res.status(200).json({
      id,
      uploadUrl,
      // The browser uses these: resumed keeps the message honest, paidBefore
      // makes it stop and ask rather than open checkout a second time.
      resumed: !!unpaid,
      paidBefore: paidBefore && !unpaid,
    });
  } catch (err) {
    return res.status(500).json({ error: "Could not save the application." });
  }
}
