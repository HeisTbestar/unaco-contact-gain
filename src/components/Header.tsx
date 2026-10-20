import { BRAND } from '../config/brand';
import { LINKS } from '../config/links';
import { Icon } from './Icon';
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <span className="logo-wrap" style={{ width: size, height: size }}>
      <img className="logo" src="/logo-96.webp" srcSet="/logo-96.webp 1x, /logo-192.webp 2x" width={size} height={size} alt="UNIOSUN News and Cruise Official logo" />
    </span>
  );
}
export function Header() {
  return (
    <header className="site-header"><div className="wrap">
      <div className="bar glass">
        <a className="brand" href="#home" data-track="brand_home" aria-label="UNACO Contact Gain home"><Logo /><span><strong>{BRAND.short}</strong><small>{BRAND.product}</small></span></a>
        <nav aria-label="Main" className="nav"><a href="#home" data-track="nav_home">Home</a><a href="#how" data-track="nav_how">How it works</a><a href="#register" data-track="nav_register">Add contact</a><a href="#faq" data-track="nav_faq">FAQs</a></nav>
        <a className="btn btn-sm" data-track="header_channel" href={LINKS.whatsappChannel.href} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp channel (opens in a new tab)"><Icon name="send" size={16} /><span>WhatsApp<span className="xs-hide"> channel</span></span></a>
      </div>
    </div></header>
  );
}
