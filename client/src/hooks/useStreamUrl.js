import { useCallback, useEffect, useState } from 'react';
import { buildStreamUrl, createStreamToken } from '../services/videoService';

// Turns a video id into a playable URL by asking the API for a stream token.
// refresh() fetches a new token (used when the old link expired).
export function useStreamUrl(videoId) {
  const [result, setResult] = useState({ videoId: null, url: null, error: null });
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (!videoId) {
      return undefined;
    }

    let isCancelled = false;

    async function requestToken() {
      try {
        const response = await createStreamToken(videoId);
        if (!isCancelled) {
          setResult({ videoId, url: buildStreamUrl(videoId, response.token), error: null });
        }
      } catch (error) {
        if (!isCancelled) {
          setResult({ videoId, url: null, error });
        }
      }
    }

    requestToken();

    return () => {
      isCancelled = true;
    };
  }, [videoId, refreshCount]);

  const refresh = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  // Ignore a result that belongs to a video that is no longer selected
  const isCurrent = result.videoId === videoId;

  return {
    streamUrl: isCurrent ? result.url : null,
    error: isCurrent ? result.error : null,
    refresh,
  };
}