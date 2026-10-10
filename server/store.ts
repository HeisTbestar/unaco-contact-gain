import { BOT } from '../src/config/bot.ts';

export interface Contact { username: string; phone: string }
export interface Store {
  insert(c: Contact): Promise<'added' | 'exists'>;
  remove(phone: string): Promise<void>;
  list(): Promise<Contact[]>;
}

export function memoryStore(): Store & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    async insert(c) { if (rows.has(c.phone)) return 'exists'; rows.set(c.phone, c.username); return 'added'; },
    async remove(phone) { rows.delete(phone); },
    async list() { return [...rows].map(([phone, username]) => ({ phone, username })); },
  };
}

/** Supabase PostgREST via fetch. Uses the SERVICE ROLE key: server-side only, never ship to the browser. */
export function supabaseStore(url: string, serviceKey: string): Store {
  const base = url.replace(/\/$/, '') + '/rest/v1/contacts';
  // Legacy service_role keys are JWTs (start with "eyJ") and also go in Authorization. New sb_secret_ keys are not JWTs: apikey header only.
  const h: Record<string, string> = { apikey: serviceKey, 'Content-Type': 'application/json' };
  if (serviceKey.startsWith('eyJ')) h.Authorization = `Bearer ${serviceKey}`;
  const check = (r: Response) => { if (!r.ok) throw new Error(`store_${r.status}`); return r; };
  return {
    async insert(c) {
      const r = check(await fetch(`${base}?on_conflict=phone_e164`, {
        method: 'POST', headers: { ...h, Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify({ username: c.username, phone_e164: c.phone }),
      }));
      return (await r.json()).length ? 'added' : 'exists';
    },
    async remove(phone) { check(await fetch(`${base}?phone_e164=eq.${encodeURIComponent(phone)}`, { method: 'DELETE', headers: h })); },
    async list() {
      const out: Contact[] = [];
      for (let from = 0; ; from += 1000) {
        const r = check(await fetch(`${base}?select=username,phone_e164&order=created_at.asc`, { headers: { ...h, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } }));
        const page = (await r.json()) as { username: string; phone_e164: string }[];
        out.push(...page.map(p => ({ username: p.username, phone: p.phone_e164 })));
        if (page.length < 1000) return out;
      }
    },
  };
}

/** Always returns the built-in bot first, then stored contacts (a stored row for the bot number is ignored). */
export async function listWithBot(store: Store): Promise<Contact[]> {
  const rows = await store.list();
  return [{ username: BOT.username, phone: BOT.phoneE164 }, ...rows.filter(r => r.phone !== BOT.phoneE164)];
}
