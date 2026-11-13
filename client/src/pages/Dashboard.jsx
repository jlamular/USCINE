import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import ErrorList from '../components/ErrorList';
import RoomCard from '../components/RoomCard';
import { useAuth } from '../hooks/useAuth';
import { getMyRooms } from '../services/roomService';
import { formatDate } from '../utils/dateUtils';

function Dashboard() {
  const { user, updateDisplayName } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomErrors, setRoomErrors] = useState([]);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [nameErrors, setNameErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadRooms() {
      try {
        const loadedRooms = await getMyRooms();
        if (!isCancelled) {
          setRooms(loadedRooms);
        }
      } catch (error) {
        if (!isCancelled) {
          setRoomErrors(error.errors ?? ['Could not load your rooms.']);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRooms(false);
        }
      }
    }

    loadRooms();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSaveName(event) {
    event.preventDefault();
    setNameErrors([]);
    setSuccessMessage('');
    setIsSaving(true);

    try {
      await updateDisplayName(displayName);
      setSuccessMessage('Display name updated.');
    } catch (error) {
      setNameErrors(error.errors ?? ['Something went wrong. Please try again.']);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <section>
        <div className="toolbar">
          <h2>Your rooms</h2>
          <div className="toolbar-actions">
            <Link to="/rooms/join" className="button button-secondary">
              Join room
            </Link>
            <Link to="/rooms/new" className="button">
              Create room
            </Link>
          </div>
        </div>

        <ErrorList errors={roomErrors} />

        {isLoadingRooms && <p className="muted">Loading your rooms...</p>}

        {!isLoadingRooms && roomErrors.length === 0 && rooms.length === 0 && (
          <div className="empty-state">
            <p>You are not in any rooms yet.</p>
            <p>Create one, or join a friend's room with its code.</p>
          </div>
        )}

        {rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 32 }}>
        <h2>Your account</h2>
        <p className="muted">Email: {user.email}</p>
        <p className="muted">Member since: {formatDate(user.createdAt)}</p>

        <form className="form" onSubmit={handleSaveName}>
          <ErrorList errors={nameErrors} />
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
    </>
  );
}

export default Dashboard;