import { Icon } from './Icon';
const rows = [['Anomene', '+234 80X XXX XXXX'], ['Ogunmepon', '+234 81X XXX XXXX'], ['Lamidi Dodoyo', '+234 70X XXX XXXX'], ['Tolu', '+234 90X XXX XXXX']];
export function Phone() {
  return (
    <figure className="phone-stage">
      <div className="phone" aria-hidden="true">
        <div className="phone-top"><span className="dot" /><div><b>UNACO</b><small>Contact Gain</small></div></div>
        <ul>{rows.map(([n, p], i) => <li key={i}><span className="av">{n[0]}</span><span><b>{n}</b><small>{p}</small></span></li>)}</ul>
      </div>
      <div className="float-chip glass" aria-hidden="true"><span>Just</span><b>Username</b><span>+ Number</span></div>
      <div className="float-tile clay-tile" aria-hidden="true"><Icon name="user" size={44} /></div>
      <figcaption className="hint light">Sample preview. Names and numbers are placeholders.</figcaption>
    </figure>
  );
}
