import { Link, Outlet } from 'react-router';
import { useAuth } from '../hooks/useAuth';

function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="brand-left">
          <Link to="/dashboard" className="brand-link">
            Watch Together
          </Link>
        </h1>

        <div className="header-user">
          <span>{user.displayName}</span>
          <button className="button button-secondary" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

export default AppLayout;