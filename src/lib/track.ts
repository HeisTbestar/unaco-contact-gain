import type { TrackType } from '../config/track';

const SID = 'unaco_sid';
const OPT_OUT = 'unaco_no_track';
let started = false;

/** Per-tab random id. Lives in sessionStorage only: it is gone when the tab closes and never links visits across days. */
function sessionId(): string | null {
  try {
    let s = sessionStorage.getItem(SID);
    if (!s) {
      s = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/\+/g, '-').replace(/\//g, '_');
      sessionStorage.setItem(SID, s);
    }
    return s;
  } catch { return null; }
}

export function trackingAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return false; // respect browser privacy signals
  if (location.pathname === '/admin' || location.hash === '#admin') return false;
  try { if (localStorage.getItem(OPT_OUT) === '1') return false; } catch { /* storage blocked: still allowed */ }
  return true;
}

export function setTrackingOptOut(on: boolean) { try { localStorage.setItem(OPT_OUT, on ? '1' : '0'); } catch { /* ignore */ } }
export const getTrackingOptOut = () => { try { return localStorage.getItem(OPT_OUT) === '1'; } catch { return false; } };

function referrerHost(): string | null {
  try { const r = document.referrer; if (!r) return null; const h = new URL(r).hostname; return h === location.hostname ? null : h.slice(0, 80); } catch { return null; }
}

/** Fire-and-forget. Never throws, never blocks navigation, never sends form contents. */
export function track(type: TrackType, target?: string): void {
  if (!trackingAllowed()) return;
  const session = sessionId(); if (!session) return;
  const body = JSON.stringify({ type, target: target ?? null, path: location.pathname, session, ref: type === 'pageview' ? referrerHost() : null });
  try { if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return; } catch { /* fall through */ }
  try { void fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
}

/** One page view per load plus one delegated click listener for elements marked data-track="\u2026". */
export function initTracking(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  track('pageview');
  document.addEventListener('click', e => {
    const el = (e.target as Element | null)?.closest?.('[data-track]');
    const t = el?.getAttribute('data-track');
    if (t) track('click', t);
  });
}
