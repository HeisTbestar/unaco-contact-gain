import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LINKS } from '../config/links';
import { celebrate } from '../lib/confetti';
import { track } from '../lib/track';
import { MAX_ENTRIES, validateEntry } from '../lib/validation';

type Entry = { username: string; phone: string };
const blank = (): Entry => ({ username: '', phone: '' });
type Result = { status: 'added' | 'exists' };

export function RegisterForm() {
  const [entries, setEntries] = useState<Entry[]>([blank()]);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot, hidden from people
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!results) return;
    const h = doneRef.current;
    h?.focus({ preventScroll: true }); // keep keyboard/screen-reader focus on the result without the browser's edge-scroll under the sticky header
    h?.closest('.card')?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [results]);

  const setField = (i: number, k: keyof Entry, v: string) => setEntries(es => es.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    const seen = new Set<string>();
    entries.forEach((e, i) => {
      const r = validateEntry(e.username, e.phone);
      if (r.errors.username) errs[`${i}.username`] = r.errors.username;
      if (r.errors.phone) errs[`${i}.phone`] = r.errors.phone;
      else if (seen.has(r.phoneE164!)) errs[`${i}.phone`] = 'This number is entered twice.';
      else seen.add(r.phoneE164!);
    });
    if (!consent) errs.consent = 'Tick the box to agree to share your contact.';
    setErrors(errs);
    if (Object.keys(errs).length) track('form_error', 'validation');
    const first = Object.keys(errs)[0];
    if (first) { document.getElementById(`f-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries.map(e => ({ username: e.username.trim(), phone: e.phone.trim() })), consent: true, website }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const r: Result[] = data.results ?? [];
        setResults(r);
        if (r.some(x => x.status === 'added')) { track('form_success'); celebrate(); } // only for genuinely new registrations
        return;
      }
      track('form_error', res.status === 429 ? 'rate_limit' : 'server');
      setErrors(data.errors ?? { form: data.error ?? 'Something went wrong. Please try again.' });
    } catch { track('form_error', 'network'); setErrors({ form: 'Could not reach the server. Check your connection and try again. Your details are still here.' }); }
    finally { setBusy(false); }
  }

  if (results) {
    const added = results.some(r => r.status === 'added');
    return (
      <div className="card success" role="status">
        {added && <svg className="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="m15 27 8 8 15-17" /></svg>}
        <h3 ref={doneRef} tabIndex={-1}>{added ? "You're in!" : 'Already registered'}</h3>
        <ul className="plain">{results.map((r, i) => <li key={i}>{entries[i]?.username}: {r.status === 'added' ? 'added' : 'this number was already registered'}</li>)}</ul>
        <p>UNACO will post the contact file in the <a href={LINKS.contactGainGroup.href} data-track="link_group_success" target="_blank" rel="noopener noreferrer">3080 Freshmen Connect group</a>. Join it so you don't miss it.</p>
        <button className="btn btn-ghost" onClick={() => { setResults(null); setEntries([blank()]); setConsent(false); setErrors({}); setBusy(false); }}>Add another</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit} noValidate onFocusCapture={() => { if (!started.current) { started.current = true; track('form_start'); } }}>
      {entries.map((e, i) => (
        <fieldset className="entry" key={i}>
          <legend>{entries.length > 1 ? `Contact ${i + 1}` : 'Your contact'}</legend>
          <div className="field">
            <label htmlFor={`f-${i}.username`}>Username</label>
            <input id={`f-${i}.username`} value={e.username} onChange={x => setField(i, 'username', x.target.value)} maxLength={30} autoComplete="nickname"
              aria-invalid={!!errors[`${i}.username`]} aria-describedby={errors[`${i}.username`] ? `d-${i}.username` : undefined} required />
            {errors[`${i}.username`] && <p id={`d-${i}.username`} className="err" role="alert">{errors[`${i}.username`]}</p>}
          </div>
          <div className="field">
            <label htmlFor={`f-${i}.phone`}>Nigerian phone number</label>
            <input id={`f-${i}.phone`} type="tel" inputMode="tel" autoComplete="tel" placeholder="07024830789" value={e.phone} onChange={x => setField(i, 'phone', x.target.value)}
              aria-invalid={!!errors[`${i}.phone`]} aria-describedby={`d-${i}.phone`} required />
            <p id={`d-${i}.phone`} className={errors[`${i}.phone`] ? 'err' : 'hint'} role={errors[`${i}.phone`] ? 'alert' : undefined}>{errors[`${i}.phone`] ?? 'Accepted: 07024830789, 2347024830789 or +2347024830789.'}</p>
          </div>
          {i > 0 && <button type="button" className="link-btn" onClick={() => setEntries(es => es.filter((_, j) => j !== i))}>Remove contact {i + 1}</button>}
        </fieldset>
      ))}
      {entries.length < MAX_ENTRIES && <button type="button" className="btn btn-ghost" onClick={() => setEntries(es => [...es, blank()])}>Add another number (up to {MAX_ENTRIES})</button>}
      <div className="honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={x => setWebsite(x.target.value)} /></label></div>
      <div className="check">
        <input id="f-consent" type="checkbox" checked={consent} onChange={x => setConsent(x.target.checked)} aria-invalid={!!errors.consent} aria-describedby="d-consent" />
        <label htmlFor="f-consent">I agree to share the name and phone number(s) above in the UNACO freshmen contact file. I confirm the numbers are mine.</label>
        <p id="d-consent" className={errors.consent ? 'err' : 'hint'} role={errors.consent ? 'alert' : undefined}>{errors.consent ?? 'UNACO will post this file in the 3080 Freshmen Connect WhatsApp group, so everyone in that group can see and save it. It contains only your name and number.'}</p>
      </div>
      {errors.form && <p className="err" role="alert">{errors.form}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Add my contact'}</button>
    </form>
  );
}
