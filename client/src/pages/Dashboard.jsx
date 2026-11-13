import { useState } from 'react';
import ErrorList from '../components/ErrorList';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/dateUtils';

function Dashboard() {
  const { user, logout, updateDisplayName } = useAuth();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(event) {
    event.preventDefault();
    setErrors([]);
    setSuccessMessage('');
    setIsSaving(true);

    try {
      await updateDisplayName(displayName);
      setSuccessMessage('Display name updated.');
    } catch (error) {
      setErrors(error.errors ?? ['Something went wrong. Please try again.']);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="brand-left">Watch Together</h1>
        <div className="header-user">
          <span>{user.displayName}</span>
          <button className="button button-secondary" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <section className="card">
        <h2>Your account</h2>
        <p className="muted">Email: {user.email}</p>
        <p className="muted">Member since: {formatDate(user.createdAt)}</p>

        <form className="form" onSubmit={handleSave}>
          <ErrorList errors={errors} />
          {successMessage && <p className="success-message">{successMessage}</p>}

          <div className="field">
            <label htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={32}
              required
            />
          </div>

          <button className="button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save display name'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Your rooms</h2>
        <p className="muted">Creating and joining watch rooms arrives in Phase 4.</p>
      </section>
    </div>
  );
}

export default Dashboard;