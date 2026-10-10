import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

/** Step 1: validation. Accepts 0XXXXXXXXXX, 234XXXXXXXXXX, +234XXXXXXXXXX (spaces/hyphens allowed as separators). */
export function validateNigerianMobile(raw: string): { ok: true } | { ok: false; error: string } {
  const r = normalizeNigerianMobile(raw);
  return r.ok ? { ok: true } : r;
}

/** Step 2: normalization to E.164. Never guesses digits; returns an error instead. */
export function normalizeNigerianMobile(raw: string): PhoneResult {
  const input = (raw ?? '').trim();
  if (!input) return { ok: false, error: 'Enter your phone number.' };
  if (!/^\+?[\d\s-]+$/.test(input) || input.indexOf('+') > 0) return { ok: false, error: 'Use digits only, optionally starting with +.' };
  const digits = input.replace(/[\s-]/g, '').replace(/^\+/, '');
  const hasPlus = input.startsWith('+');
  let national: string;
  if (!hasPlus && /^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else return { ok: false, error: 'Use a Nigerian number like 07024830789, 2347024830789 or +2347024830789.' };
  const parsed = parsePhoneNumberFromString('+234' + national);
  const type = parsed?.getType();
  if (!parsed || !parsed.isValid() || parsed.country !== 'NG' || (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE'))
    return { ok: false, error: 'That does not look like a valid Nigerian mobile number.' };
  return { ok: true, e164: parsed.number };
}
