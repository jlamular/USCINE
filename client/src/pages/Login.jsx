import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import ErrorList from '../components/ErrorList';
import { useAuth } from '../hooks/useAuth';

function Login() {
  const { user, login } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  // Already logged in (or just logged in): go to the dashboard
  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors([]);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (error) {
      setErrors(error.errors ?? ['Something went wrong. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h2 className="page-title">Log in</h2>

      <form className="form" onSubmit={handleSubmit}>
        <ErrorList errors={errors} />

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      <p className="form-footer">
        New here? <Link to="/register" state={location.state}>Create an account</Link>
      </p>
    </>
  );
}

export default Login;