// Vercel Serverless Function - the course calendar, built live from the
// schedule table and served as an iCalendar feed.
//
//   /calendar.ics        -> the twelve modules, current venue, current dates
//
// Two ways to use it. A participant can subscribe to this URL in Google
// Calendar or Outlook ("add calendar from URL"), in which case a venue change
// reaches them on its own within a day. Or they can download it once, in which
// case the stable UID plus the SEQUENCE counter lets a later re-issue update
// the entries they already have instead of duplicating them.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

const SITE = "https://caspianobesity.com";
const DOMAIN = "caspianobesity.com";

// RFC 5545: escape , ; \ and newlines inside text values.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545: no content line may exceed 75 octets; continuations start with a space.
function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // do not split a multi-byte character
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((start ? " " : "") + bytes.slice(start, end).toString("utf8"));
    start = end;
    limit = 74; // the leading space counts toward the 75
  }
  return out.join("\r\n");
}

// "10:00" -> "10 am", "13:00" -> "1 pm"
function clock(t) {
  const [H, M] = String(t || "").split(":").map(Number);
  if (!Number.isFinite(H)) return t || "";
  const ap = H < 12 ? "am" : "pm";
  const h = H % 12 === 0 ? 12 : H % 12;
  return M ? `${h}.${String(M).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function build(rows) {
  const now = stamp(new Date());
  const L = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Caspian Healthcare Foundation//CASPIAN Certificate in Obesity Medicine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CASPIAN Certificate in Obesity Medicine",
    "X-WR-CALDESC:The twelve monthly modules of the CASPIAN Certificate in Obesity Medicine.",
    "X-WR-TIMEZONE:Asia/Kolkata",
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Kolkata",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0530",
    "TZOFFSETTO:+0530",
    "TZNAME:IST",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  for (const r of rows) {
    if (!r.session_date) continue;
    const day = r.session_date.replace(/-/g, "");
    const st = (r.start_time || "10:00").replace(":", "") + "00";
    const en = (r.end_time || "13:00").replace(":", "") + "00";
    const venue = [r.venue_name, r.venue_address].filter(Boolean).join(", ");
    const cancelled = r.status === "cancelled";

    const desc = [
      `Module ${r.module_no} of the CASPIAN Certificate in Obesity Medicine.`,
      r.subtitle || "",
      "",
      `Venue: ${venue}`,
      r.map_url ? `Map: ${r.map_url}` : "",
      "",
      `Registration opens thirty minutes before we start. We begin at ${clock(r.start_time || "10:00")} sharp and finish at ${clock(r.end_time || "13:00")}, followed by lunch.`,
      "Bring your phone charged for the live quiz.",
      "",
      r.note || "",
      "",
      `Dates and venue are kept current at ${SITE}/schedule`
    ].filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");

    L.push("BEGIN:VEVENT");
    L.push(`UID:caspian-module-${r.module_no}@${DOMAIN}`);
    L.push(`DTSTAMP:${now}`);
    L.push(`SEQUENCE:${r.seq || 0}`);
    L.push(`DTSTART;TZID=Asia/Kolkata:${day}T${st}`);
    L.push(`DTEND;TZID=Asia/Kolkata:${day}T${en}`);
    L.push(`SUMMARY:${esc((cancelled ? "CANCELLED: " : "") + `CASPIAN Module ${r.module_no}: ${r.title}`)}`);
    L.push(`LOCATION:${esc(venue)}`);
    L.push(`DESCRIPTION:${esc(desc)}`);
    L.push(`URL:${SITE}/schedule`);
    L.push(`STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`);
    L.push("TRANSP:OPAQUE");
    if (!cancelled) {
      L.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY",
        `DESCRIPTION:${esc(`CASPIAN Module ${r.module_no} is tomorrow at ${clock(r.start_time || "10:00")}, ${venue}`)}`, "END:VALARM");
      L.push("BEGIN:VALARM", "TRIGGER:-PT90M", "ACTION:DISPLAY",
        `DESCRIPTION:${esc(`CASPIAN Module ${r.module_no} today. Registration opens 9.30.`)}`, "END:VALARM");
    }
    L.push("END:VEVENT");
  }

  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

export default async function handler(req, res) {
  if (!SB_URL || !SB_KEY) return res.status(503).send("Database is not configured.");
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/schedule?select=*&order=module_no.asc`,
      { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } }
    );
    if (!r.ok) throw new Error("read failed");
    const rows = await r.json();
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="CASPIAN-Course-Dates.ics"');
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).send(build(rows));
  } catch {
    return res.status(500).send("Could not build the calendar.");
  }
}
