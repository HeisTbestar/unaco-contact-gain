import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from './Icon';

function RemoveForm() {
  const [phone, setPhone] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null); const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) });
      const d = await r.json().catch(() => ({})); setMsg({ ok: r.ok, t: d.message ?? d.error ?? 'Something went wrong. Please try again.' });
    } catch { setMsg({ ok: false, t: 'Could not reach the server. Try again.' }); } finally { setBusy(false); }
  }
  return (
    <form className="card" onSubmit={go} noValidate>
      <div className="field"><label htmlFor="rm-phone">Phone number to remove</label>
        <input id="rm-phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07024830789" aria-describedby="rm-d" />
        <p id="rm-d" className={msg && !msg.ok ? 'err' : 'hint'} role={msg ? 'status' : undefined}>{msg?.t ?? 'Enter the number you registered.'}</p></div>
      <button className="btn" type="submit" disabled={busy}>{busy ? 'Removing…' : 'Remove my number'}</button>
    </form>
  );
}

export function RemoveSection() {
  const [open, setOpen] = useState(false);
  useEffect(() => { const f = () => { if (location.hash === '#remove') setOpen(true); }; f(); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  // The scroll-reveal wrapper never re-renders its className; open state lives on an inner data attribute.
  return (
    <section id="remove" className="wrap section" aria-labelledby="rm-h">
      <div className="reveal">
        <div className="rm glass" data-open={open}>
          <h2 id="rm-h" className="rm-h">
            <button type="button" className="rm-head" aria-expanded={open} aria-controls="rm-panel" onClick={() => setOpen(o => !o)}>
              <span className="rm-ic"><Icon name="remove" size={26} /></span>
              <span className="rm-t"><b>Want your number removed?</b><small>Open this to remove it from future contact files.</small></span>
              <span className="chev"><Icon name="arrow" size={22} /></span>
            </button>
          </h2>
          <div id="rm-panel" className="rm-panel" hidden={!open}>
            <div className="rm-inner">
              <p className="rm-note">Removing your number leaves it out of every future file. Copies already saved on other phones, or posted in the group, can't be recalled.</p>
              <RemoveForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
