# Admin dashboard and analytics (v0.2)

**URL:** `/admin` (the old `/#admin` link still works). Sign in with the existing admin passcode (`ADMIN_EXPORT_TOKEN`). No new environment variables.

## One-time setup before deploying
1. Supabase, SQL Editor, paste all of `docs/schema-v2.sql`, Run. It only ADDS two tables (`analytics_events`, `admin_sessions`) and never touches `contacts`.
2. Then push the code (Vercel redeploys). If you deploy first, the public site still works, but admin sign-in fails until the SQL has been run.

## Authentication
- The passcode is only ever sent to `POST /api/admin/session` and compared server-side (constant time). It is never in the frontend bundle or the URL.
- A successful login sets a random session token in an HttpOnly, SameSite=Strict cookie (Secure on https), scoped to `/api/admin`, valid 8 hours. The database stores only its SHA-256 hash.
- Sign out deletes the session server-side. Old cookies stop working immediately.
- Every admin endpoint checks the session on the server. Changing or deleting data also requires the `X-Requested-With` header (CSRF defence).
- 5 wrong passcodes lock the IP out for 15 minutes (per serverless instance, best effort).
- `GET /api/admin/export` still accepts the Bearer passcode (scripts) or a dashboard session.

## What is stored
| Table | Contents |
|---|---|
| `contacts` | unchanged: username, phone, consent time |
| `analytics_events` | event type, allow-listed click target, page path, random per-tab session id, country, region, city, referrer host, time |
| `admin_sessions` | SHA-256 of session token, expiry |

NOT stored: IP address, user agent, names, phone numbers, form contents, cookies for visitors. Locations come from Vercel's request headers (country/region/city) and are approximate.
Visitors who send Do-Not-Track or Global Privacy Control are not counted. The dashboard has a switch to exclude your own browser (on by default after you sign in).

## Reading the numbers
- **Visits** = distinct browser tab sessions, NOT unique people (no fingerprinting, no cross-day tracking).
- Days before analytics began are shown as "not tracked", never as zero. Earlier history cannot be recovered.
- **Conversion** = visits that completed a registration / visits.
- Day boundaries use Nigeria time (UTC+1).
- Registrations come straight from the `contacts` table and are always real, with or without analytics.

## Cost and limits
- Uses your existing Supabase and Vercel free tiers. No extra provider.
- ~150 bytes per event: 500 MB holds millions. Optional cleanup: see the last lines of `schema-v2.sql`.
- Stats read up to 50,000 events per request (the dashboard says so if truncated).
- API functions in `api/`: register, withdraw, track, admin/export, admin/session, admin/stats, admin/registrations (7).
- Vercel's free Hobby plan is for personal, non-commercial use.
