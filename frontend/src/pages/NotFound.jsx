import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center-page">
      <h2>Page not found</h2>
      <Link to="/">Go to home</Link>
    </div>
  );
}
