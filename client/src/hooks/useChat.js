import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages } from '../services/chatService';
import { HubEvents, HubMethods } from '../services/signalrService';
import { extractHubErrorMessage, mergeMessages } from '../utils/chatUtils';

// How many messages to load at a time. The server accepts 1 to 100.
const PAGE_SIZE = 50;

export function useChat({ roomId, status, invoke, subscribe }) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [sendError, setSendError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const messagesRef = useRef(messages);
  const hasLoadedHistoryRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 1. Live messages pushed by the server
  useEffect(() => {
    return subscribe(HubEvents.ReceiveMessage, (message) => {
      if (message.roomId !== roomId) {
        return;
      }

      setMessages((current) => mergeMessages(current, [message]));
    });
  }, [subscribe, roomId]);

  // 2. History on the first connection, and "catch up" on every later one
  useEffect(() => {
    if (!roomId || status !== 'connected') {
      return undefined;
    }

    let isCancelled = false;

    async function loadMessages() {
      try {
        if (!hasLoadedHistoryRef.current) {
          const latest = await getMessages(roomId, { limit: PAGE_SIZE });

          if (isCancelled) {
            return;
          }

          setMessages((current) => mergeMessages(current, latest));
          setHasOlder(latest.length === PAGE_SIZE);
          hasLoadedHistoryRef.current = true;
        } else {
          // We were disconnected for a while. Ask for everything after the newest message we have.
          const known = messagesRef.current;
          let cursor = known.length > 0 ? known[known.length - 1].id : 0;
          let keepGoing = true;

          while (keepGoing && !isCancelled) {
            const newer = await getMessages(roomId, { after: cursor, limit: PAGE_SIZE });

            if (isCancelled) {
              return;
            }

            if (newer.length > 0) {
              setMessages((current) => mergeMessages(current, newer));
              cursor = newer[newer.length - 1].id;
            }

            keepGoing = newer.length === PAGE_SIZE;
          }
        }

        setLoadError('');
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error.errors?.[0] ?? 'Could not load the messages.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      isCancelled = true;
    };
  }, [roomId, status, reloadCount]);

  // 3. "Load earlier messages"
  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];

    if (!oldest) {
      return;
    }

    setIsLoadingOlder(true);

    try {
      const older = await getMessages(roomId, { before: oldest.id, limit: PAGE_SIZE });
      setMessages((current) => mergeMessages(current, older));
      setHasOlder(older.length === PAGE_SIZE);
    } catch (error) {
      setLoadError(error.errors?.[0] ?? 'Could not load earlier messages.');
    } finally {
      setIsLoadingOlder(false);
    }
  }, [roomId]);

  // 4. Sending. The hub answers with the saved message, which we show straight away.
  const sendMessage = useCallback(
    async (text) => {
      setSendError('');

      try {
        const message = await invoke(HubMethods.SendMessage, roomId, text);
        setMessages((current) => mergeMessages(current, [message]));
        return true;
      } catch (error) {
        setSendError(extractHubErrorMessage(error));
        return false;
      }
    },
    [invoke, roomId],
  );

  const retryLoad = useCallback(() => {
    setLoadError('');
    setReloadCount((count) => count + 1);
  }, []);

  return {
    messages,
    isLoading,
    loadError,
    hasOlder,
    isLoadingOlder,
    sendError,
    loadOlder,
    sendMessage,
    retryLoad,
  };
}