import { LINKS } from '../config/links';
import { BRAND } from '../config/brand';
import { Icon } from './Icon';
import { Logo } from './Header';
import { Phone } from './Phone';

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
const R = (d = 0) => ({ className: 'reveal', style: { ['--d' as string]: `${d}ms` } });

export function Hero() {
  return (
    <section id="home" className="hero"><div className="wrap hero-grid">
      <div>
        <p className="pill glass reveal"><Icon name="users" size={16} />UNIOSUN freshmen connect</p>
        <h1 {...R(60)}>Get your fellow <span className="grad">freshmen's</span> contacts <span className="script">Stay connected</span></h1>
        <p className="lead reveal" style={{ ['--d' as string]: '120ms' }}>Add your username and number. UNACO puts everyone who signs up into one contact file and posts it in the 3080 Freshmen Connect WhatsApp group, so you can save everyone in one go.</p>
        <ul className="chips reveal" style={{ ['--d' as string]: '180ms' }}>
          <li className="glass"><Icon name="shield" /><span><b>Consent first</b><small>You choose to share</small></span></li>
          <li className="glass"><Icon name="file" /><span><b>Name and number</b><small>Nothing else shared</small></span></li>
          <li className="glass"><Icon name="remove" /><span><b>Easy removal</b><small>Opt out any time</small></span></li>
        </ul>
        <div className="row reveal" style={{ ['--d' as string]: '240ms' }}>
          <a className="btn btn-lg" href="#register"><Icon name="download" size={20} />Add my contact<Icon name="arrow" size={18} /></a>
          <a className="btn btn-glass btn-lg" href="#how">How it works</a>
        </div>
      </div>
      <Phone />
    </div></section>
  );
}

export function Why() {
  const items = [
    ['users', 'For UNIOSUN freshmen', 'Built for freshmen who want everyone in their contacts.'],
    ['shield', 'Consent-based', 'Your number is only shared after you tick the sharing box.'],
    ['file', 'Name and number only', 'Only your username and phone number go in the file.'],
    ['remove', 'Removable', 'Remove your number any time so it is left out of future files.'],
  ];
  return (
    <section className="wrap section" aria-labelledby="why-h"><div className="panel why">
      <div><h2 id="why-h">Why use Contact Gain?</h2><p className="mute">Because staying connected makes university life easier.</p><p className="script dark-script">Same campus, bigger community</p></div>
      <ul className="why-grid">{items.map(([i, t, d], k) => <li key={t} {...R(k * 70)}><span className="ic"><Icon name={i} size={26} /></span><h3>{t}</h3><p>{d}</p></li>)}</ul>
    </div></section>
  );
}

export function How() {
  const steps = [
    ['users', 'Join the group', <>Join the <a href={LINKS.contactGainGroup.href} {...ext}>3080 Freshmen Connect group</a> on WhatsApp.</>],
    ['user', 'Add your contact', 'Enter your username and Nigerian number (up to three of your own) and agree to share them.'],
    ['download', 'Save the contacts', 'When UNACO posts the .vcf file in the group, open it on your phone and save the contacts.'],
  ] as const;
  return (
    <section id="how" className="wrap section" aria-labelledby="how-h"><div className="glass block">
      <div className="block-head"><h2 id="how-h">How it works</h2><p className="light-text">Three simple steps.</p></div>
      <ol className="steps">{steps.map(([ic, t, d], i) => (
        <li key={t} {...R(i * 90)}><span className="n" aria-hidden="true">{i + 1}</span><span className="ic-lite"><Icon name={ic} size={26} /></span><h3>{t}</h3><p>{d}</p></li>))}</ol>
    </div></section>
  );
}

const faqs: [string, string][] = [
  ['Which number formats work?', '07024830789, 2347024830789 and +2347024830789. Spaces and hyphens are fine. Anything else is rejected rather than guessed.'],
  ['Can I add more than one number?', 'Yes, up to three of your own numbers. Only add numbers that belong to you.'],
  ['What if I submit twice?', 'The same number is only stored once. The existing entry is kept.'],
  ['How do I remove my number?', 'Open "Want your number removed?" on this page and enter your number. It is left out of future files. Copies already saved by others cannot be recalled.'],
  ['What if I am not a fresher?', 'The contact file is posted only in the 3080 Freshmen Connect group, and members are verified before they join.'],
];
export function Faq() {
  return (
    <section id="faq" className="wrap section" aria-labelledby="faq-h"><h2 id="faq-h" className="on-dark">FAQs</h2>
      <div className="faq">{faqs.map(([q, a]) => <details key={q} className="glass"><summary>{q}</summary><p>{a}</p></details>)}</div></section>
  );
}

export function Links() {
  return (
    <section className="wrap section" aria-labelledby="links-h"><h2 id="links-h" className="on-dark">Official UNACO links</h2>
      <ul className="links">{Object.values(LINKS).map(l => (
        <li key={l.href} className="glass"><a href={l.href} {...ext}><span>{l.label}<span className="sr"> (opens in a new tab)</span></span><Icon name="ext" size={18} /></a><small>{l.note}</small></li>))}</ul>
      <div className="cta glass">
        <span className="clay-tile sm"><Icon name="send" size={30} /></span>
        <div><h3>Join the 3080 Freshmen Connect Group</h3><p className="light-text">Stay updated and be part of the movement.</p></div>
        <a className="btn btn-wa btn-lg" href={LINKS.contactGainGroup.href} {...ext}><Icon name="chat" size={20} />Join now<span className="sr"> (opens in a new tab)</span></a>
      </div></section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer"><div className="wrap foot">
      <div className="brand"><Logo size={40} /><span><strong>{BRAND.short}</strong><small>{BRAND.product}</small></span></div>
      <p className="light-text">{BRAND.org}. {BRAND.tagline}</p>
      <nav aria-label="Footer"><a href="#remove">Remove my number</a><a href="#faq">FAQs</a><a href={LINKS.startPage.href} {...ext}>Start.page</a></nav>
      <p className="hint light">© {new Date().getFullYear()} UNACO.</p>
    </div></footer>
  );
}
