import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConnectionStatus from '../components/ConnectionStatus';
import CopyButton from '../components/CopyButton';
import ErrorList from '../components/ErrorList';
import ParticipantList from '../components/ParticipantList';
import VideoLibrary from '../components/VideoLibrary';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../hooks/useAuth';
import { useSignalR } from '../hooks/useSignalR';
import { useStreamUrl } from '../hooks/useStreamUrl';
import { deleteRoom, getRoom, leaveRoom, selectCurrentVideo } from '../services/roomService';
import { formatDate } from '../utils/dateUtils';
import { formatDuration, formatFileSize } from '../utils/mediaUtils';
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

  // Step 1: ask the REST API for the room. This also proves we are a member.
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
  }, [roomId]);

  // Step 2: only after the room is loaded, open the live connection
  const { status, reconnect } = useSignalR(room ? room.id : null, {
    onRoomStateUpdated: (state) => {
      setRoom((currentRoom) => {
        if (!currentRoom) {
          return currentRoom;
        }

        return {
          ...currentRoom,
          participants: state.participants,
          currentVideo: state.currentVideo ?? null,
        };
      });
    },

    onRoomClosed: () => {
      // The host who deleted the room is already navigating away on their own
      if (room && !room.isHost) {
        navigate('/dashboard', { state: { notice: 'The host closed that room.' } });
      }
    },

    onJoinFailed: () => {
      setLoadError({
        status: 404,
        errors: ['This room does not exist, or you are not a member of it.'],
      });
    },
  });

  // Step 3: turn the current video into a playable, token-protected URL
  const currentVideo = room ? room.currentVideo : null;
  const { streamUrl, error: streamError, refresh: refreshStream } = useStreamUrl(
    currentVideo ? currentVideo.id : null,
  );

  async function handleSelectVideo(videoId) {
    const updatedRoom = await selectCurrentVideo(room.id, videoId);

    setRoom((currentRoom) => {
      if (!currentRoom) {
        return currentRoom;
      }

      return { ...currentRoom, currentVideo: updatedRoom.currentVideo };
    });
  }

  function handleVideoDeleted(videoId) {
    setRoom((currentRoom) => {
      if (!currentRoom || currentRoom.currentVideo?.id !== videoId) {
        return currentRoom;
      }

      return { ...currentRoom, currentVideo: null };
    });
  }

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
  const onlineCount = room.participants.filter((participant) => participant.isOnline).length;

  return (
    <div className="room-layout">
      <section className="room-main">
        <div className="room-heading">
          <h2 className="room-title">{room.roomName}</h2>
          <ConnectionStatus status={status} onReconnect={reconnect} />
        </div>

        {currentVideo ? (
          <>
            <VideoPlayer
              key={currentVideo.id}
              src={streamUrl}
              error={streamError ? 'Could not get access to this video.' : null}
              onReload={refreshStream}
            />

            <h3 className="video-title">{currentVideo.fileName}</h3>
            <p className="muted small">
              {formatDuration(currentVideo.durationSeconds)} · {formatFileSize(currentVideo.fileSizeBytes)} · uploaded
              by {currentVideo.uploadedByDisplayName}
            </p>
          </>
        ) : (
          <div className="player-placeholder">
            <p>
              {room.isHost
                ? 'Upload a video below, then choose "Play in room".'
                : 'The host has not chosen a video yet.'}
            </p>
          </div>
        )}

        {room.isHost && (
          <VideoLibrary
            roomId={room.id}
            currentVideoId={currentVideo ? currentVideo.id : null}
            onSelectVideo={handleSelectVideo}
            onVideoDeleted={handleVideoDeleted}
          />
        )}
      </section>

      <aside className="room-sidebar">
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>Participants ({room.participants.length})</h2>
          <p className="muted small" style={{ marginBottom: 16 }}>
            {onlineCount} online
          </p>
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