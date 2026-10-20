import { useCallback, useEffect, useRef, useState } from 'react';
import { CLICK_TARGETS, FORM_ERROR_TARGETS } from '../config/track';
import { downloadVcf } from '../lib/vcf';
import { getTrackingOptOut, setTrackingOptOut } from '../lib/track';
import { Logo } from '../components/Header';
import { AuthError, api, logout, type Stats } from './api';
import { BarList, LineChart, fmtDay } from './Charts';
import { useCountUp } from './hooks';
import { Registrations } from './Registrations';

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';
type Tab = 'overview' | 'registrations' | 'engagement' | 'locations';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['registrations', 'Registrations'], ['engagement', 'Clicks & funnel'], ['locations', 'Locations']];
const lagosToday = () => new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
const rangeFor = (p: Preset, c: { from: string; to: string }) => { const t = lagosToday(); return p === 'today' ? { from: t, to: t } : p === '7d' ? { from: addDays(t, -6), to: t } : p === '30d' ? { from: addDays(t, -29), to: t } : p === '90d' ? { from: addDays(t, -89), to: t } : c; };
const regionName = (code: string) => { if (code === '??') return 'Unknown'; try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code; } catch { return code; } };

function describe(e: { type: string; target: string | null }) {
  if (e.type === 'pageview') return 'Opened the site';
  if (e.type === 'click') return `Clicked: ${CLICK_TARGETS[e.target as keyof typeof CLICK_TARGETS] ?? e.target}`;
  if (e.type === 'form_start') return 'Started the form';
  if (e.type === 'form_success') return 'Registered a contact';
  if (e.type === 'form_error') return `Form problem: ${FORM_ERROR_TARGETS[e.target as keyof typeof FORM_ERROR_TARGETS] ?? e.target}`;
  if (e.type === 'remove_open') return 'Opened the remove box';
  if (e.type === 'remove_success') return 'Removed a number';
  return e.type;
}
const ago = (iso: string) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };

