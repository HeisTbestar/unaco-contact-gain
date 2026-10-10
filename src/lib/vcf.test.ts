import { describe, it, expect } from 'vitest';
import { displayName, buildVcf, escapeText, foldLine, vcfFilename } from './vcf';
const P = '+2347024830789';
describe('vcf', () => {
  it('has name+emoji+phone only, CRLF', () => {
    const v = buildVcf([{ username: 'Delvvin', phoneE164: P }]);
    expect(v).toBe('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Delvvin ☕\r\nN:Delvvin ☕;;;;\r\nTEL;TYPE=CELL:+2347024830789\r\nEND:VCARD\r\n');
    expect(v).not.toMatch(/EMAIL|ORG|TITLE|NOTE/);
  });
  it('escapes special characters', () => expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne'));
  it('folds long lines on character boundaries', () => {
    const l = foldLine('FN:' + '☕'.repeat(60));
    for (const p of l.split('\r\n')) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(76);
    expect(l.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe('FN:' + '☕'.repeat(60));
  });
  it('dedupes, skips malformed, empty set', () => {
    const v = buildVcf([{ username: 'A', phoneE164: P }, { username: 'B', phoneE164: P }, { username: '', phoneE164: P }, { username: 'C', phoneE164: '0702' }]);
    expect(v.match(/BEGIN:VCARD/g)).toHaveLength(1);
    expect(buildVcf([])).toBe('');
  });
  it('safe filenames', () => { expect(vcfFilename('../Dël vvin')).toBe('unaco-del-vvin.vcf'); expect(vcfFilename('☕')).toBe('unaco-contact.vcf'); });
  it('bot gets a blue heart, never a coffee; exact match only', () => {
    expect(displayName('UNACO BOT')).toBe('UNACO BOT \u{1F499}'); expect(displayName(' UNACO BOT ')).toBe('UNACO BOT \u{1F499}');
    expect(displayName('unaco bot')).toBe('unaco bot ☕'); expect(displayName('Delvvin')).toBe('Delvvin ☕');
    const v = buildVcf([{ username: 'UNACO BOT', phoneE164: '+2348162008307' }]); expect(v).toContain('FN:UNACO BOT \u{1F499}\r\n'); expect(v).not.toContain('☕');
  });
});
