import { Link } from 'react-router';

function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1 className="brand">404</h1>
        <p className="muted">We could not find that page.</p>
        <Link to="/dashboard" className="button">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export default NotFound;