function Stat({ label, value, sub, format, hint }: { label: string; value: number | null; sub?: string; format?: (n: number) => string; hint?: string }) {
  const shown = useCountUp(value);
  return (
    <div className="a-stat" title={hint}>
      <span className="a-stat-l">{label}</span>
      <b className="a-stat-v" aria-label={value === null ? `${label}: not available` : undefined}>{value === null ? '—' : (format ?? ((n: number) => n.toLocaleString()))(shown)}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Dashboard({ onAuthLost }: { onAuthLost: () => void }) {
  const [tab, setTab] = useState<Tab>('overview'), [preset, setPreset] = useState<Preset>('30d');
  const [custom, setCustom] = useState({ from: addDays(lagosToday(), -29), to: lagosToday() });
  const [stats, setStats] = useState<Stats | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  const [optOut, setOptOut] = useState(getTrackingOptOut()), [dl, setDl] = useState(''), [busyDl, setBusyDl] = useState(false);
  const reqId = useRef(0);
  const range = rangeFor(preset, custom);
  const rangeBad = range.from > range.to || !range.from || !range.to;

  const load = useCallback(async () => {
    if (rangeBad) return;
    const id = ++reqId.current; setLoading(true); setError('');
    try { const s = await api.stats(range.from, range.to); if (id === reqId.current) setStats(s); }
    catch (e) { if (e instanceof AuthError) onAuthLost(); else if (id === reqId.current) setError((e as Error).message); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [range.from, range.to, rangeBad, onAuthLost]);
  useEffect(() => { void load(); }, [load, tick]);

  async function download() {
    setBusyDl(true); setDl('');
    try { downloadVcf(await api.vcf(), 'unaco-contacts.vcf'); setDl('Downloaded unaco-contacts.vcf'); }
    catch (e) { if (e instanceof AuthError) onAuthLost(); else setDl((e as Error).message); } finally { setBusyDl(false); }
  }
  async function signOut() { await logout(); onAuthLost(); }

  // Render nothing but a neutral message until the server has confirmed the session (no dashboard frame is shown to signed-out visitors).
  if (!stats && !error) return <p className="a-loading" role="status">Checking your session…</p>;
  const s = stats, tracked = !!s?.trackingSince;
  const since = s?.trackingSince ? new Date(s.trackingSince).toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium' }) : null;
  const partial = !!(s?.trackingSince && s.trackingSince.slice(0, 10) > range.from);
  const v = (n: number | undefined) => (tracked && n !== undefined ? n : null);

  return (
    <div className="a-shell">
      <header className="a-bar">
        <div className="a-brand"><Logo size={36} /><div><b>UNACO Contact Gain</b><small>Admin dashboard</small></div></div>
        <div className="a-bar-actions">
          <button className="a-btn" onClick={() => void download()} disabled={busyDl}>{busyDl ? 'Preparing…' : 'Download VCF'}</button>
          <button className="a-btn a-ghost" onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <p className="a-note" role="status" aria-live="polite">{dl}</p>

      <div className="a-controls">
        <nav className="a-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        {tab !== 'registrations' && (
          <div className="a-range">
            <div className="a-seg" role="group" aria-label="Date range">
              {(['today', '7d', '30d', '90d', 'custom'] as Preset[]).map(p => <button key={p} className={preset === p ? 'on' : ''} aria-pressed={preset === p} onClick={() => setPreset(p)}>{p === 'today' ? 'Today' : p === 'custom' ? 'Custom' : `${parseInt(p)} days`}</button>)}
            </div>
            {preset === 'custom' && (
              <div className="a-custom"><label>From<input type="date" value={custom.from} max={custom.to} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label>
                <label>To<input type="date" value={custom.to} min={custom.from} max={lagosToday()} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} /></label></div>)}
            <button className="a-btn a-ghost a-sm" onClick={() => setTick(t => t + 1)}>Refresh</button>
          </div>)}
      </div>
      {rangeBad && tab !== 'registrations' && <p className="a-err" role="alert">Choose a valid date range (start on or before end).</p>}
      {error && tab !== 'registrations' && <p className="a-err" role="alert">{error} <button className="a-link" onClick={() => setTick(t => t + 1)}>Retry</button></p>}

      {tab === 'registrations' && <Registrations onAuthLost={onAuthLost} refreshKey={tick} />}

      {tab !== 'registrations' && (
        <main className={`a-fade${loading ? ' is-loading' : ''}`} key={tab}>
          {s && (
            <p className="a-banner">{tracked ? <>Analytics has been recording since <b>{since}</b>. Days before that are shown as "not tracked", never as zero.{partial && ' This range starts before tracking began, so its totals cover only the tracked part.'}</>
              : <>No visitor data yet. Tracking starts from the first visit after this version went live, and earlier visits can't be recovered. Registrations below are real records.</>}
              {s.eventsTruncated && ' Very large date range: showing the first 50,000 events only.'}</p>)}

          {tab === 'overview' && (<>
            <div className="a-grid-stats">
              {loading && !s ? [0, 1, 2, 3].map(i => <div key={i} className="a-stat"><div className="a-skel" /></div>) : (<>
                <Stat label="Visits" value={v(s?.totals.visits)} sub="distinct browser sessions" hint="A visit is one browser tab session. It is not a count of unique people." />
                <Stat label="Page views" value={v(s?.totals.pageviews)} />
                <Stat label="Registrations" value={s?.totals.registrationsInRange ?? null} sub={s ? `${s.totals.registrationsAllTime.toLocaleString()} all time` : undefined} />
                <Stat label="Conversion" value={s?.totals.conversion == null ? null : Math.round(s.totals.conversion * 1000) / 10} format={n => `${(n / 1).toFixed(1)}%`} sub="visits that registered" hint={s?.totals.conversion == null ? 'Needs visit data' : undefined} />
              </>)}
            </div>
            <h2 className="a-h">Trend</h2>
            <div className="a-panel">{s ? <LineChart data={s.series} label={`Visits and registrations per day, ${fmtDay(range.from)} to ${fmtDay(range.to)}`} /> : <div className="a-skel a-tall" />}</div>
            <h2 className="a-h">Today, this week, this month</h2>
            <div className="a-periods">
              {(['today', 'week', 'month'] as const).map(k => (
                <div className="a-period" key={k}><span className="a-stat-l">{k === 'today' ? 'Today' : k === 'week' ? 'Last 7 days' : 'Last 30 days'}</span>
                  <div><Stat label="Visits" value={v(s?.periods.visits[k])} /><Stat label="Registrations" value={s?.periods.registrations[k] ?? null} /></div></div>))}
            </div>
            <h2 className="a-h">Recent activity</h2>
            <div className="a-panel a-two">
              <div><h3 className="a-h3">Latest registrations</h3>{s?.recentRegistrations.length ? <ul className="a-feed">{s.recentRegistrations.map((r, i) => <li key={i}><span>{r.username} registered</span><time>{ago(r.at)}</time></li>)}</ul> : <p className="a-empty">No registrations yet.</p>}</div>
              <div><h3 className="a-h3">Latest visitor events</h3>{s?.recentEvents.length ? <ul className="a-feed">{s.recentEvents.map((e, i) => <li key={i}><span>{describe(e)}{e.country && <small> · {e.city ? `${e.city}, ` : ''}{regionName(e.country)}</small>}</span><time>{ago(e.at)}</time></li>)}</ul> : <p className="a-empty">No visitor events recorded yet.</p>}</div>
            </div>
          </>)}

          {tab === 'engagement' && (<>
            <h2 className="a-h">Sign-up funnel</h2>
            <div className="a-panel">
              {s && tracked ? <BarList empty="" items={[{ key: 'v', label: 'Visited', value: s.funnel.visits }, { key: 's', label: 'Started the form', value: s.funnel.formStarts }, { key: 'r', label: 'Registered', value: s.funnel.formSuccess }]} /> : <p className="a-empty">Funnel appears once visits are recorded.</p>}
              {s && Object.keys(s.funnel.errors).length > 0 && <p className="a-mute">Form problems: {Object.entries(s.funnel.errors).map(([k, n]) => `${FORM_ERROR_TARGETS[k as keyof typeof FORM_ERROR_TARGETS] ?? k}: ${n}`).join(' · ')}</p>}
            </div>
            <h2 className="a-h">Most clicked links and buttons</h2>
            <div className="a-panel"><BarList empty="No clicks recorded in this range." items={(s?.topClicks ?? []).map(c => ({ key: c.target, label: CLICK_TARGETS[c.target as keyof typeof CLICK_TARGETS] ?? c.target, value: c.count }))} /></div>
            <h2 className="a-h">Where visitors came from</h2>
            <div className="a-panel"><BarList empty="No page views recorded in this range." items={(s?.referrers ?? []).map(r => ({ key: r.referrer, label: r.referrer === '(direct)' ? 'Direct / unknown (WhatsApp usually appears here)' : r.referrer, value: r.count }))} />
              <p className="a-mute">This is a single-page site, so there is one landing page. Section navigation shows up in the click list above.</p></div>
          </>)}

          {tab === 'locations' && (<>
            <h2 className="a-h">Countries</h2>
            <div className="a-panel"><BarList empty="No location data in this range." items={(s?.locations.countries ?? []).map(c => ({ key: c.code, label: regionName(c.code), value: c.count }))} /></div>
            <h2 className="a-h">Cities</h2>
            <div className="a-panel"><BarList empty="No city data in this range." items={(s?.locations.cities ?? []).map(c => ({ key: `${c.city}|${c.country}`, label: c.city, sub: regionName(c.country), value: c.count }))} />
              <p className="a-mute">Approximate, from the network the visitor connects through (it can show a provider's city, not the person's). Counted once per visit. No IP addresses or exact positions are stored.</p></div>
          </>)}
        </main>)}

      <footer className="a-foot">
        <label className="a-check"><input type="checkbox" checked={optOut} onChange={e => { setOptOut(e.target.checked); setTrackingOptOut(e.target.checked); }} />Don't count my own visits and clicks in this browser</label>
        <a href="/">← Back to the public site</a>
      </footer>
    </div>
  );
}
