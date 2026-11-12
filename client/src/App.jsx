import { useEffect, useState } from 'react';
import { getHealth } from './services/healthService';

function App() {
  const [health, setHealth] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkBackend() {
      try {
        const result = await getHealth();
        setHealth(result);
      } catch (error) {
        if (error.status) {
          setErrorMessage(`The API replied with an error (status ${error.status}). Check the database connection.`);
        } else {
          setErrorMessage('Could not reach the API. Is it running on http://localhost:5000? A CORS problem also looks like this.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    checkBackend();
  }, []);

  return (
    <div style={{ maxWidth: 520, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Watch Together</h1>
      <h2>System check</h2>

      {isLoading && <p>Checking the backend...</p>}

      {errorMessage && <p style={{ color: '#ff6b6b' }}>❌ {errorMessage}</p>}

      {health && (
        <ul>
          <li>✅ API: {health.status}</li>
          <li>✅ Database: {health.database}</li>
          <li>Server time (UTC): {health.serverTimeUtc}</li>
        </ul>
      )}
    </div>
  );
}

export default App;