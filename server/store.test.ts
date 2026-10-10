import { describe, it, expect, vi, afterEach } from 'vitest';
import { supabaseStore } from './store.ts';
const calls: { url: string; init: RequestInit }[] = [];
const mock = (body: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); }));
afterEach(() => { vi.unstubAllGlobals(); calls.length = 0; });
describe('supabaseStore', () => {
  it('insert: added vs exists (ignore-duplicates returns [])', async () => {
    mock([{ id: 1 }]); expect(await supabaseStore('https://x.supabase.co/', 'k').insert({ username: 'Ada', phone: '+2347024830789' })).toBe('added');
    mock([]); expect(await supabaseStore('https://x.supabase.co', 'k').insert({ username: 'Ada', phone: '+2347024830789' })).toBe('exists');
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/contacts?on_conflict=phone_e164');
  });
  it('sb_secret_ key: apikey only. JWT key: also Authorization', async () => {
    mock([]); await supabaseStore('https://x.supabase.co', 'sb_secret_abc').remove('+2347024830789');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined(); expect((calls[0].init.headers as Record<string, string>).apikey).toBe('sb_secret_abc');
    mock([]); await supabaseStore('https://x.supabase.co', 'eyJhbGciOi.x.y').remove('+2347024830789'); expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer eyJhbGciOi.x.y');
  });
  it('remove encodes the phone; list pages and maps rows; errors throw', async () => {
    mock([]); await supabaseStore('https://x.supabase.co', 'k').remove('+2347024830789'); expect(calls[0].url).toContain('phone_e164=eq.%2B2347024830789');
    mock([{ username: 'A1', phone_e164: '+2347024830789' }]); expect(await supabaseStore('https://x.supabase.co', 'k').list()).toEqual([{ username: 'A1', phone: '+2347024830789' }]);
    mock({ message: 'secret detail' }, 401); await expect(supabaseStore('https://x.supabase.co', 'k').list()).rejects.toThrow('store_401');
  });
});
