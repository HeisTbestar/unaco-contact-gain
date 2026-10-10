import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizeNigerianMobile } from '../src/lib/phone.ts';
import { MAX_ENTRIES, validateEntry } from '../src/lib/validation.ts';
import { buildVcf } from '../src/lib/vcf.ts';
import { createLimiter } from './rateLimit.ts';
import { BOT } from '../src/config/bot.ts';
import { listWithBot, type Store } from './store.ts';

export interface Deps { store: Store | null; env: { ADMIN_EXPORT_TOKEN?: string }; now?: () => number }

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export const clientIp = (req: Request) =>
  req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ??
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 4096) throw new Error('too_large');
  const v = JSON.parse(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('bad');
  return v as Record<string, unknown>;
}
const safeEqual = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function createHandlers({ store, env, now = Date.now }: Deps) {
  const regLimit = createLimiter(10, 3600_000, now);
  const wdLimit = createLimiter(10, 3600_000, now);
  const authFail = createLimiter(5, 900_000, now);
  const notConfigured = () => json(503, { error: 'This service is not configured yet.' });

  return {
    async register(req: Request) {
      if (!store) return notConfigured();
      if (!regLimit.take(clientIp(req))) return json(429, { error: 'Too many attempts. Please try again later.' });
      let body: Record<string, unknown>;
      try { body = await readJson(req); } catch (e) { return json((e as Error).message === 'too_large' ? 413 : 400, { error: 'Invalid request.' }); }
      if (typeof body.website === 'string' && body.website !== '') return json(200, { results: [] }); // honeypot: pretend success
      if (body.consent !== true) return json(400, { errors: { consent: 'Tick the box to agree to share your contact.' } });
      const entries = body.entries;
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_ENTRIES) return json(400, { errors: { form: `Add between 1 and ${MAX_ENTRIES} contacts.` } });
      const errors: Record<string, string> = {};
      const valid: { username: string; phone: string }[] = [];
      const seen = new Set<string>();
      entries.forEach((e, i) => {
        const o = (e ?? {}) as Record<string, unknown>;
        if (typeof o.username !== 'string' || typeof o.phone !== 'string') { errors[`${i}.phone`] = 'Invalid entry.'; return; }
        const r = validateEntry(o.username, o.phone);
        if (r.errors.username) errors[`${i}.username`] = r.errors.username;
        if (r.errors.phone) errors[`${i}.phone`] = r.errors.phone;
        else if (seen.has(r.phoneE164!)) errors[`${i}.phone`] = 'This number is entered twice.';
        else { seen.add(r.phoneE164!); valid.push({ username: r.username, phone: r.phoneE164! }); }
      });
      if (Object.keys(errors).length) return json(400, { errors });
      try {
        const results = [];
        for (const c of valid) results.push({ status: await store.insert(c) });
        return json(200, { results });
      } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
    },

    async withdraw(req: Request) {
      if (!store) return notConfigured();
      if (!wdLimit.take(clientIp(req))) return json(429, { error: 'Too many attempts. Please try again later.' });
      let body: Record<string, unknown>;
      try { body = await readJson(req); } catch { return json(400, { error: 'Invalid request.' }); }
      const p = typeof body.phone === 'string' ? normalizeNigerianMobile(body.phone) : { ok: false as const, error: 'Enter your phone number.' };
      if (!p.ok) return json(400, { error: p.error });
      try { if (p.e164 !== BOT.phoneE164) await store.remove(p.e164); } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
      return json(200, { message: 'If this number was registered, it has been removed.' }); // same answer either way
    },

    async exportVcf(req: Request) {
      const token = env.ADMIN_EXPORT_TOKEN;
      if (!store || !token || token.length < 24) return notConfigured();
      const ip = clientIp(req);
      if (authFail.blocked(ip)) return json(429, { error: 'Too many failed attempts. Try again later.' });
      const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '');
      if (!m || !safeEqual(m[1], token)) { authFail.take(ip); return json(401, { error: 'Not authorized.' }); }
      try {
        const rows = await listWithBot(store);
        const vcf = buildVcf(rows.map(r => ({ username: r.username, phoneE164: r.phone })));
        return new Response(vcf, { status: 200, headers: {
          'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'attachment; filename="unaco-contacts.vcf"',
          'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
      } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
    },
  };
}
