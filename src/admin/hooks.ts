import { useEffect, useRef, useState } from 'react';
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates from the previous value to the new one. Shows the final value immediately for reduced-motion users. */
export function useCountUp(target: number | null, ms = 900): number {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === null) { prev.current = 0; setV(0); return; }
    if (reducedMotion()) { prev.current = target; setV(target); return; }
    const from = prev.current, start = performance.now(); let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step); else prev.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
