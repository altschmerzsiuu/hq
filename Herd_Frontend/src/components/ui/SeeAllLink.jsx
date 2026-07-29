// src/components/ui/SeeAllLink.jsx
import { Link } from 'react-router-dom';

export default function SeeAllLink({ label = 'Lihat semua', onClick, to }) {
  const content = (
    <span className="see-all-link">
      {label}
      <span className="see-all-arrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </span>
    </span>
  );

  if (to) return <Link to={to} style={{ textDecoration: 'none' }}>{content}</Link>;
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
      {content}
    </button>
  );
}
