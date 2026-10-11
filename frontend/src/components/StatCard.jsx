import { Link } from 'react-router-dom';

export default function StatCard({ label, value, tone = 'default', to }) {
  const content = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </>
  );
  const className = `stat-card tone-${tone}`;

  if (to) {
    return (
      <Link to={to} className={`${className} stat-link`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
