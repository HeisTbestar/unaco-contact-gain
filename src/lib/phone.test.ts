import { describe, it, expect } from 'vitest';
import { normalizeNigerianMobile as n } from './phone';
const E = '+2347024830789';
describe('phone', () => {
  it.each(['08162008307','2348162008307','+2348162008307'])('accepts bot number %s', v => expect(n(v)).toEqual({ ok: true, e164: '+2348162008307' }));
  it.each(['07024830789','2347024830789','+2347024830789','  07024830789  ','0702 483 0789','+234-702-483-0789'])('accepts %s', v => expect(n(v)).toEqual({ ok: true, e164: E }));
  it.each(['', '   ', '0702483078', '070248307890', '2340702483078', '+2340702483078', '7024830789', '+1 415 555 2671', '0702483O789', 'abc', '07024830789+', '++2347024830789', '1234567890', '0102483078', '23407024830789'])('rejects %s', v => expect(n(v).ok).toBe(false));
  it('is idempotent for duplicates', () => expect(n('07024830789')).toEqual(n('+2347024830789')));
});
