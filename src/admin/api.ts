import type { summarise } from '../../server/analytics.ts';
export type Stats = ReturnType<typeof summarise> & { generatedAt: string };
export interface Reg { id: string; username: string; phone: string; consentedAt: string; createdAt: string }
export interface RegPage { total: number; page: number; pageSize: number; rows: Reg[] }

const CSRF = { 'X-Requested-With': 'unaco-admin' };
export class AuthError extends Error {}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, credentials: 'same-origin', headers: { ...CSRF, ...((init.headers as Record<string, string>) ?? {}) } });
  if (r.status === 401) throw new AuthError();
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'Request failed. Please try again.');
  return d as T;
}

export const api = {
  stats: (from: string, to: string) => call<Stats>(`/api/admin/stats?from=${from}&to=${to}`),
  regs: (p: URLSearchParams) => call<RegPage>(`/api/admin/registrations?${p}`),
  edit: (id: string, username: string) => call('/api/admin/registrations', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, username }) }),
  remove: (id: string) => call(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async vcf(): Promise<string> {
    const r = await fetch('/api/admin/export', { credentials: 'same-origin', headers: CSRF });
    if (r.status === 401) throw new AuthError();
    if (!r.ok) throw new Error('Could not build the file. Please try again.');
    return r.text();
  },
};

export async function login(passcode: string): Promise<void> {
  const r = await fetch('/api/admin/session', { method: 'POST', credentials: 'same-origin', headers: { ...CSRF, 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? 'Login failed. Please try again.');
}
export const logout = () => fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin', headers: CSRF }).catch(() => undefined);
