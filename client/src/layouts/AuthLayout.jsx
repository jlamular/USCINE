import { Outlet } from 'react-router';

function AuthLayout() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand">Watch Together</h1>
        <Outlet />
      </div>
    </div>
  );
}

export default AuthLayout;