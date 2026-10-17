// Shared bot checks for the public forms (not a route: Vercel skips files that
// start with an underscore). Order, per the group spec:
//   1. honeypot filled, or the form was filled in under 1.5 s -> silent drop
//   2. name looks like a random string (or a dotted gmail)   -> silent drop
//   3. Cloudflare Turnstile token, only when TURNSTILE_SECRET_KEY is set.
//      Missing or failed token -> 400. Cloudflare down or slow -> allow.
//
// Env var: TURNSTILE_SECRET_KEY (optional; unset = Turnstile check skipped)

export const HUMAN_MSG =
  "We could not confirm this was sent by a person. Please refresh the page and try again.";

export function clientIp(req) {
  const xf = String((req.headers && req.headers["x-forwarded-for"]) || "");
  return xf.split(",")[0].trim() || String((req.headers && req.headers["x-real-ip"]) || "");
}

// True when the honeypot is filled or the form was submitted too fast.
export function isTrap(b, hpField = "website") {
  if (b && b[hpField] != null && String(b[hpField]).trim() !== "") return true;
  if (b && b.ms !== undefined && b.ms !== null && b.ms !== "") {
    const ms = Number(b.ms);
    if (Number.isFinite(ms) && ms < 1500) return true;
  }
  return false;
}

// Random-looking names such as "KxQzRtLmPwVb", or gmail addresses like a.b.c.d@gmail.com.
export function looksRandom(name, email) {
  const n = String(name || "").trim();
  if (/^[A-Za-z]{10,}$/.test(n) && (n.slice(1).match(/[A-Z]/g) || []).length >= 3) return true;
  const e = String(email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at > 0 && /^(gmail|googlemail)\.com$/.test(e.slice(at + 1))) {
    if ((e.slice(0, at).match(/\./g) || []).length >= 3) return true;
  }
  return false;
}

// Resolves true when the request may proceed.
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", String(token));
    if (ip) form.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: ctrl.signal,
    });
    const j = await r.json();
    return j && j.success === true;
  } catch {
    return true; // fail open if Cloudflare itself is unreachable
  } finally {
    clearTimeout(timer);
  }
}
