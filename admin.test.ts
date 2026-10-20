import { describe, it, expect } from 'vitest';
import { createHandlers } from './handlers.ts';
import { memoryStore } from './store.ts';
import { summarise, dayKey } from './analytics.ts';
import { COOKIE } from './auth.ts';

const PASS = 'p'.repeat(32);
const H = { 'x-requested-with': 'unaco-admin' };
const setup = (nowFn?: () => number) => { const store = memoryStore(); return { store, h: createHandlers({ store, env: { ADMIN_EXPORT_TOKEN: PASS }, now: nowFn }) }; };
const req = (method: string, url: string, o: { body?: unknown; ip?: string; cookie?: string; headers?: Record<string, string>; https?: boolean } = {}) =>
  new Request((o.https ? 'https://x.test' : 'http://x.test') + url, { method, headers: { 'x-real-ip': o.ip ?? '5.5.5.5', ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.headers ?? {}) },
    body: method === 'GET' || method === 'DELETE' ? undefined : JSON.stringify(o.body) });
async function login(h: ReturnType<typeof setup>['h'], https = false) {
  const r = await h.session(req('POST', '/s', { body: { passcode: PASS }, headers: H, https })); const c = r.headers.get('set-cookie')!;
  return { r, cookie: c.split(';')[0], raw: c };
}
const reg = (store: ReturnType<typeof memoryStore>, u: string, p: string) => store.insert({ username: u, phone: p });

describe('admin login & session', () => {
  it('wrong passcode: 401, no cookie', async () => { const { h } = setup(); const r = await h.session(req('POST', '/s', { body: { passcode: 'nope' }, headers: H })); expect(r.status).toBe(401); expect(r.headers.get('set-cookie')).toBeNull(); });
  it('right passcode: 200 with HttpOnly SameSite=Strict cookie scoped to the admin API; Secure on https', async () => {
    const { h } = setup(); const a = await login(h); expect(a.r.status).toBe(200);
    expect(a.raw).toMatch(/HttpOnly/); expect(a.raw).toMatch(/SameSite=Strict/); expect(a.raw).toMatch(/Path=\/api\/admin/); expect(a.raw).not.toMatch(/Secure/);
    expect((await login(h, true)).raw).toMatch(/Secure/);
  });
  it('the cookie value is a random token, never the passcode', async () => { const { cookie } = await login(setup().h); expect(cookie).not.toContain(PASS); expect(cookie.split('=')[1].length).toBeGreaterThanOrEqual(40); });
  it('login requires the CSRF header', async () => { const { h } = setup(); expect((await h.session(req('POST', '/s', { body: { passcode: PASS } }))).status).toBe(403); });
  it('locks out after 5 wrong attempts, even with the right passcode', async () => {
    const { h } = setup(); for (let i = 0; i < 5; i++) await h.session(req('POST', '/s', { body: { passcode: 'x' }, headers: H, ip: '9.9.9.9' }));
    expect((await h.session(req('POST', '/s', { body: { passcode: PASS }, headers: H, ip: '9.9.9.9' }))).status).toBe(429); });
  it('503 when passcode not configured or too short', async () => { for (const t of [undefined, 'short']) { const h = createHandlers({ store: memoryStore(), env: { ADMIN_EXPORT_TOKEN: t } }); expect((await h.session(req('POST', '/s', { body: { passcode: 'x' }, headers: H }))).status).toBe(503); } });
  it('logout invalidates the session server-side (the old cookie stops working)', async () => {
    const { h } = setup(); const { cookie } = await login(h); expect((await h.stats(req('GET', '/x', { cookie }))).status).toBe(200);
    const out = await h.session(req('DELETE', '/s', { cookie, headers: H })); expect(out.status).toBe(200); expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await h.stats(req('GET', '/x', { cookie }))).status).toBe(401); });
  it('sessions expire after 8 hours', async () => {
    let t = 1_000_000_000_000; const { h } = setup(() => t); const { cookie } = await login(h);
    t += 7 * 3600_000; expect((await h.stats(req('GET', '/x', { cookie }))).status).toBe(200); t += 2 * 3600_000; expect((await h.stats(req('GET', '/x', { cookie }))).status).toBe(401); });
  it('a forged or guessed cookie is rejected', async () => { const { h } = setup(); await login(h); expect((await h.stats(req('GET', '/x', { cookie: `${COOKIE}=${'a'.repeat(43)}` }))).status).toBe(401); });
});

