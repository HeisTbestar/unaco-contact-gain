# Deploy (Vercel + Supabase, both free tier)
1. Supabase: create a project, run `docs/schema.sql` in the SQL editor. Copy the project URL and the **service_role** key (Settings > API).
2. Vercel: import the repo. Set env vars from `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EXPORT_TOKEN`). Generate the token with `openssl rand -base64 32`.
3. Deploy, open `/#admin`, paste the token to download `unaco-contacts.vcf`, then post it in the WhatsApp group.
4. Copy the security headers from `public/_headers` into `vercel.json` (Vercel ignores `_headers`).
Local: `ADMIN_EXPORT_TOKEN=<24+ chars> npm run dev:api` and `npm run dev` (in-memory data).
Limits: rate limiting is per serverless instance (best effort). Add Vercel/Cloudflare firewall rate limits before launch. Backups: Supabase free tier has none; export the VCF regularly.
Retention: keep records until the owner deletes them or a person withdraws; delete all after the campaign ends.
