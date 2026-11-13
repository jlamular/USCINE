import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import CopyButton from '../components/CopyButton';
import ErrorList from '../components/ErrorList';
import ParticipantList from '../components/ParticipantList';
import { useAuth } from '../hooks/useAuth';
import { deleteRoom, getRoom, leaveRoom } from '../services/roomService';
import { formatDate } from '../utils/dateUtils';
import { buildInviteLink, formatRoomCode } from '../utils/roomUtils';

function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionErrors, setActionErrors] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadRoom() {
      try {
        const loadedRoom = await getRoom(roomId);
        if (!isCancelled) {
          setRoom(loadedRoom);
          setLoadError(null);
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadRoom();

    return () => {
      isCancelled = true;
    };
  }, [roomId, refreshCount]);

  async function handleLeave() {
    const confirmed = window.confirm('Leave this room? You will need the room code to join again.');
    if (!confirmed) {
      return;
    }

    setActionErrors([]);
    setIsWorking(true);

    try {
      await leaveRoom(room.id);
      navigate('/dashboard');
    } catch (error) {
      setActionErrors(error.errors ?? ['Could not leave the room.']);
      setIsWorking(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm('Delete this room for everyone? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setActionErrors([]);
    setIsWorking(true);

    try {
      await deleteRoom(room.id);
      navigate('/dashboard');
    } catch (error) {
      setActionErrors(error.errors ?? ['Could not delete the room.']);
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return <p className="muted">Loading room...</p>;
  }

  if (loadError) {
    const message =
      loadError.status === 404
        ? 'This room does not exist, or you are not a member of it.'
        : loadError.errors?.[0] ?? 'Could not load the room.';

    return (
      <div className="card form-card">
        <h2>Room unavailable</h2>
        <p className="muted">{message}</p>
        <Link to="/dashboard" className="button">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const inviteLink = buildInviteLink(room.roomCode);

  return (
    <div className="room-layout">
      <section className="room-main">
        <h2 className="room-title">{room.roomName}</h2>
        <div className="player-placeholder">
          <p>The video player arrives in Phase 6.</p>
        </div>
      </section>

      <aside className="room-sidebar">
        <div className="card">
          <div className="info-row">
            <h2 style={{ margin: 0 }}>Participants ({room.participants.length})</h2>
            <button
              className="button button-secondary button-small"
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
            >
              Refresh
            </button>
          </div>
          <ParticipantList participants={room.participants} currentUserId={user.id} />
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Room info</h2>

          <p className="info-label">Room code</p>
          <div className="info-row">
            <span className="room-code">{formatRoomCode(room.roomCode)}</span>
            <CopyButton text={room.roomCode} />
          </div>

          <p className="info-label">Invitation link</p>
          <div className="info-row">
            <input className="readonly-input" type="text" value={inviteLink} readOnly />
            <CopyButton text={inviteLink} label="Copy link" />
          </div>

          <p className="muted small">Created {formatDate(room.createdAt)}</p>

          <ErrorList errors={actionErrors} />

          <div className="card-actions">
            {room.isHost ? (
              <button className="button button-danger" type="button" onClick={handleDelete} disabled={isWorking}>
                Delete room
              </button>
            ) : (
              <button className="button button-secondary" type="button" onClick={handleLeave} disabled={isWorking}>
                Leave room
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default WatchRoom;