describe('protected endpoints leak nothing without a session', () => {
  it.each([['stats', 'GET'], ['registrations', 'GET'], ['registrations', 'PATCH'], ['registrations', 'DELETE']] as const)('%s %s -> 401', async (fn, m) => {
    const { h, store } = setup(); await reg(store, 'Secret', '+2347024830789');
    const r = await h[fn](req(m, '/x?id=11111111-1111-4111-8111-111111111111', { body: { id: '11111111-1111-4111-8111-111111111111', username: 'Evil' }, headers: H }));
    expect(r.status).toBe(401); expect(await r.text()).not.toMatch(/Secret|\+234/); });
  it('the Bearer passcode alone does NOT open the dashboard endpoints', async () => {
    const { h } = setup(); expect((await h.stats(req('GET', '/x', { headers: { authorization: `Bearer ${PASS}` } }))).status).toBe(401); });
  it('export still accepts the Bearer passcode, and also a session cookie', async () => {
    const { h } = setup(); expect((await h.exportVcf(req('GET', '/e', { headers: { authorization: `Bearer ${PASS}` } }))).status).toBe(200);
    const { cookie } = await login(h); expect((await h.exportVcf(req('GET', '/e', { cookie }))).status).toBe(200);
    expect((await h.exportVcf(req('GET', '/e'))).status).toBe(401); });
});

describe('registration management', () => {
  async function seeded() {
    const s = setup(); for (const [u, p] of [['Zara', '+2347024830789'], ['Ada', '+2348031234567'], ['Bola', '+2349012345678']]) { await reg(s.store, u, p); await new Promise(r => setTimeout(r, 3)); }
    return { ...s, cookie: (await login(s.h)).cookie }; }
  const list = async (s: Awaited<ReturnType<typeof seeded>>, qs = '') => (await s.h.registrations(req('GET', '/r' + qs, { cookie: s.cookie }))).json();
  it('lists real fields, newest first by default', async () => { const s = await seeded(); const d = await list(s); expect(d.total).toBe(3); expect(d.rows.map((r: { username: string }) => r.username)).toEqual(['Bola', 'Ada', 'Zara']);
    expect(Object.keys(d.rows[0]).sort()).toEqual(['consentedAt', 'createdAt', 'id', 'phone', 'username']); });
  it('search by username or phone digits', async () => { const s = await seeded(); expect((await list(s, '?q=ada')).total).toBe(1); expect((await list(s, '?q=0803 123')).rows.map((r: { username: string }) => r.username)).toEqual(['Ada']); expect((await list(s, '?q=803123')).rows[0].username).toBe('Ada'); expect((await list(s, '?q=%2B234803')).total).toBe(1); });
  it('a text query containing digits matches usernames only, never phone numbers (regression)', async () => { const s = await seeded(); await reg(s.store, 'Tester2', '+2347000000000'); expect((await list(s, '?q=tester2')).rows.map((r: { username: string }) => r.username)).toEqual(['Tester2']); expect((await list(s, '?q=zara7')).total).toBe(0); });
  it('sort and paginate', async () => { const s = await seeded(); expect((await list(s, '?sort=username&dir=asc')).rows.map((r: { username: string }) => r.username)).toEqual(['Ada', 'Bola', 'Zara']);
    const p = await list(s, '?sort=username&dir=asc&pageSize=2&page=2'); expect(p.rows).toHaveLength(1); expect(p.total).toBe(3); expect(p.rows[0].username).toBe('Zara'); });
  it('edit username: validated, reserved name blocked, no CSRF header = 403', async () => {
    const s = await seeded(); const id = (await list(s)).rows[0].id;
    const patch = (body: unknown, headers: Record<string, string> = H) => s.h.registrations(req('PATCH', '/r', { cookie: s.cookie, body, headers }));
    expect((await patch({ id, username: 'Newname' })).status).toBe(200); expect((await list(s)).rows[0].username).toBe('Newname');
    expect((await patch({ id, username: 'Bad ☕' })).status).toBe(400); expect((await patch({ id, username: 'UNACO BOT' })).status).toBe(400);
    expect((await patch({ id: 'not-a-uuid', username: 'Fine' })).status).toBe(400); expect((await patch({ id, username: 'Fine' }, {})).status).toBe(403); });
  it('delete: confirm-by-id, CSRF required, removes from the next export, 404 when already gone', async () => {
    const s = await seeded(); const id = (await list(s)).rows[0].id; const del = (headers: Record<string, string> = H) => s.h.registrations(req('DELETE', `/r?id=${id}`, { cookie: s.cookie, headers }));
    expect((await del({})).status).toBe(403); expect((await list(s)).total).toBe(3);
    expect((await del()).status).toBe(200); expect((await list(s)).total).toBe(2); expect((await del()).status).toBe(404);
    expect(await (await s.h.exportVcf(req('GET', '/e', { cookie: s.cookie }))).text()).not.toContain('Bola'); });
  it('does not touch other registrations', async () => { const s = await seeded(); const id = (await list(s)).rows[0].id; await s.h.registrations(req('DELETE', `/r?id=${id}`, { cookie: s.cookie, headers: H })); expect(s.store.rows.size).toBe(2); });
});

