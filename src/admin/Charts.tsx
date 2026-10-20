import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';

export interface Pt { date: string; visits: number; registrations: number; tracked: boolean }
export const fmtDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function LineChart({ data, label }: { data: Pt[]; label: string }) {
  const W = 640, H = 240, L = 34, R = 10, T = 12, B = 26, n = data.length;
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => { const m = Math.max(1, ...data.map(d => Math.max(d.visits, d.registrations))); return m <= 4 ? 4 : Math.ceil(m / 4) * 4; }, [data]);
  const x = (i: number) => (n <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const line = (k: 'visits' | 'registrations') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const area = n > 1 ? `${line('visits')}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : '';
  const step = (W - L - R) / Math.max(1, n - 1);
  const gaps: [number, number][] = []; // runs of days without tracking data
  data.forEach((d, i) => { if (!d.tracked) { const last = gaps[gaps.length - 1]; if (last && last[1] === i - 1) last[1] = i; else gaps.push([i, i]); } });
  const move = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const vx = ((e.clientX - r.left) / r.width) * W;
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((vx - L) / step)))); };
  const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setHover(h => Math.min(n - 1, (h ?? -1) + 1)); else if (e.key === 'ArrowLeft') setHover(h => Math.max(0, (h ?? n) - 1)); };
  const hp = hover !== null ? data[hover] : null;
  const labels = n <= 1 ? [0] : n <= 6 ? data.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <figure className="a-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} tabIndex={0} onPointerMove={move} onPointerLeave={() => setHover(null)} onKeyDown={key} onBlur={() => setHover(null)} key={`${n}-${data[0]?.date}-${max}`}>
        {[0, 1, 2, 3, 4].map(k => (<g key={k}><line x1={L} x2={W - R} y1={y((max / 4) * k)} y2={y((max / 4) * k)} className="a-grid" /><text x={L - 6} y={y((max / 4) * k) + 4} textAnchor="end" className="a-axis">{(max / 4) * k}</text></g>))}
        {gaps.map(([a, b], i) => <rect key={i} x={x(a) - step / 2} y={T} width={Math.max(8, (b - a) * step + step)} height={H - T - B} className="a-gap"><title>Not tracked yet</title></rect>)}
        {area && <path d={area} className="a-area" />}
        {n > 1 && <path d={line('visits')} pathLength={1} className="a-line a-visits" />}
        {n > 1 && <path d={line('registrations')} pathLength={1} className="a-line a-regs" />}
        {data.map((d, i) => (n <= 40 || i === hover) && <g key={i}>{d.tracked && <circle cx={x(i)} cy={y(d.visits)} r={hover === i ? 5 : 3} className="a-dot a-visits" />}<circle cx={x(i)} cy={y(d.registrations)} r={hover === i ? 5 : 3} className="a-dot a-regs" /></g>)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="a-cursor" />}
        {labels.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="a-axis">{fmtDay(data[i].date)}</text>)}
      </svg>
      {hp && (
        <div className="a-tip" style={{ left: `${(x(hover!) / W) * 100}%`, transform: x(hover!) > W * 0.6 ? 'translateX(-105%)' : 'translateX(8px)' }} role="status">
          <b>{fmtDay(hp.date)}</b><span className="a-visits-t">Visits: {hp.tracked ? hp.visits : 'not tracked'}</span><span className="a-regs-t">Registrations: {hp.registrations}</span>
        </div>
      )}
      <figcaption className="a-legend"><span><i className="a-visits-bg" />Visits</span><span><i className="a-regs-bg" />Registrations</span>{gaps.length > 0 && <span><i className="a-gap-bg" />Before tracking began</span>}</figcaption>
      <table className="sr"><caption>{label}</caption><thead><tr><th>Date</th><th>Visits</th><th>Registrations</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.tracked ? d.visits : 'not tracked'}</td><td>{d.registrations}</td></tr>)}</tbody></table>
    </figure>
  );
}

interface Item { key: string; label: string; value: number; sub?: string }
function Inner({ items }: { items: Item[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);
  const max = Math.max(1, ...items.map(i => i.value));
  return <ul className="a-bars">{items.map(i => (
    <li key={i.key}><div className="a-bar-top"><span>{i.label}{i.sub && <small>{i.sub}</small>}</span><b>{i.value.toLocaleString()}</b></div>
      <div className="a-track"><div className="a-fill" style={{ width: ready ? `${(i.value / max) * 100}%` : '0%' }} /></div></li>))}</ul>;
}
export function BarList({ items, empty }: { items: Item[]; empty: string }) {
  return items.length ? <Inner key={items.map(i => i.key + i.value).join('|')} items={items} /> : <p className="a-empty">{empty}</p>;
}
