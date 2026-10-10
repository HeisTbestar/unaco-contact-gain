# UNACO Contact Gain: handover (v0.1.0)

## Model
Combined contact file. Students register (1 to 3 own numbers, separate unticked consent). Only the owner can export `unaco-contacts.vcf` (name + ☕ and phone only) and posts it in the WhatsApp group. No email, no department stored. Eligibility is NOT verified and the site says so.

## Architecture
- `src/config/` links + brand (single source of truth). `src/lib/` phone, validation, vcf (shared by browser and server). `src/components/` UI.
- `server/handlers.ts` all API logic (Web Request/Response, host-neutral), `server/store.ts` Supabase and memory stores, `api/` thin Vercel adapters, `server/dev-server.ts` local only.
- Routes: POST `/api/register`, POST `/api/withdraw`, GET `/api/admin/export` (Bearer token). Page: `/#admin` owner download.
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EXPORT_TOKEN` (see `.env.example`). Schema: `docs/schema.sql`.

## Verified (actually run)
53 unit/API tests pass; production build passes; local HTTP run (register, duplicate, no-consent refusal, 401, export parsed with vobject, withdrawal removes from next export); no secrets or links outside config in source/bundle.

## NOT verified
Real Supabase; real deployment; browser/responsive (320 to 1440px); accessibility audit; Lighthouse; VCF import on real Android/iPhone; security headers in production; the UI rendered visually after the logo/email changes.

## Known issues
Bundle 124 KB gzip (phone library). Rate limits per instance. Removal not identity-verified. No terms page. Admin uses a shared token, not a login. Design polish (glass/clay accents) minimal. Supabase free tier has no backups.

## Cost
Supabase free + Vercel free: 0 at this scale (check current limits; free projects can pause when inactive).

## Integration into the main UNACO site
Mount `ContactGain` from `src/App.tsx` (or deploy on a subdomain such as contacts.<domain> first). Keep `server/` and `api/` as the backend; point the main site's links to `/#register`.
- 2026-10: UNACO BOT (08162008307, 💙) is always added first to the export; cannot be registered or withdrawn (see src/config/bot.ts).
