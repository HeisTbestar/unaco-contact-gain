import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { validateUsername } from '../lib/validation';
import { AuthError, api, type Reg, type RegPage } from './api';

const when = (iso: string) => new Date(iso).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', dateStyle: 'medium', timeStyle: 'short' });

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} className="a-modal" onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="a-modal-t">
      <h3 id="a-modal-t">{title}</h3>{children}
    </dialog>
  );
}

type Mode = { kind: 'view' | 'edit' | 'delete'; reg: Reg } | null;

export function Registrations({ onAuthLost, refreshKey }: { onAuthLost: () => void; refreshKey: number }) {
  const [q, setQ] = useState(''), [dq, setDq] = useState('');
  const [sort, setSort] = useState<'created' | 'username' | 'phone'>('created'), [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1), [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [data, setData] = useState<RegPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null), [name, setName] = useState(''), [formErr, setFormErr] = useState(''), [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const reqId = useRef(0);

  useEffect(() => { const id = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(id); }, [q]);
  const load = useCallback(async () => {
    const id = ++reqId.current; setLoading(true); setError('');
    const p = new URLSearchParams({ sort, dir, page: String(page), pageSize: '20' });
    if (dq) p.set('q', dq); if (from) p.set('from', from); if (to) p.set('to', to);
    try { const d = await api.regs(p); if (id === reqId.current) setData(d); }
    catch (e) { if (e instanceof AuthError) onAuthLost(); else if (id === reqId.current) setError((e as Error).message); }
    finally { if (id === reqId.current) setLoading(false); }
  }, [sort, dir, page, dq, from, to, onAuthLost]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const sortBy = (k: typeof sort) => { if (sort === k) setDir(d => (d === 'asc' ? 'desc' : 'asc')); else { setSort(k); setDir(k === 'created' ? 'desc' : 'asc'); } setPage(1); };
  const arrow = (k: typeof sort) => (sort === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '');
  const aria = (k: typeof sort) => (sort === k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const open = (kind: 'view' | 'edit' | 'delete', reg: Reg) => { setMode({ kind, reg }); setName(reg.username); setFormErr(''); };

  async function save() {
    const err = validateUsername(name); if (err) { setFormErr(err); return; }
    setBusy(true); setFormErr('');
    try { await api.edit(mode!.reg.id, name.trim()); setMode(null); setNote('Username updated.'); await load(); }
    catch (e) { if (e instanceof AuthError) onAuthLost(); else setFormErr((e as Error).message); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setFormErr('');
    try { await api.remove(mode!.reg.id); setMode(null); setNote('Registration deleted.'); await load(); }
    catch (e) { if (e instanceof AuthError) onAuthLost(); else setFormErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="regs-h" className="a-fade">
      <h2 id="regs-h" className="a-h">Registrations {data && <small>{data.total.toLocaleString()} {data.total === 1 ? 'match' : 'matches'}</small>}</h2>
      <div className="a-filters">
        <label>Search<input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Username or number" autoComplete="off" /></label>
        <label>From<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></label>
        <label>To<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></label>
        {(q || from || to) && <button className="a-btn a-ghost" onClick={() => { setQ(''); setFrom(''); setTo(''); }}>Clear filters</button>}
      </div>
      <p className="a-note" role="status" aria-live="polite">{note}</p>
      {error && <p className="a-err" role="alert">{error} <button className="a-link" onClick={() => void load()}>Retry</button></p>}
      <div className={`a-table-wrap${loading ? ' is-loading' : ''}`}>
        <table className="a-tbl">
          <thead><tr>
            <th aria-sort={aria('username')}><button onClick={() => sortBy('username')}>Username{arrow('username')}</button></th>
            <th aria-sort={aria('phone')}><button onClick={() => sortBy('phone')}>Phone{arrow('phone')}</button></th>
            <th aria-sort={aria('created')}><button onClick={() => sortBy('created')}>Registered{arrow('created')}</button></th>
            <th><span className="sr">Actions</span></th></tr></thead>
          <tbody>
            {loading && !data && [0, 1, 2, 3, 4].map(i => <tr key={i} className="a-skel-row"><td colSpan={4}><div className="a-skel" /></td></tr>)}
            {data?.rows.map(r => (
              <tr key={r.id}>
                <td data-label="Username"><b>{r.username}</b></td><td data-label="Phone">{r.phone}</td><td data-label="Registered">{when(r.createdAt)}</td>
                <td className="a-actions"><button className="a-btn a-sm" onClick={() => open('view', r)}>View</button><button className="a-btn a-sm" onClick={() => open('edit', r)}>Edit</button><button className="a-btn a-sm a-danger" onClick={() => open('delete', r)}>Delete</button></td>
              </tr>))}
          </tbody>
        </table>
        {data && data.rows.length === 0 && <p className="a-empty">{data.total === 0 && !dq && !from && !to ? 'No registrations yet. New sign-ups appear here instantly.' : 'No registrations match these filters.'}</p>}
      </div>
      <nav className="a-pager" aria-label="Pagination">
        <button className="a-btn a-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="a-btn a-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button>
      </nav>

      <Modal open={mode?.kind === 'view'} onClose={() => setMode(null)} title="Registration details">
        {mode && <dl className="a-dl"><dt>Username</dt><dd>{mode.reg.username}</dd><dt>Phone</dt><dd>{mode.reg.phone}</dd><dt>Consent given</dt><dd>{when(mode.reg.consentedAt)}</dd><dt>Registered</dt><dd>{when(mode.reg.createdAt)}</dd><dt>Record ID</dt><dd><code>{mode.reg.id}</code></dd></dl>}
        <div className="a-row"><button className="a-btn" onClick={() => setMode(null)}>Close</button></div>
      </Modal>
      <Modal open={mode?.kind === 'edit'} onClose={() => setMode(null)} title="Edit username">
        <p className="a-mute">The phone number can't be edited, because consent was given for that number.</p>
        <label>Username<input value={name} onChange={e => setName(e.target.value)} maxLength={30} aria-invalid={!!formErr} /></label>
        {formErr && <p className="a-err" role="alert">{formErr}</p>}
        <div className="a-row"><button className="a-btn a-ghost" onClick={() => setMode(null)}>Cancel</button><button className="a-btn" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </Modal>
      <Modal open={mode?.kind === 'delete'} onClose={() => setMode(null)} title="Delete this registration?">
        {mode && <p>This permanently removes <b>{mode.reg.username}</b> ({mode.reg.phone}) from the database and from future files. It can't be undone, and copies already saved on phones stay there.</p>}
        {formErr && <p className="a-err" role="alert">{formErr}</p>}
        <div className="a-row"><button className="a-btn a-ghost" onClick={() => setMode(null)}>Cancel</button><button className="a-btn a-danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</button></div>
      </Modal>
    </section>
  );
}
