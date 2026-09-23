import avatar from '@/assets/avatar.webp';

const PROFILE = 'https://tomfluff.github.io/';
// Assembled at runtime so the address is not a literal in the bundle.
const MAIL = ['sechayk-yotam', 'g.ecc.u-tokyo.ac.jp'];

export function Footer() {
  const href = `mailto:${MAIL[0]}@${MAIL[1]}?subject=${encodeURIComponent('SlideNotes feedback')}`;
  return (
    <footer className="foot">
      <span>Created with love and care by</span>
      <a className="foot-link" href={PROFILE} target="_blank" rel="noreferrer">
        <img className="foot-av" src={avatar} alt="" aria-hidden="true" />
        <b>Yotam Sechayk</b>
      </a>
      <span>
        — <a className="foot-mail" href={href}>reach out</a> with any questions. Your slides stay in your browser.
      </span>
    </footer>
  );
}
