import { describe, it, expect } from 'vitest';
import { createHandlers } from './handlers.ts';
import { memoryStore } from './store.ts';
import { BOT } from '../src/config/bot.ts';
const TOKEN = 'x'.repeat(32);
const setup = (token: string | undefined = TOKEN, store = memoryStore()) => ({ store, h: createHandlers({ store, env: { ADMIN_EXPORT_TOKEN: token } }) });
const post = (body: unknown, ip = '1.1.1.1', raw?: string) => new Request('http://x/api', { method: 'POST', headers: { 'x-real-ip': ip }, body: raw ?? JSON.stringify(body) });
const ok = { consent: true, entries: [{ username: 'Delvvin', phone: '07024830789' }] };
const get = (auth?: string, ip = '2.2.2.2') => new Request('http://x/e', { headers: { 'x-real-ip': ip, ...(auth ? { authorization: auth } : {}) } });

describe('register', () => {
  it('stores a valid entry normalized', async () => { const { h, store } = setup(); const r = await h.register(post(ok)); expect(r.status).toBe(200); expect(store.rows.get('+2347024830789')).toBe('Delvvin'); });
  it('accepts up to 3 and rejects 4 or 0', async () => {
    const { h, store } = setup(); const e = (n: string) => ({ username: 'Ada' + n, phone: '0702483078' + n });
    expect((await h.register(post({ consent: true, entries: [e('1'), e('2'), e('3')] }))).status).toBe(200); expect(store.rows.size).toBe(3);
    expect((await h.register(post({ consent: true, entries: [e('1'), e('2'), e('3'), e('4')] }))).status).toBe(400);
    expect((await h.register(post({ consent: true, entries: [] }))).status).toBe(400);
  });
  it.each([undefined, false, 'true', 1, null])('refuses consent=%s and stores nothing', async c => { const { h, store } = setup(); const r = await h.register(post({ ...ok, consent: c })); expect(r.status).toBe(400); expect(store.rows.size).toBe(0); });
  it('rejects bad phone/username with field errors, stores nothing', async () => {
    const { h, store } = setup(); const r = await h.register(post({ consent: true, entries: [{ username: 'Good', phone: '07024830789' }, { username: 'Bad ☕', phone: '123' }] }));
    const b = await r.json(); expect(r.status).toBe(400); expect(b.errors['1.username']).toBeTruthy(); expect(b.errors['1.phone']).toBeTruthy(); expect(store.rows.size).toBe(0); });
  it('rejects same number twice in one submission (even in different formats)', async () => {
    const { h } = setup(); const r = await h.register(post({ consent: true, entries: [{ username: 'A1', phone: '07024830789' }, { username: 'B1', phone: '+2347024830789' }] })); expect(r.status).toBe(400); });
  it('duplicate across submissions returns exists, no overwrite', async () => {
    const { h, store } = setup(); await h.register(post(ok)); const r = await h.register(post({ consent: true, entries: [{ username: 'Other', phone: '2347024830789' }] }));
    expect((await r.json()).results[0].status).toBe('exists'); expect(store.rows.get('+2347024830789')).toBe('Delvvin'); });
  it('honeypot stores nothing', async () => { const { h, store } = setup(); await h.register(post({ ...ok, website: 'spam.com' })); expect(store.rows.size).toBe(0); });
  it('malformed / oversized bodies', async () => {
    const { h } = setup(); expect((await h.register(post(null, '3.3.3.3', '{not json'))).status).toBe(400);
    expect((await h.register(post(null, '3.3.3.4', JSON.stringify({ consent: true, entries: [], pad: 'a'.repeat(5000) })))).status).toBe(413); });
  it('rate limits per IP', async () => { const { h } = setup(); let last = 0; for (let i = 0; i < 11; i++) last = (await h.register(post(ok, '9.9.9.9'))).status; expect(last).toBe(429); });
  it('503 when store not configured', async () => { const h = createHandlers({ store: null, env: {} }); expect((await h.register(post(ok))).status).toBe(503); });
  it('store failure gives generic 500 with no internals', async () => {
    const store = { ...memoryStore(), insert: async () => { throw new Error('secret db detail'); } }; const r = await createHandlers({ store, env: {} }).register(post(ok)); expect(r.status).toBe(500); expect(await r.text()).not.toMatch(/secret/); });
});
describe('withdraw', () => {
  it('removes and gives identical answer whether or not it existed', async () => {
    const { h, store } = setup(); await h.register(post(ok));
    const a = await h.withdraw(post({ phone: '07024830789' })); const b = await h.withdraw(post({ phone: '07024830789' }));
    expect(store.rows.size).toBe(0); expect(await a.text()).toBe(await b.text()); });
  it('rejects invalid number', async () => { expect((await setup().h.withdraw(post({ phone: 'abc' }))).status).toBe(400); });
});
describe('admin export', () => {
  it('401 without/with wrong token, no data leaked', async () => {
    const { h } = setup(); await h.register(post(ok));
    for (const a of [undefined, 'Bearer nope', 'Basic ' + TOKEN, 'Bearer ']) { const r = await h.exportVcf(get(a)); expect(r.status).toBe(401); expect(await r.text()).not.toMatch(/\+234/); } });
  it('token in query string is not accepted', async () => { const { h } = setup(); expect((await h.exportVcf(new Request('http://x/e?token=' + TOKEN))).status).toBe(401); });
  it('503 if token unset or too short', async () => { expect((await setup('').h.exportVcf(get('Bearer a'))).status).toBe(503); expect((await setup('short').h.exportVcf(get('Bearer short'))).status).toBe(503); });
  it('returns VCF with name+phone only', async () => {
    const { h } = setup(); await h.register(post(ok)); const r = await h.exportVcf(get('Bearer ' + TOKEN)); const t = await r.text();
    expect(r.status).toBe(200); expect(r.headers.get('content-type')).toMatch(/text\/vcard/); expect(r.headers.get('cache-control')).toBe('no-store');
    expect(t.indexOf('UNACO BOT')).toBeLessThan(t.indexOf('Delvvin')); // bot is first
    expect(t).toContain('FN:UNACO BOT \u{1F499}\r\n'); expect(t).not.toContain('UNACO BOT ☕'); expect(t).toContain('TEL;TYPE=CELL:+2348162008307');
    expect(t).toContain('FN:Delvvin ☕\r\n'); expect(t).toContain('TEL;TYPE=CELL:+2347024830789'); expect(t).not.toMatch(/EMAIL|NOTE|ORG/); });
  it('withdrawn numbers are absent from next export', async () => {
    const { h } = setup(); await h.register(post(ok)); await h.withdraw(post({ phone: '07024830789' })); const r = await h.exportVcf(get('Bearer ' + TOKEN)); const t = await r.text(); expect(r.status).toBe(200); expect(t).not.toContain('Delvvin'); expect(t.match(/BEGIN:VCARD/g)).toHaveLength(1); });
  it('empty database still exports the bot', async () => { const r = await setup().h.exportVcf(get('Bearer ' + TOKEN)); const t = await r.text(); expect(r.status).toBe(200); expect(t).toContain('UNACO BOT'); });
  it('locks out after repeated failures even with correct token', async () => {
    const { h } = setup(); for (let i = 0; i < 5; i++) await h.exportVcf(get('Bearer bad', '8.8.8.8')); expect((await h.exportVcf(get('Bearer ' + TOKEN, '8.8.8.8'))).status).toBe(429); });
});

