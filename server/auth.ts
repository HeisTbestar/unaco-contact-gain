import { createHash, randomBytes } from 'node:crypto';
export const COOKIE = 'unaco_admin';
export const SESSION_MS = 8 * 3600_000;
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) { const i = part.indexOf('='); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null; }
  return null;
}
/** HttpOnly: JavaScript cannot read it. SameSite=Strict: not sent on cross-site requests. Path-scoped to the admin API. */
export const sessionCookie = (token: string, secure: boolean, maxAgeSec: number) =>
  `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`;