describe('tracking endpoint', () => {
  const ev = (body: unknown, headers: Record<string, string> = {}, ip = '7.7.7.7') => req('POST', '/t', { body, ip, headers: { 'user-agent': 'Mozilla/5.0 Chrome', ...headers } });
  const SID = 'abcdefghijklmnop';
  it('stores an allow-listed event with coarse geo from Vercel headers and nothing personal', async () => {
    const { h, store } = setup(); const r = await h.track(ev({ type: 'click', target: 'header_channel', path: '/', session: SID }, { 'x-vercel-ip-country': 'NG', 'x-vercel-ip-city': 'Osogbo', 'x-vercel-ip-country-region': 'OS' }));
    expect(r.status).toBe(204); expect(store.events).toHaveLength(1);
    expect(Object.keys(store.events[0]).sort()).toEqual(['city', 'country', 'createdAt', 'path', 'referrer', 'region', 'session', 'target', 'type']); // no ip, no user agent
    expect(store.events[0]).toMatchObject({ country: 'NG', city: 'Osogbo', region: 'OS', target: 'header_channel' }); });
  it('decodes URL-encoded city names', async () => { const { h, store } = setup(); await h.track(ev({ type: 'pageview', path: '/', session: SID }, { 'x-vercel-ip-city': 'S%C3%A3o%20Paulo' })); expect(store.events[0].city).toBe('São Paulo'); });
  it.each([
    [{ type: 'hack', path: '/', session: SID }], [{ type: 'click', target: 'free_text_target', path: '/', session: SID }], [{ type: 'click', path: '/', session: SID }],
    [{ type: 'pageview', target: 'x', path: '/', session: SID }], [{ type: 'form_error', target: 'my phone is 0702', path: '/', session: SID }],
    [{ type: 'pageview', path: '/?q=1', session: SID }], [{ type: 'pageview', path: '/', session: 'short' }], [{ type: 'pageview', path: '/', session: 'bad chars!!!!!!!!!!!' }],
  ])('rejects invalid event %#', async b => { const { h, store } = setup(); expect((await h.track(ev(b))).status).toBe(400); expect(store.events).toHaveLength(0); });
  it('ignores bots and link-preview crawlers (204, nothing stored)', async () => {
    const { h, store } = setup(); for (const ua of ['Googlebot/2.1', 'WhatsApp/2.23', 'facebookexternalhit/1.1', 'HeadlessChrome/120']) expect((await h.track(ev({ type: 'pageview', path: '/', session: SID }, { 'user-agent': ua }))).status).toBe(204);
    expect(store.events).toHaveLength(0); });
  it('drops junk geo headers and unsafe referrers', async () => { const { h, store } = setup(); await h.track(ev({ type: 'pageview', path: '/', session: SID, ref: 'evil.com/<script>' }, { 'x-vercel-ip-country': 'nigeria', 'x-vercel-ip-city': '<b>x</b>' }));
    expect(store.events[0]).toMatchObject({ country: null, city: null, referrer: null }); });
  it('keeps a valid referrer host on page views', async () => { const { h, store } = setup(); await h.track(ev({ type: 'pageview', path: '/', session: SID, ref: 'WhatsApp.com' })); expect(store.events[0].referrer).toBe('whatsapp.com'); });
  it('rejects oversized bodies and rate limits per IP', async () => {
    const { h } = setup(); expect((await h.track(ev({ type: 'pageview', path: '/', session: SID, pad: 'a'.repeat(2000) }))).status).toBe(413);
    let last = 0; for (let i = 0; i < 125; i++) last = (await h.track(ev({ type: 'pageview', path: '/', session: SID }, {}, '8.8.4.4'))).status; expect(last).toBe(429); });
});

