import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoomConnection, HubEvents, HubMethods } from '../services/signalrService';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// status is one of: 'connecting', 'connected', 'reconnecting', 'disconnected'
export function useSignalR(roomId, handlers) {
  const [status, setStatus] = useState('connecting');
  const [attempt, setAttempt] = useState(0);

  // Always points at the latest handlers, so changing a handler never restarts the connection
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    // No room yet (still loading, or the user is not a member): do not connect
    if (!roomId) {
      return undefined;
    }

    let isCancelled = false;
    const connection = createRoomConnection();

    function updateStatus(newStatus) {
      if (!isCancelled) {
        setStatus(newStatus);
      }
    }

    async function joinRoom() {
      try {
        await connection.invoke(HubMethods.JoinRoom, roomId);
        updateStatus('connected');
      } catch {
        if (isCancelled) {
          return;
        }

        // The server refused: we are not a member of this room (any more). Retrying will not help.
        updateStatus('disconnected');
        handlersRef.current.onJoinFailed?.();
        await connection.stop();
      }
    }

    connection.on(HubEvents.RoomStateUpdated, (state) => {
      handlersRef.current.onRoomStateUpdated?.(state);
    });

    connection.on(HubEvents.RoomClosed, (closedRoomId) => {
      handlersRef.current.onRoomClosed?.(closedRoomId);
    });

    connection.onreconnecting(() => updateStatus('reconnecting'));

    connection.onreconnected(() => {
      // A reconnect gives us a NEW connection id, so the server has forgotten that we were in the room.
      joinRoom();
    });

    connection.onclose(() => updateStatus('disconnected'));

    async function connect() {
      let failedAttempts = 0;

      // Automatic reconnect only covers a connection that was already working,
      // so the very first start gets its own retry loop.
      while (!isCancelled) {
        try {
          await connection.start();
          break;
        } catch {
          if (isCancelled) {
            return;
          }

          failedAttempts += 1;
          updateStatus('reconnecting');
          await wait(Math.min(1000 * failedAttempts, 10000));
        }
      }

      if (!isCancelled) {
        await joinRoom();
      }
    }

    connect();

    return () => {
      isCancelled = true;
      connection.stop();
    };
  }, [roomId, attempt]);

  const reconnect = useCallback(() => {
    setStatus('connecting');
    setAttempt((count) => count + 1);
  }, []);

  return { status, reconnect };
}