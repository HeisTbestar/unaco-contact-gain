import { BOT } from '../src/config/bot.ts';

export interface Contact { username: string; phone: string }
export interface Registration { id: string; username: string; phone: string; consentedAt: string; createdAt: string }
export interface EventRow { type: string; target: string | null; path: string; session: string; country: string | null; region: string | null; city: string | null; referrer: string | null; createdAt: string }
export type NewEvent = Omit<EventRow, 'createdAt'>;
export interface Store {
  insert(c: Contact): Promise<'added' | 'exists'>;
  remove(phone: string): Promise<void>;
  list(): Promise<Contact[]>;
  listRegistrations(): Promise<Registration[]>;
  updateUsername(id: string, username: string): Promise<boolean>;
  deleteById(id: string): Promise<boolean>;
  insertEvent(e: NewEvent): Promise<void>;
  listEvents(sinceMs: number, untilMs: number, cap: number): Promise<{ rows: EventRow[]; truncated: boolean }>;
  firstEventAt(): Promise<string | null>;
  createSession(hash: string, expiresAt: number): Promise<void>;
  sessionValid(hash: string, now: number): Promise<boolean>;
  deleteSession(hash: string): Promise<void>;
}

export function memoryStore() {
  const rows = new Map<string, string>(); // phone -> username (tests read this directly)
  const meta = new Map<string, { id: string; at: string }>();
  const events: EventRow[] = [];
  const sessions = new Map<string, number>();
  const store: Store & { rows: Map<string, string>; events: EventRow[] } = {
    rows, events,
    async insert(c) { if (rows.has(c.phone)) return 'exists'; rows.set(c.phone, c.username); meta.set(c.phone, { id: crypto.randomUUID(), at: new Date().toISOString() }); return 'added'; },
    async remove(phone) { rows.delete(phone); meta.delete(phone); },
    async list() { return [...rows].map(([phone, username]) => ({ phone, username })); },
    async listRegistrations() {
      return [...rows].map(([phone, username]) => { const m = meta.get(phone) ?? { id: `mem-${phone}`, at: new Date(0).toISOString() };
        return { id: m.id, username, phone, consentedAt: m.at, createdAt: m.at }; });
    },
    async updateUsername(id, username) { for (const [phone, m] of meta) if (m.id === id) { rows.set(phone, username); return true; } return false; },
    async deleteById(id) { for (const [phone, m] of meta) if (m.id === id) { rows.delete(phone); meta.delete(phone); return true; } return false; },
    async insertEvent(e) { events.push({ ...e, createdAt: new Date().toISOString() }); },
    async listEvents(since, until, cap) {
      const all = events.filter(e => { const t = Date.parse(e.createdAt); return t >= since && t < until; }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { rows: all.slice(0, cap), truncated: all.length > cap };
    },
    async firstEventAt() { return events.length ? [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt : null; },
    async createSession(hash, expiresAt) { sessions.set(hash, expiresAt); },
    async sessionValid(hash, now) { const e = sessions.get(hash); return e !== undefined && e > now; },
    async deleteSession(hash) { sessions.delete(hash); },
  };
  return store;
}

/** Supabase PostgREST via fetch. Uses the SERVICE ROLE key: server-side only, never ship to the browser. */
export function supabaseStore(url: string, serviceKey: string): Store {
  const root = url.replace(/\/$/, '') + '/rest/v1';
  const base = root + '/contacts';
  // Legacy service_role keys are JWTs (start with "eyJ") and also go in Authorization. New sb_secret_ keys are not JWTs: apikey header only.
  const h: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) h.Authorization = `Bearer ${serviceKey}`;
  const check = (r: Response) => { if (!r.ok) throw new Error(`store_${r.status}`); return r; };
  const enc = encodeURIComponent;
  async function fetchAll<T>(query: string, cap = 100_000): Promise<{ rows: T[]; truncated: boolean }> {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const r = check(await fetch(`${root}/${query}`, { headers: { ...h, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } }));
      const page = (await r.json()) as T[]; out.push(...page);
      if (page.length < 1000) return { rows: out, truncated: false };
      if (out.length >= cap) return { rows: out, truncated: true };
    }
  }
  type RegRow = { id: string; username: string; phone_e164: string; consented_at: string; created_at: string };
  type EvRow = { type: string; target: string | null; path: string; session: string; country: string | null; region: string | null; city: string | null; referrer: string | null; created_at: string };
  const ret = { ...h, Prefer: 'return=representation' };
  return {
    async insert(c) {
      const r = check(await fetch(`${base}?on_conflict=phone_e164`, {
        method: 'POST', headers: { ...h, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ username: c.username, phone_e164: c.phone }),
      }));
      return (await r.json()).length ? 'added' : 'exists';
    },
    async remove(phone) { check(await fetch(`${base}?phone_e164=eq.${enc(phone)}`, { method: 'DELETE', headers: h })); },
    async list() {
      const { rows } = await fetchAll<{ username: string; phone_e164: string }>('contacts?select=username,phone_e164&order=created_at.asc');
      return rows.map(p => ({ username: p.username, phone: p.phone_e164 }));
    },
    async listRegistrations() {
      const { rows } = await fetchAll<RegRow>('contacts?select=id,username,phone_e164,consented_at,created_at&order=created_at.desc');
      return rows.map(r => ({ id: r.id, username: r.username, phone: r.phone_e164, consentedAt: r.consented_at, createdAt: r.created_at }));
    },
    async updateUsername(id, username) {
      const r = check(await fetch(`${base}?id=eq.${enc(id)}`, { method: 'PATCH', headers: ret, body: JSON.stringify({ username }) }));
      return (await r.json()).length > 0;
    },
    async deleteById(id) { const r = check(await fetch(`${base}?id=eq.${enc(id)}`, { method: 'DELETE', headers: ret })); return (await r.json()).length > 0; },
    async insertEvent(e) {
      check(await fetch(`${root}/analytics_events`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(e) }));
    },
    async listEvents(since, until, cap) {
      const q = `analytics_events?select=type,target,path,session,country,region,city,referrer,created_at&created_at=gte.${enc(new Date(since).toISOString())}&created_at=lt.${enc(new Date(until).toISOString())}&order=created_at.asc`;
      const { rows, truncated } = await fetchAll<EvRow>(q, cap);
      return { truncated, rows: rows.map(r => ({ type: r.type, target: r.target, path: r.path, session: r.session, country: r.country, region: r.region, city: r.city, referrer: r.referrer, createdAt: r.created_at })) };
    },
    async firstEventAt() {
      const r = check(await fetch(`${root}/analytics_events?select=created_at&order=created_at.asc&limit=1`, { headers: h }));
      const a = (await r.json()) as { created_at: string }[]; return a[0]?.created_at ?? null;
    },
    async createSession(hash, expiresAt) {
      check(await fetch(`${root}/admin_sessions?expires_at=lt.${enc(new Date().toISOString())}`, { method: 'DELETE', headers: h })); // housekeeping
      check(await fetch(`${root}/admin_sessions`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ token_hash: hash, expires_at: new Date(expiresAt).toISOString() }) }));
    },
    async sessionValid(hash, now) {
      const r = check(await fetch(`${root}/admin_sessions?select=token_hash&token_hash=eq.${enc(hash)}&expires_at=gt.${enc(new Date(now).toISOString())}`, { headers: h }));
      return ((await r.json()) as unknown[]).length > 0;
    },
    async deleteSession(hash) { check(await fetch(`${root}/admin_sessions?token_hash=eq.${enc(hash)}`, { method: 'DELETE', headers: h })); },
  };
}

/** Always returns the built-in bot first, then stored contacts (a stored row for the bot number is ignored). */
export async function listWithBot(store: Store): Promise<Contact[]> {
  const rows = await store.list();
  return [{ username: BOT.username, phone: BOT.phoneE164 }, ...rows.filter(r => r.phone !== BOT.phoneE164)];
}
