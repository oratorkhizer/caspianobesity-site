# caspianobesity-site

Source for **caspianobesity.com**, the CASPIAN Certificate in Obesity Medicine course site (Caspian Healthcare Foundation). Auto-deploys to the `caspianobesity` Vercel project on push to `main`.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Landing page (course, curriculum, fees, FAQ, enquiry form) |
| `apply.html` (`/apply`) | 6-step application wizard → Razorpay Standard Checkout |
| `verify.html` (`/verify`) | Certificate verification (Credential ID / QR). Reads `/api/credentials` first, then falls back to `certs/*.json` |
| `refer.html` (`/refer`) | Enrolled doctors find and share their personal referral code (mobile + email lookup) |
| `certs/*.json` | One JSON record per issued certificate (`CASP-OM-YYYY-NNNN.json`) |
| `thanks.html` (`/thanks`) | Post-enquiry / post-payment confirmation (`?paid=1`, `?free=1`) |
| `about / contact / terms / privacy / refund / cancellation` | Info & policy pages |
| `404.html` | Branded not-found page |
| `app.js` | Landing-page JS (menu, reveal, countdown, sticky mobile CTA, enquiry form) |
| `assist.js` | Course assistant widget, instant answers from a curated, official-facts KB; WhatsApp handoff. No external calls. |
| `style.css` | Landing-page styles |
| `llms.txt` | Plain-language course summary for AI assistants / answer engines |
| `api/apply.js` | Saves an application to Supabase; returns signed photo-upload URL |
| `api/create-order.js` | Creates a Razorpay order. **Server owns the price.** Promo codes looked up in Supabase (single-use). |
| `api/verify-payment.js` | HMAC-verifies payment; marks promo used; marks application paid |
| `api/credentials.js` | Public: verify a certificate (GET ?id=), a doctor's own referral code. Admin (ADMIN_KEY): issue/revoke certificates, Kahoot top scorers, referral counts |
| `me.html` (`/me`) + `api/me.js` | My course: sign in with Google or a 6-digit email code; seat status, next module, attendance, feedback, course material (table `course_materials`), sign out per device or everywhere. Tables `co_sessions`, `co_signin_codes`, `co_auth_events`, `co_rate_hits`. |
| `api/redeem-free.js` | Atomically claims a 100%-off code and confirms a complimentary seat |

## Environment variables (Vercel)

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, payments (never commit)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, applications + promo codes (never commit)
- `SIGNIN_PEPPER` (secret salt for /me codes and sessions), `RESEND_API_KEY`, optional `RESEND_FROM` / `RESEND_FROM_FALLBACK`, `GOOGLE_CLIENT_ID` (Google button hidden until set), `SIGNIN_ENABLED` (`off` switches /me sign-in off)
- `FOUNDING_FEE_PAISE`, optional price override (default `299900` = Rs 2,999)

## Conventions

- Internal links are extensionless (`/about`, not `/about.html`), `cleanUrls` is on in `vercel.json`.
- `sitemap.xml` lists extensionless URLs only; `/apply`, `/verify`, `/thanks` are `noindex`.
- To issue a certificate: use the Certificates section on `/admin` (Supabase table `certificates`, next ID given by `ccom_issue_certificate`). The specimen still lives in `certs/CASP-OM-2026-0001.json`.
- Referral codes (`REF-NAME-XXXX`, table `referral_codes`): 25% off in `create-order.js`, never below `REFERRAL_FLOOR_PAISE` (default 299900). One code per order, so a referral never stacks with a promo code.
- Binary assets (jpg/png/pdf) must be uploaded via the GitHub web UI, not the API bridge.
