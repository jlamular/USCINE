import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ChatPanel from '../components/ChatPanel';
import ConnectionStatus from '../components/ConnectionStatus';
import CopyButton from '../components/CopyButton';
import ErrorList from '../components/ErrorList';
import ParticipantList from '../components/ParticipantList';
import VideoLibrary from '../components/VideoLibrary';
import VideoPlayer from '../components/VideoPlayer';
import { useAuth } from '../hooks/useAuth';
import { useConfirm } from '../hooks/useConfirm';
import { usePageTitle } from '../hooks/usePageTitle';
import { useSignalR } from '../hooks/useSignalR';
import { useStreamUrl } from '../hooks/useStreamUrl';
import { useToast } from '../hooks/useToast';
import { useVideoSync } from '../hooks/useVideoSync';
import { deleteRoom, getRoom, leaveRoom, selectCurrentVideo } from '../services/roomService';
import { formatDate } from '../utils/dateUtils';
import { formatDuration, formatFileSize } from '../utils/mediaUtils';
import { buildInviteLink, formatRoomCode } from '../utils/roomUtils';

function WatchRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const { showToast } = useToast();

  const videoRef = useRef(null);
  const commandInFlightRef = useRef(false);

  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionErrors, setActionErrors] = useState([]);
  const [isWorking, setIsWorking] = useState(false);
  const [playback, setPlayback] = useState(null);
  const [playerReadyCount, setPlayerReadyCount] = useState(0);

  usePageTitle(room ? room.roomName : 'Room');

  // Keeps only the NEWEST playback state. Older or repeated messages are ignored by version number.
  // isOwnEcho marks a message that arrived while the host's own command was on its way.
  const acceptPlayback = useCallback((state, isOwnEcho) => {
    setPlayback((current) => {
      if (current && current.roomId === state.roomId && state.version <= current.version) {
        return current;
      }

      return { ...state, isOwnEcho };
    });
  }, []);

  const handleOwnCommandResult = useCallback(
    (state) => {
      acceptPlayback(state, true);
    },
    [acceptPlayback],
  );

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
  const { status, reconnect, invoke, subscribe } = useSignalR(room ? room.id : null, {
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

    onPlaybackUpdated: (state) => {
      acceptPlayback(state, commandInFlightRef.current);
    },

    onRoomClosed: () => {
      // The host who deleted the room is already navigating away on their own
      if (room && !room.isHost) {
        showToast('The host closed that room.', 'info');
        navigate('/dashboard');
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

  // Step 4: keep this video in step with the host's
  const sync = useVideoSync({
    roomId: room ? room.id : null,
    videoRef,
    videoId: currentVideo ? currentVideo.id : null,
    playback,
    isHost: room ? room.isHost : false,
    status,
    invoke,
    playerReadyCount,
    commandInFlightRef,
    onServerState: handleOwnCommandResult,
  });

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
    const confirmed = await confirm({
      title: 'Leave this room?',
      message: 'You will need the room code or an invitation link to join again.',
      confirmLabel: 'Leave room',
    });

    if (!confirmed) {
      return;
    }

    setActionErrors([]);
    setIsWorking(true);

    try {
      await leaveRoom(room.id);
      showToast('You left the room.', 'success');
      navigate('/dashboard');
    } catch (error) {
      setActionErrors(error.errors ?? ['Could not leave the room.']);
      setIsWorking(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: 'Delete this room?',
      message: 'The room, its videos and its chat will be deleted for everyone. This cannot be undone.',
      confirmLabel: 'Delete room',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    setActionErrors([]);
    setIsWorking(true);

    try {
      await deleteRoom(room.id);
      showToast('Room deleted.', 'success');
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

  let controlHint = '';
  if (!room.isHost) {
    controlHint = 'The host controls playback. Your volume and fullscreen are your own.';
  } else if (status !== 'connected') {
    controlHint = 'Reconnecting... playback controls are paused until the connection is back.';
  }

  const driftSeconds = sync.syncInfo.driftSeconds;
  const driftText = `${driftSeconds >= 0 ? '+' : ''}${driftSeconds.toFixed(2)} s`;
  const pingText =
    sync.syncInfo.roundTripMs === null ? 'measuring...' : `${Math.round(sync.syncInfo.roundTripMs)} ms`;

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
              videoRef={videoRef}
              canControl={sync.canControl}
              controlHint={controlHint}
              needsInteraction={sync.needsInteraction}
              onPlayRequested={sync.requestPlay}
              onPauseRequested={sync.requestPause}
              onSeekRequested={sync.requestSeek}
              onEnded={sync.requestEnded}
              onReady={() => setPlayerReadyCount((count) => count + 1)}
              onJoinPlayback={sync.joinPlayback}
            />

            <h3 className="video-title">{currentVideo.fileName}</h3>
            <p className="muted small">
              {formatDuration(currentVideo.durationSeconds)} · {formatFileSize(currentVideo.fileSizeBytes)} · uploaded
              by {currentVideo.uploadedByDisplayName}
            </p>

            {playback && playback.videoId === currentVideo.id && (
              <p className="muted small sync-readout">
                {room.isHost
                  ? `Hosting · ${playback.isPlaying ? 'playing' : 'paused'} · server ping ${pingText} · v${playback.version}`
                  : `${playback.isPlaying ? 'Playing' : 'Paused'} · ${driftText} vs host · server ping ${pingText} · speed ${sync.syncInfo.rate.toFixed(2)}x · v${playback.version}`}
              </p>
            )}

            {sync.commandError && <p className="command-error">{sync.commandError}</p>}
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

        <ChatPanel
          key={room.id}
          roomId={room.id}
          status={status}
          invoke={invoke}
          subscribe={subscribe}
          currentUserId={user.id}
        />

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

      {confirmDialog}
    </div>
  );
}

export default WatchRoom;