describe('bot protection', () => {
  it.each(['08162008307', '2348162008307', '+2348162008307'])('cannot register the bot number as %s', async n => {
    const { h, store } = setup(); const r = await h.register(post({ consent: true, entries: [{ username: 'Mallory', phone: n }] }));
    expect(r.status).toBe(400); expect(store.rows.size).toBe(0); });
  it.each(['UNACO BOT', 'unaco bot', 'Unaco Bot'])('cannot register username %s', async u => {
    const { h, store } = setup(); expect((await h.register(post({ consent: true, entries: [{ username: u, phone: '07024830789' }] }))).status).toBe(400); expect(store.rows.size).toBe(0); });
  it('withdrawing the bot number is a harmless no-op', async () => {
    const { h } = setup(); const r = await h.withdraw(post({ phone: '08162008307' })); expect(r.status).toBe(200);
    expect(await (await h.exportVcf(get('Bearer ' + TOKEN))).text()).toContain('UNACO BOT'); });
  it('a stored row for the bot number cannot override the bot entry or duplicate it', async () => {
    const store = memoryStore(); store.rows.set(BOT.phoneE164, 'Impostor'); const t = await (await setup(TOKEN, store).h.exportVcf(get('Bearer ' + TOKEN))).text();
    expect(t).not.toContain('Impostor'); expect(t.match(/BEGIN:VCARD/g)).toHaveLength(1); });
});
