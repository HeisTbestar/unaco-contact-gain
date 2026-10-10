import { BOT } from '../config/bot.ts';
import { normalizeNigerianMobile } from './phone.ts';

export const USERNAME_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}_.\- ]{0,28}[\p{L}\p{N}_.])?$/u;
export const MAX_ENTRIES = 3;

export function validateUsername(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Choose a username.';
  if (s.length < 2 || s.length > 30) return 'Use 2 to 30 characters.';
  if (s.toLowerCase() === BOT.username.toLowerCase()) return 'This username is reserved.';
  if (/\s{2,}/.test(s) || !USERNAME_RE.test(s)) return 'Use letters, numbers, spaces, dots, hyphens or underscores. No emoji.';
  return null;
}

export function validateEntry(username: string, phone: string) {
  const errors: { username?: string; phone?: string } = {};
  const u = validateUsername(username); if (u) errors.username = u;
  const p = normalizeNigerianMobile(phone);
  if (!p.ok) errors.phone = p.error;
  else if (p.e164 === BOT.phoneE164) errors.phone = 'This number cannot be registered.';
  return { errors, username: username.trim(), phoneE164: p.ok && !errors.phone ? p.e164 : undefined };
}
