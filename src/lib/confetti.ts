/** Full-screen celebration on a <canvas>; no dependencies. Skipped when the user prefers reduced motion. */
const COLORS = ['#2457d6', '#3b6ef0', '#27c4e8', '#ffffff', '#ffd166', '#9ec1ff'];
type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; round: boolean; t: number; max: number; ph: number };

export function celebrate(): void {
  if (typeof document === 'undefined' || typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = innerWidth, H = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1000' });
  cv.width = W * dpr; cv.height = H * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) { cv.remove(); return; }
  ctx.scale(dpr, dpr);
  setTimeout(() => cv.remove(), 7000); // hard stop even if animation frames are throttled (background tab, slow device)
  const k = Math.min(1.25, Math.max(0.6, H / 800));
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const ps: P[] = [];
  const add = (x: number, y: number, ang: number, sp: number, life = 150) =>
    ps.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: rnd(6, 12), h: rnd(4, 8), r: rnd(0, 6.28), vr: rnd(-0.35, 0.35),
      c: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.25, t: 0, max: life * rnd(0.8, 1.2), ph: rnd(0, 6.28) });
  const cannon = (x: number, deg: number, n: number) => { for (let i = 0; i < n; i++) add(x, H + 10, ((deg + rnd(-16, 16)) * Math.PI) / 180, rnd(15, 29) * k); };
  const radial = (x: number, y: number, n: number) => { for (let i = 0; i < n; i++) add(x, y, rnd(0, 6.28), rnd(6, 20) * k, 110); };
  const sched = [
    { t: 0, f: () => { cannon(0, -62, 60); cannon(W, -118, 60); } },
    { t: 140, f: () => radial(W / 2, H * 0.4, 90) },
    { t: 320, f: () => { cannon(W * 0.15, -75, 40); cannon(W * 0.85, -105, 40); } },
  ];
  const start = performance.now(); let last = start;
  const frame = (now: number) => {
    try {
      step(now);
    } catch { cv.remove(); } // never leave a stuck overlay on screen
  };
  const step = (now: number) => {
    const dt = Math.max(0, Math.min(32, now - last)) / 16.67; last = now;
    const el = Math.max(0, now - start); // rAF timestamps can precede performance.now() on the first frame
    while (sched.length && sched[0].t <= el) sched.shift()!.f();
    if (el > 450 && el < 1700) for (let i = 0; i < 3; i++) add(rnd(0, W), -12, Math.PI / 2 + rnd(-0.3, 0.3), rnd(2, 6) * k, 220);
    ctx.clearRect(0, 0, W, H);
    if (el < 700) { // shockwave ring
      const p = el / 700; ctx.strokeStyle = `rgba(39,196,232,${0.7 * (1 - p)})`; ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.4, Math.max(0, p * Math.max(W, H) * 0.55), 0, 6.28); ctx.stroke();
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.t += dt;
      p.vx *= Math.pow(0.985, dt); p.vy = p.vy * Math.pow(0.985, dt) + 0.55 * k * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.t > p.max || p.y > H + 30) { ps.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = Math.min(1, (p.max - p.t) / (p.max * 0.25));
      ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.t * 0.2 + p.ph)); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, 6.28); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if ((el > 1800 && !ps.length) || el > 6000) { cv.remove(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
