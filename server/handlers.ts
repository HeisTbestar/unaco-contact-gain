import { createHash, timingSafeEqual } from 'node:crypto';
import { CLICK_TARGETS, FORM_ERROR_TARGETS, TRACK_TYPES } from '../src/config/track.ts';
import { COOKIE, SESSION_MS, newToken, parseCookie, sessionCookie, sha256 } from './auth.ts';
import { DAY, dayKey, dayStart, isDay, summarise } from './analytics.ts';
import { normalizeNigerianMobile } from '../src/lib/phone.ts';
import { MAX_ENTRIES, validateEntry, validateUsername } from '../src/lib/validation.ts';
import { buildVcf } from '../src/lib/vcf.ts';
import { createLimiter } from './rateLimit.ts';
import { BOT } from '../src/config/bot.ts';
import { listWithBot, type Store } from './store.ts';

export interface Deps { store: Store | null; env: { ADMIN_EXPORT_TOKEN?: string }; now?: () => number }

const json = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });

export const clientIp = (req: Request) =>
  req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ??
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

async function readJson(req: Request, max = 4096): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > max) throw new Error('too_large');
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
  const trackLimit = createLimiter(120, 60_000, now);
  const adminLimit = createLimiter(300, 60_000, now);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const configured = () => !!store && !!env.ADMIN_EXPORT_TOKEN && env.ADMIN_EXPORT_TOKEN.length >= 24;
  const isSecure = (req: Request) => new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  /** Server-side session check: the cookie holds a random token, the database holds only its SHA-256 hash. */
  const hasSession = async (req: Request) => {
    const tok = parseCookie(req.headers.get('cookie'), COOKIE);
    return !!tok && !!store && store.sessionValid(sha256(tok), now());
  };
  /** Custom header cannot be set by a cross-site form or image; with SameSite=Strict this blocks CSRF on state-changing calls. */
  const csrfOk = (req: Request) => req.headers.get('x-requested-with') === 'unaco-admin';
  const unauth = () => json(401, { error: 'Not authorized.' });
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
      const viaToken = !!m && safeEqual(m[1], token);
      if (!viaToken) {
        if (req.headers.get('authorization')) authFail.take(ip); // only wrong token attempts count toward the lockout
        if (!(await hasSession(req))) return json(401, { error: 'Not authorized.' });
      }
      try {
        const rows = await listWithBot(store);
        const vcf = buildVcf(rows.map(r => ({ username: r.username, phoneE164: r.phone })));
        return new Response(vcf, { status: 200, headers: {
          'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': 'attachment; filename="unaco-contacts.vcf"',
          'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
      } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
    },

    /** POST = log in with the admin passcode, DELETE = log out. */
    async session(req: Request) {
      if (!configured()) return notConfigured();
      if (!csrfOk(req)) return json(403, { error: 'Forbidden.' });
      if (req.method === 'DELETE') {
        const tok = parseCookie(req.headers.get('cookie'), COOKIE);
        try { if (tok) await store!.deleteSession(sha256(tok)); } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
        return json(200, { ok: true }, { 'Set-Cookie': sessionCookie('', isSecure(req), 0) });
      }
      if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
      const ip = clientIp(req);
      if (authFail.blocked(ip)) return json(429, { error: 'Too many failed attempts. Try again later.' });
      let body: Record<string, unknown>;
      try { body = await readJson(req, 1024); } catch { return json(400, { error: 'Invalid request.' }); }
      if (typeof body.passcode !== 'string' || !safeEqual(body.passcode, env.ADMIN_EXPORT_TOKEN!)) { authFail.take(ip); return json(401, { error: 'Wrong passcode.' }); }
      const token = newToken();
      try { await store!.createSession(sha256(token), now() + SESSION_MS); } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
      return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(token, isSecure(req), SESSION_MS / 1000) });
    },

    async stats(req: Request) {
      if (!configured()) return notConfigured();
      if (!(await hasSession(req))) return unauth();
      if (!adminLimit.take(clientIp(req))) return json(429, { error: 'Too many requests.' });
      const u = new URL(req.url); const t = now();
      const toDay = u.searchParams.get('to') ?? dayKey(t);
      const fromDay = u.searchParams.get('from') ?? dayKey(t - 29 * DAY);
      if (!isDay(fromDay) || !isDay(toDay) || fromDay > toDay) return json(400, { error: 'Invalid date range.' });
      if ((dayStart(toDay) - dayStart(fromDay)) / DAY > 366) return json(400, { error: 'Range too long (max 366 days).' });
      try {
        const since = Math.min(dayStart(fromDay), t - 31 * DAY), until = Math.max(dayStart(toDay) + DAY, t + 1);
        const [regs, ev, first] = await Promise.all([store!.listRegistrations(), store!.listEvents(since, until, 50_000), store!.firstEventAt()]);
        return json(200, { ...summarise({ events: ev.rows, registrations: regs, fromDay, toDay, now: t, trackingSince: first ? Date.parse(first) : null, truncated: ev.truncated }), generatedAt: new Date(t).toISOString() });
      } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
    },

    /** GET list/search/sort/paginate, PATCH edit username, DELETE remove one registration. */
    async registrations(req: Request) {
      if (!configured()) return notConfigured();
      if (!(await hasSession(req))) return unauth();
      if (!adminLimit.take(clientIp(req))) return json(429, { error: 'Too many requests.' });
      const u = new URL(req.url);
      try {
        if (req.method === 'GET') {
          const q = (u.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 40);
          // Only a purely numeric query (digits, +, spaces, dashes) is matched against phone numbers; local 0803… matches +234803…
          const qd = /^[\d\s+()-]+$/.test(q) ? q.replace(/\D/g, '').replace(/^0/, '') : '';
          const sort = ['created', 'username', 'phone'].includes(u.searchParams.get('sort') ?? '') ? u.searchParams.get('sort')! : 'created';
          const dir = u.searchParams.get('dir') === 'asc' ? 1 : -1;
          const page = Math.max(1, parseInt(u.searchParams.get('page') ?? '1', 10) || 1);
          const pageSize = Math.min(50, Math.max(1, parseInt(u.searchParams.get('pageSize') ?? '20', 10) || 20));
          const from = u.searchParams.get('from'), to = u.searchParams.get('to');
          if ((from && !isDay(from)) || (to && !isDay(to))) return json(400, { error: 'Invalid date.' });
          let rows = await store!.listRegistrations();
          if (q) rows = rows.filter(r => r.username.toLowerCase().includes(q) || (qd.length > 0 && r.phone.includes(qd)));
          if (from) rows = rows.filter(r => Date.parse(r.createdAt) >= dayStart(from));
          if (to) rows = rows.filter(r => Date.parse(r.createdAt) < dayStart(to) + DAY);
          const key = (r: (typeof rows)[number]) => (sort === 'username' ? r.username.toLowerCase() : sort === 'phone' ? r.phone : r.createdAt);
          rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
          return json(200, { total: rows.length, page, pageSize, rows: rows.slice((page - 1) * pageSize, page * pageSize) });
        }
        if (!csrfOk(req)) return json(403, { error: 'Forbidden.' });
        if (req.method === 'PATCH') {
          let body: Record<string, unknown>;
          try { body = await readJson(req, 1024); } catch { return json(400, { error: 'Invalid request.' }); }
          if (typeof body.id !== 'string' || !UUID.test(body.id) || typeof body.username !== 'string') return json(400, { error: 'Invalid request.' });
          const err = validateUsername(body.username); if (err) return json(400, { error: err });
          return (await store!.updateUsername(body.id, body.username.trim())) ? json(200, { ok: true }) : json(404, { error: 'Not found.' });
        }
        if (req.method === 'DELETE') {
          const id = u.searchParams.get('id') ?? '';
          if (!UUID.test(id)) return json(400, { error: 'Invalid request.' });
          return (await store!.deleteById(id)) ? json(200, { ok: true }) : json(404, { error: 'Not found.' });
        }
        return json(405, { error: 'Method not allowed.' });
      } catch { return json(500, { error: 'Something went wrong. Please try again.' }); }
    },

    /** Public, write-only. Accepts only allow-listed event names; stores no IP, no user agent, no free text. */
    async track(req: Request) {
      if (!store) return new Response(null, { status: 204 });
      if (/bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|lighthouse/i.test(req.headers.get('user-agent') ?? '')) return new Response(null, { status: 204 });
      if (!trackLimit.take(clientIp(req))) return json(429, { error: 'Too many requests.' });
      let b: Record<string, unknown>;
      try { b = await readJson(req, 1024); } catch (e) { return json((e as Error).message === 'too_large' ? 413 : 400, { error: 'Invalid request.' }); }
      const type = b.type, target = b.target ?? null;
      if (typeof type !== 'string' || !(TRACK_TYPES as readonly string[]).includes(type)) return json(400, { error: 'Invalid request.' });
      const okTarget = type === 'click' ? typeof target === 'string' && target in CLICK_TARGETS
        : type === 'form_error' ? typeof target === 'string' && target in FORM_ERROR_TARGETS : target === null;
      if (!okTarget) return json(400, { error: 'Invalid request.' });
      if (typeof b.session !== 'string' || !/^[A-Za-z0-9_-]{16,32}$/.test(b.session)) return json(400, { error: 'Invalid request.' });
      if (typeof b.path !== 'string' || !/^\/[A-Za-z0-9/_-]{0,40}$/.test(b.path)) return json(400, { error: 'Invalid request.' });
      const ref = typeof b.ref === 'string' && /^[a-z0-9.-]{1,80}$/i.test(b.ref) ? b.ref.toLowerCase() : null;
      const h = (n: string) => req.headers.get(n);
      let city: string | null = null;
      try { const c = decodeURIComponent(h('x-vercel-ip-city') ?? ''); city = /^[\p{L}\p{M} .'’-]{1,60}$/u.test(c) ? c : null; } catch { /* ignore */ }
      const country = /^[A-Z]{2}$/.test(h('x-vercel-ip-country') ?? '') ? h('x-vercel-ip-country') : null;
      const region = /^[A-Za-z0-9-]{1,10}$/.test(h('x-vercel-ip-country-region') ?? '') ? h('x-vercel-ip-country-region') : null;
      try { await store.insertEvent({ type, target: target as string | null, path: b.path, session: b.session, country, region, city, referrer: type === 'pageview' ? ref : null }); } catch { /* analytics must never break the site */ }
      return new Response(null, { status: 204 });
    },
  };
}
