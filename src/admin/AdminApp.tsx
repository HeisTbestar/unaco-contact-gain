import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Logo } from '../components/Header';
import { setTrackingOptOut } from '../lib/track';
import { login } from './api';
import { Dashboard } from './Dashboard';
import './admin.css';

function Login({ onDone }: { onDone: () => void }) {
  const [pass, setPass] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr('');
    try { await login(pass); setPass(''); setTrackingOptOut(true); onDone(); } // admin browsers are excluded from visitor counts by default
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <main className="a-login a-fade">
      <form className="a-login-card" onSubmit={go}>
        <Logo size={56} />
        <h1>Admin sign-in</h1>
        <p className="a-mute">Enter the admin passcode to open the dashboard.</p>
        <label>Passcode<input type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} autoFocus required aria-invalid={!!err} aria-describedby={err ? 'login-err' : undefined} /></label>
        {err && <p id="login-err" className="a-err" role="alert">{err}</p>}
        <button className="a-btn" disabled={busy || !pass}>{busy ? 'Checking…' : 'Sign in'}</button>
        <a href="/" className="a-link">← Back to the public site</a>
      </form>
    </main>
  );
}

export default function AdminApp() {
  const [screen, setScreen] = useState<'dash' | 'login'>('dash'); // optimistic: the first API call answers 401 if there's no valid session
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m);
    const prev = document.title; document.title = 'Admin | UNACO Contact Gain';
    return () => { m.remove(); document.title = prev; };
  }, []);
  const lost = useCallback(() => setScreen('login'), []);
  return screen === 'login' ? <Login onDone={() => { setEpoch(e => e + 1); setScreen('dash'); }} /> : <Dashboard key={epoch} onAuthLost={lost} />;
}
