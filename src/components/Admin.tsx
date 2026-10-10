import { useState, type FormEvent } from 'react';
import { downloadVcf } from '../lib/vcf';
export function Admin() {
  const [token, setToken] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/admin/export', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { downloadVcf(await r.text(), 'unaco-contacts.vcf'); setMsg('Downloaded unaco-contacts.vcf'); setToken(''); }
      else setMsg(((await r.json().catch(() => ({}))).error as string) ?? 'Failed.');
    } catch { setMsg('Could not reach the server.'); } finally { setBusy(false); }
  }
  return (
    <main className="wrap section"><h1 className="on-dark">Owner export</h1>
      <form className="card" onSubmit={go}>
        <div className="field"><label htmlFor="tok">Export token</label>
          <input id="tok" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} required aria-describedby="tok-d" />
          <p id="tok-d" className="hint" role="status">{msg || 'Kept in memory only. Never share it.'}</p></div>
        <button className="btn" disabled={busy}>{busy ? 'Working…' : 'Download contacts file'}</button>
      </form></main>
  );
}
