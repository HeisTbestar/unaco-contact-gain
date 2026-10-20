import type { EventRow, Registration } from './store.ts';
export const DAY = 86_400_000;
const LAGOS = 3_600_000; // Africa/Lagos is UTC+1 all year
export const dayKey = (t: number) => new Date(t + LAGOS).toISOString().slice(0, 10);
export const dayStart = (d: string) => Date.parse(d + 'T00:00:00Z') - LAGOS;
export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

const top = (m: Map<string, number>, n: number) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export interface SummaryInput { events: EventRow[]; registrations: Registration[]; fromDay: string; toDay: string; now: number; trackingSince: number | null; truncated?: boolean }

export function summarise({ events, registrations, fromDay, toDay, now, trackingSince, truncated = false }: SummaryInput) {
  const from = dayStart(fromDay), to = dayStart(toDay) + DAY; // [from, to)
  const t = (e: EventRow) => Date.parse(e.createdAt);
  const inRange = events.filter(e => t(e) >= from && t(e) < to).sort((a, b) => t(a) - t(b));
  const regTime = (r: Registration) => Date.parse(r.createdAt);
  const regsInRange = registrations.filter(r => regTime(r) >= from && regTime(r) < to);

  const byDay = new Map<string, EventRow[]>();
  for (const e of inRange) { const k = dayKey(t(e)); (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e); }
  const regByDay = new Map<string, number>();
  for (const r of regsInRange) bump(regByDay, dayKey(regTime(r)));
  const series = [];
  for (let d = from; d < to; d += DAY) {
    const k = dayKey(d), list = byDay.get(k) ?? [];
    series.push({ date: k, visits: new Set(list.map(e => e.session)).size, pageviews: list.filter(e => e.type === 'pageview').length,
      registrations: regByDay.get(k) ?? 0, tracked: trackingSince !== null && d + DAY > trackingSince });
  }

  const sessions = new Set(inRange.map(e => e.session));
  const sessionsOf = (type: string) => new Set(inRange.filter(e => e.type === type).map(e => e.session));
  const formSuccess = sessionsOf('form_success').size;
  const errors: Record<string, number> = {};
  for (const e of inRange) if (e.type === 'form_error' && e.target) errors[e.target] = (errors[e.target] ?? 0) + 1;

  const clicks = new Map<string, number>(), refs = new Map<string, number>(), countries = new Map<string, number>(), cities = new Map<string, number>();
  const seen = new Set<string>();
  for (const e of inRange) {
    if (e.type === 'click' && e.target) bump(clicks, e.target);
    if (e.type === 'pageview') bump(refs, e.referrer ?? '(direct)');
    if (!seen.has(e.session)) { // approximate location = first event of each visit
      seen.add(e.session);
      if (e.country) { bump(countries, e.country); if (e.city) bump(cities, `${e.city}|${e.country}`); } else bump(countries, '??');
    }
  }

  const todayStart = dayStart(dayKey(now));
  const periodStart = { today: todayStart, week: todayStart - 6 * DAY, month: todayStart - 29 * DAY };
  const periods = { visits: {} as Record<string, number>, registrations: {} as Record<string, number> };
  for (const [k, s] of Object.entries(periodStart)) {
    periods.visits[k] = new Set(events.filter(e => t(e) >= s && t(e) <= now).map(e => e.session)).size;
    periods.registrations[k] = registrations.filter(r => regTime(r) >= s && regTime(r) <= now).length;
  }

  return {
    range: { from: fromDay, to: toDay },
    trackingSince: trackingSince === null ? null : new Date(trackingSince).toISOString(),
    eventsTruncated: truncated,
    totals: { visits: sessions.size, pageviews: inRange.filter(e => e.type === 'pageview').length, registrationsInRange: regsInRange.length,
      registrationsAllTime: registrations.length, conversion: trackingSince !== null && sessions.size > 0 ? formSuccess / sessions.size : null },
    periods, series,
    funnel: { visits: sessions.size, formStarts: sessionsOf('form_start').size, formSuccess, errors },
    topClicks: top(clicks, 12).map(([target, count]) => ({ target, count })),
    referrers: top(refs, 8).map(([referrer, count]) => ({ referrer, count })),
    locations: {
      countries: top(countries, 15).map(([code, count]) => ({ code, count })),
      cities: top(cities, 15).map(([k, count]) => { const [city, country] = k.split('|'); return { city, country, count }; }),
    },
    recentEvents: [...events].sort((a, b) => t(b) - t(a)).slice(0, 15).map(e => ({ type: e.type, target: e.target, country: e.country, city: e.city, at: e.createdAt })),
    recentRegistrations: [...registrations].sort((a, b) => regTime(b) - regTime(a)).slice(0, 10).map(r => ({ username: r.username, at: r.createdAt })),
  };
}
