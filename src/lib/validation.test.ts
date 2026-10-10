import { describe, it, expect } from 'vitest';
import { validateUsername as u, validateEntry } from './validation';
describe('validation', () => {
  it('usernames', () => { expect(u('Delvvin')).toBeNull(); expect(u('Ada_01')).toBeNull(); expect(u('')).toBeTruthy(); expect(u('a')).toBeTruthy(); expect(u('Bad ☕')).toBeTruthy(); expect(u('x;y')).toBeTruthy(); expect(u('a'.repeat(31))).toBeTruthy(); expect(u('a  b')).toBeTruthy(); });
  it('valid entry', () => { const r = validateEntry(' Ada ', '07024830789'); expect(r.errors).toEqual({}); expect(r.phoneE164).toBe('+2347024830789'); expect(r.username).toBe('Ada'); });
  it('bad phone', () => expect(validateEntry('Ada', '0702').errors.phone).toBeTruthy());
  it('reserves the bot username and number', () => {
    expect(u('UNACO BOT')).toBeTruthy(); expect(u('unaco bot')).toBeTruthy();
    expect(validateEntry('Ada', '08162008307').errors.phone).toBeTruthy(); expect(validateEntry('Ada', '+2348162008307').phoneE164).toBeUndefined();
  });
});
