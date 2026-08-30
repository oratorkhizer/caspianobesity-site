// Vercel Serverless Function - what the founding batch said, for the homepage.
//
//   GET /api/testimonials -> { stats: { responses, recommend, avg }, quotes: [...] }
//
// Two safeguards, because this is the one endpoint that puts a doctor's words
// and name on a public page:
//   1. Only rows with featured = true are ever returned, and the database has a
//      check constraint that a row cannot be featured unless can_quote is true.
//      Consent is enforced in the schema, not just here.
//   2. Only the curated quote_override text is published, never the raw form
//      answer, and never the free-text criticism fields.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const LIKERT = [
  "obj_clear", "relevant", "teaching_clear", "cases_helped",
  "slides_clear", "pace_right", "use_this_week", "venue_ok"
];

async function sb(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }
  });
  if (!r.ok) throw new Error("read failed");
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
  if (!SB_URL || !SB_KEY) return res.status(200).json({ quotes: [] });

  try {
    const [featured, all] = await Promise.all([
      sb("feedback?select=respondent_name,role,display_name,display_role,quote_override,module_no&featured=is.true&order=module_no.asc"),
      sb(`feedback?select=nps,${LIKERT.join(",")}`)
    ]);

    const n = all.length;
    let recommend = null, avg = null;
    if (n) {
      const withNps = all.filter((r) => typeof r.nps === "number");
      // "would recommend" is plainer than a net promoter score, and is the
      // thing a doctor reading the page actually wants to know.
      if (withNps.length) {
        recommend = Math.round((withNps.filter((r) => r.nps >= 9).length / withNps.length) * 100);
      }
      const scores = [];
      for (const r of all) for (const k of LIKERT) if (typeof r[k] === "number") scores.push(r[k]);
      if (scores.length) avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    }

    const quotes = featured
      .filter((q) => q.quote_override && q.quote_override.trim())
      .map((q) => ({
        text: q.quote_override.trim(),
        // display_name / display_role are the curated public forms, carrying the
        // doctor's full name and title. They fall back to what was typed in the
        // form, which is never overwritten.
        name: (q.display_name || q.respondent_name || "").trim() || null,
        role: (q.display_role || q.role || "").trim() || null,
        module: q.module_no
      }));

    return res.status(200).json({ stats: { responses: n, recommend, avg }, quotes });
  } catch {
    return res.status(200).json({ quotes: [] });
  }
}
