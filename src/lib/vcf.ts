import { BOT } from '../config/bot.ts';

export interface VcfContact { username: string; phoneE164: string }

export const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Fold at 75 octets (UTF-8) without splitting a character, per RFC 2425/6350. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** Users get ☕. Only the exact built-in bot name gets a blue heart (U+1F499) instead. */
export const displayName = (u: string) => {
  const t = u.trim();
  return t === BOT.username ? `${t} \u{1F499}` : `${t} \u2615`;
};

/** vCard 3.0 (widest phone support). Contains name and phone ONLY. */
export function buildVcf(contacts: VcfContact[]): string {
  const valid = contacts.filter(c => c.username.trim() && /^\+234\d{10}$/.test(c.phoneE164));
  const seen = new Set<string>();
  const cards: string[] = [];
  for (const c of valid) {
    if (seen.has(c.phoneE164)) continue; // de-duplicate by canonical number
    seen.add(c.phoneE164);
    const fn = escapeText(displayName(c.username));
    cards.push([
      'BEGIN:VCARD', 'VERSION:3.0', `FN:${fn}`, `N:${fn};;;;`, `TEL;TYPE=CELL:${c.phoneE164}`, 'END:VCARD',
    ].map(foldLine).join('\r\n'));
  }
  return cards.length ? cards.join('\r\n') + '\r\n' : '';
}

export function vcfFilename(username: string): string {
  const slug = username.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 30);
  return `unaco-${slug || 'contact'}.vcf`;
}

export function downloadVcf(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/vcard;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
