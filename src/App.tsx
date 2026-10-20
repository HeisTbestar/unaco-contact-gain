import { Suspense, lazy, useEffect, useState } from 'react';
import { initTracking } from './lib/track';
const AdminApp = lazy(() => import('./admin/AdminApp'));
import { Header } from './components/Header';
import { RegisterForm } from './components/RegisterForm';
import { Hero, Why, How, Faq, Links, Footer } from './components/Sections';
import { RemoveSection } from './components/Remove';

/** Integration boundary: <ContactGain /> can be mounted inside the future UNACO site. */
export function ContactGain() {
  useEffect(() => { initTracking(); }, []);
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (<>
    <Header /><main><Hero />
      <section id="register" className="wrap section" aria-labelledby="reg-h"><h2 id="reg-h" className="on-dark">Add your contact</h2><RegisterForm /></section>
      <RemoveSection /><Why /><How /><Faq /><Links /></main><Footer /></>);
}
const isAdminRoute = () => location.pathname === '/admin' || location.hash === '#admin';
export default function App() {
  const [admin, setAdmin] = useState(isAdminRoute());
  useEffect(() => { const f = () => setAdmin(isAdminRoute()); addEventListener('hashchange', f); addEventListener('popstate', f); return () => { removeEventListener('hashchange', f); removeEventListener('popstate', f); }; }, []);
  return admin ? <Suspense fallback={<p className="a-loading" role="status">Loading admin…</p>}><AdminApp /></Suspense> : <ContactGain />;
}