describe('stats aggregation', () => {
  const T = Date.parse('2026-10-20T12:00:00Z');
  const e = (iso: string, session: string, type: string, extra: Partial<{ target: string; country: string; city: string; referrer: string }> = {}) =>
    ({ type, target: extra.target ?? null, path: '/', session, country: extra.country ?? null, region: null, city: extra.city ?? null, referrer: extra.referrer ?? null, createdAt: iso });
  const reg = (iso: string, name: string) => ({ id: name, username: name, phone: '+234', consentedAt: iso, createdAt: iso });
  it('no events: trackingSince null and conversion null (unavailable, not zero)', () => {
    const s = summarise({ events: [], registrations: [reg('2026-10-19T10:00:00Z', 'A')], fromDay: '2026-10-14', toDay: '2026-10-20', now: T, trackingSince: null });
    expect(s.trackingSince).toBeNull(); expect(s.totals.conversion).toBeNull(); expect(s.totals.registrationsAllTime).toBe(1); expect(s.series.every(d => d.tracked === false)).toBe(true); });
  it('counts visits as distinct sessions, pageviews, conversion, funnel, clicks, referrers, locations', () => {
    const events = [e('2026-10-20T08:00:00Z', 's1', 'pageview', { country: 'NG', city: 'Osogbo', referrer: 'whatsapp.com' }), e('2026-10-20T08:01:00Z', 's1', 'click', { target: 'cta_add_contact' }),
      e('2026-10-20T08:02:00Z', 's1', 'form_start'), e('2026-10-20T08:03:00Z', 's1', 'form_success'),
      e('2026-10-20T09:00:00Z', 's2', 'pageview', { country: 'NG', city: 'Lagos' }), e('2026-10-20T09:01:00Z', 's2', 'click', { target: 'cta_add_contact' }), e('2026-10-20T09:02:00Z', 's2', 'form_error', { target: 'validation' }),
      e('2026-10-20T10:00:00Z', 's3', 'pageview', { country: 'GH' })];
    const s = summarise({ events, registrations: [reg('2026-10-20T08:03:00Z', 'A')], fromDay: '2026-10-20', toDay: '2026-10-20', now: T, trackingSince: Date.parse('2026-10-20T08:00:00Z') });
    expect(s.totals).toMatchObject({ visits: 3, pageviews: 3, registrationsInRange: 1 }); expect(s.totals.conversion).toBeCloseTo(1 / 3);
    expect(s.funnel).toEqual({ visits: 3, formStarts: 1, formSuccess: 1, errors: { validation: 1 } });
    expect(s.topClicks).toEqual([{ target: 'cta_add_contact', count: 2 }]); expect(s.referrers).toEqual(expect.arrayContaining([{ referrer: 'whatsapp.com', count: 1 }, { referrer: '(direct)', count: 2 }]));
    expect(s.locations.countries).toEqual(expect.arrayContaining([{ code: 'NG', count: 2 }, { code: 'GH', count: 1 }])); expect(s.locations.cities[0]).toMatchObject({ count: 1 }); });
  it('buckets days in Lagos time (UTC+1): 23:30Z belongs to the next day', () => {
    expect(dayKey(Date.parse('2026-10-19T23:30:00Z'))).toBe('2026-10-20');
    const s = summarise({ events: [e('2026-10-19T23:30:00Z', 's1', 'pageview')], registrations: [], fromDay: '2026-10-19', toDay: '2026-10-20', now: T, trackingSince: 1 });
    expect(s.series.map(d => [d.date, d.visits])).toEqual([['2026-10-19', 0], ['2026-10-20', 1]]); });
  it('marks days before tracking began as not tracked', () => {
    const s = summarise({ events: [e('2026-10-19T10:00:00Z', 's1', 'pageview')], registrations: [], fromDay: '2026-10-17', toDay: '2026-10-20', now: T, trackingSince: Date.parse('2026-10-19T10:00:00Z') });
    expect(s.series.map(d => d.tracked)).toEqual([false, false, true, true]); expect(s.trackingSince).toBe('2026-10-19T10:00:00.000Z'); });
  it('today / week / month periods', () => {
    const events = [e('2026-10-20T08:00:00Z', 'a', 'pageview'), e('2026-10-15T08:00:00Z', 'b', 'pageview'), e('2026-10-02T08:00:00Z', 'c', 'pageview'), e('2026-09-01T08:00:00Z', 'd', 'pageview')];
    const s = summarise({ events, registrations: [reg('2026-10-20T08:00:00Z', 'x'), reg('2026-10-10T08:00:00Z', 'y')], fromDay: '2026-10-20', toDay: '2026-10-20', now: T, trackingSince: 1 });
    expect(s.periods.visits).toEqual({ today: 1, week: 2, month: 3 }); expect(s.periods.registrations).toEqual({ today: 1, week: 1, month: 2 }); });
  it('never includes phone numbers in the summary', () => { const s = summarise({ events: [], registrations: [{ ...reg('2026-10-20T08:00:00Z', 'A'), phone: '+2347024830789' }], fromDay: '2026-10-20', toDay: '2026-10-20', now: T, trackingSince: 1 }); expect(JSON.stringify(s)).not.toContain('+234702'); });
});

describe('stats endpoint input handling', () => {
  it('rejects malformed or oversized ranges; accepts valid', async () => {
    const { h } = setup(); const { cookie } = await login(h); const st = (qs: string) => h.stats(req('GET', '/x' + qs, { cookie }));
    expect((await st('?from=bad&to=2026-10-20')).status).toBe(400); expect((await st('?from=2026-10-21&to=2026-10-20')).status).toBe(400); expect((await st('?from=2024-01-01&to=2026-10-20')).status).toBe(400);
    expect((await st('?from=2026-10-01&to=2026-10-20')).status).toBe(200); expect((await st('')).status).toBe(200); });
});
