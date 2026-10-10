/** Fixed-window limiter. In-memory = per serverless instance (best effort); see docs/DEPLOY.md. */
export function createLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { n: number; reset: number }>();
  const get = (k: string) => {
    const h = hits.get(k);
    if (!h || h.reset <= now()) { const f = { n: 0, reset: now() + windowMs }; hits.set(k, f); return f; }
    return h;
  };
  return {
    take(k: string) { const h = get(k); h.n++; return h.n <= max; },
    blocked(k: string) { return get(k).n >= max; },
  };
}
