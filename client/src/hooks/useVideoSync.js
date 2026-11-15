import { useCallback, useEffect, useRef, useState } from 'react';
import { HubMethods } from '../services/signalrService';
import { SYNC, decideCorrection, getExpectedPosition, pickBestClockSample } from '../utils/syncUtils';

// Keeps this browser's video in step with the host's.
//   playback             the newest PlaybackUpdated message (the "anchor")
//   playerReadyCount     goes up every time the <video> finishes loading its metadata
//   commandInFlightRef   true while the host's own command is on its way to the server
//   onServerState        called with the server's answer to a host command
export function useVideoSync({
  roomId,
  videoRef,
  videoId,
  playback,
  isHost,
  status,
  invoke,
  playerReadyCount,
  commandInFlightRef,
  onServerState,
}) {
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const [syncInfo, setSyncInfo] = useState({ driftSeconds: 0, roundTripMs: null, rate: 1 });
  const [commandError, setCommandError] = useState('');

  const playbackRef = useRef(playback);
  const clockOffsetRef = useRef(null); // server clock minus this computer's clock, in milliseconds
  const roundTripRef = useRef(null);
  const appliedRef = useRef({ version: -1, readyCount: -1 });
  const needsInteractionRef = useRef(false);
  const lastHardSeekAtRef = useRef(0);
  const lastHostActionAtRef = useRef(0);

  // The host may only act while the connection is working, so no command can get lost
  const canControl = isHost && status === 'connected';

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  // "Now" on the SERVER's clock, as best we can estimate
  const getServerNowMs = useCallback(() => Date.now() + (clockOffsetRef.current ?? 0), []);

  const setInteractionNeeded = useCallback((value) => {
    needsInteractionRef.current = value;
    setNeedsInteraction(value);
  }, []);

  const startPlayback = useCallback(
    (video) => {
      const playPromise = video.play();

      if (playPromise) {
        playPromise.catch((error) => {
          // The browser refuses to start a video with sound until the person clicks something
          if (error.name === 'NotAllowedError') {
            setInteractionNeeded(true);
          }
        });
      }
    },
    [setInteractionNeeded],
  );

  // Moves this video to where the server says it should be, and starts or stops it
  const applyPlayback = useCallback(
    (video, state) => {
      // First message of the session: use it for a rough clock estimate until the ping measurement finishes
      if (clockOffsetRef.current === null) {
        clockOffsetRef.current = state.serverTimeUnixMs - Date.now();
      }

      const expectedPosition = getExpectedPosition(state, getServerNowMs(), video.duration);
      const tolerance = state.isPlaying ? SYNC.toleranceSeconds : SYNC.pausedToleranceSeconds;

      if (Math.abs(video.currentTime - expectedPosition) > tolerance) {
        video.currentTime = expectedPosition;
        lastHardSeekAtRef.current = Date.now();
      }

      video.playbackRate = 1;

      if (state.isPlaying) {
        if (video.paused) {
          startPlayback(video);
        }
      } else if (!video.paused) {
        video.pause();
      }
    },
    [getServerNowMs, startPlayback],
  );

  // 1. Measure how far this computer's clock is from the server's, using a few quick pings
  useEffect(() => {
    if (status !== 'connected') {
      return undefined;
    }

    let isCancelled = false;

    async function measureClockOffset() {
      const samples = [];

      for (let index = 0; index < SYNC.clockSamples; index += 1) {
        const wallClockAtSend = Date.now();
        const startedAt = performance.now();
        let serverTimeMs;

        try {
          serverTimeMs = await invoke(HubMethods.GetServerTime);
        } catch {
          return; // the connection dropped. We measure again after it comes back.
        }

        const roundTripMs = performance.now() - startedAt;

        // We assume the server stamped its time halfway through the round trip
        samples.push({ roundTripMs, offsetMs: serverTimeMs - (wallClockAtSend + roundTripMs / 2) });
      }

      const best = pickBestClockSample(samples);

      if (!isCancelled && best) {
        clockOffsetRef.current = best.offsetMs;
        roundTripRef.current = best.roundTripMs;
      }
    }

    measureClockOffset();
    const timerId = setInterval(measureClockOffset, SYNC.clockResyncIntervalMs);

    return () => {
      isCancelled = true;
      clearInterval(timerId);
    };
  }, [status, invoke]);

  // 2. When a new playback state arrives (or the player finishes loading), apply it
  useEffect(() => {
    if (!playback || !videoId || playback.videoId !== videoId) {
      return;
    }

    const video = videoRef.current;

    // The video is not ready yet. This effect runs again when the player reports it is.
    if (!video || video.readyState < 1) {
      return;
    }

    const applied = appliedRef.current;
    const alreadyApplied = applied.version >= playback.version && applied.readyCount === playerReadyCount;

    if (alreadyApplied) {
      return;
    }

    appliedRef.current = { version: playback.version, readyCount: playerReadyCount };

    // The host's own player already did what the host asked for. Do not "correct" it with the echo.
    if (isHost && playback.isOwnEcho && applied.readyCount === playerReadyCount) {
      return;
    }

    applyPlayback(video, playback);
  }, [playback, videoId, playerReadyCount, isHost, videoRef, applyPlayback]);

  // The host's actions: do it locally right away, then tell the server
  const sendCommand = useCallback(
    async (methodName, positionSeconds) => {
      commandInFlightRef.current = true;
      lastHostActionAtRef.current = Date.now();

      try {
        const state = await invoke(methodName, roomId, positionSeconds);
        onServerState(state);
        setCommandError('');
        return true;
      } catch {
        setCommandError('That action did not reach the server. The player was put back in sync.');
        return false;
      } finally {
        commandInFlightRef.current = false;
      }
    },
    [invoke, roomId, onServerState, commandInFlightRef],
  );

  // Puts this player back to what the server says. Also what the "Click to join" button does.
  const resync = useCallback(() => {
    const video = videoRef.current;
    const state = playbackRef.current;

    if (!video || !state || !videoId || state.videoId !== videoId || video.readyState < 1) {
      return;
    }

    setInteractionNeeded(false);
    applyPlayback(video, state);
  }, [videoRef, videoId, applyPlayback, setInteractionNeeded]);

  const requestPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video || !canControl) {
      return;
    }

    startPlayback(video);

    const succeeded = await sendCommand(HubMethods.PlayVideo, video.currentTime);
    if (!succeeded) {
      resync();
    }
  }, [videoRef, canControl, startPlayback, sendCommand, resync]);

  const requestPause = useCallback(async () => {
    const video = videoRef.current;

    if (!video || !canControl) {
      return;
    }

    video.pause();

    const succeeded = await sendCommand(HubMethods.PauseVideo, video.currentTime);
    if (!succeeded) {
      resync();
    }
  }, [videoRef, canControl, sendCommand, resync]);

  const requestSeek = useCallback(
    async (targetSeconds) => {
      const video = videoRef.current;

      if (!video || !canControl) {
        return;
      }

      video.currentTime = targetSeconds;

      const succeeded = await sendCommand(HubMethods.SeekVideo, targetSeconds);
      if (!succeeded) {
        resync();
      }
    },
    [videoRef, canControl, sendCommand, resync],
  );

  // When the host's video reaches the end, the server should stop "playing" it too
  const requestEnded = useCallback(async () => {
    const video = videoRef.current;
    const state = playbackRef.current;

    if (!video || !canControl || !state || !state.isPlaying) {
      return;
    }

    await sendCommand(HubMethods.PauseVideo, video.duration);
  }, [videoRef, canControl, sendCommand]);

  // 3. Every second: compare this video with where it should be, and correct gently
  useEffect(() => {
    function reanchorHostIfNeeded(video, state, driftSeconds) {
      if (status !== 'connected' || commandInFlightRef.current) {
        return;
      }

      if (!state.isPlaying || video.paused) {
        return;
      }

      if (Math.abs(driftSeconds) <= SYNC.hostReanchorSeconds) {
        return;
      }

      if (Date.now() - lastHostActionAtRef.current < SYNC.minReanchorGapMs) {
        return;
      }

      // The host's video stalled or jumped. The host is the leader, so the server follows the host.
      sendCommand(HubMethods.SeekVideo, video.currentTime);
    }

    function correctViewer(video, state, expectedPosition, driftSeconds) {
      // Keep the viewer's play/pause state matching the host's
      if (state.isPlaying && video.paused) {
        startPlayback(video);
        return;
      }

      if (!state.isPlaying && !video.paused) {
        video.pause();
      }

      const correction = decideCorrection(state.isPlaying, driftSeconds);

      if (correction.type === 'seek') {
        const now = Date.now();

        if (now - lastHardSeekAtRef.current < SYNC.minHardSeekGapMs) {
          return;
        }

        lastHardSeekAtRef.current = now;
        video.currentTime = expectedPosition;
        video.playbackRate = 1;
      } else if (video.playbackRate !== correction.rate) {
        video.playbackRate = correction.rate;
      }
    }

    const timerId = setInterval(() => {
      const video = videoRef.current;
      const state = playbackRef.current;

      if (!video || !state || !videoId || state.videoId !== videoId) {
        return;
      }

      if (video.readyState < 1 || video.ended || needsInteractionRef.current) {
        return;
      }

      const expectedPosition = getExpectedPosition(state, getServerNowMs(), video.duration);
      const driftSeconds = video.currentTime - expectedPosition;

      setSyncInfo({ driftSeconds, roundTripMs: roundTripRef.current, rate: video.playbackRate });

      // A video that is still loading data cannot be judged fairly. Wait until it plays again.
      if (video.seeking || video.readyState < 3) {
        return;
      }

      if (isHost) {
        reanchorHostIfNeeded(video, state, driftSeconds);
      } else {
        correctViewer(video, state, expectedPosition, driftSeconds);
      }
    }, SYNC.driftCheckIntervalMs);

    return () => clearInterval(timerId);
  }, [videoId, isHost, status, videoRef, getServerNowMs, startPlayback, sendCommand, commandInFlightRef]);

  return {
    canControl,
    needsInteraction,
    joinPlayback: resync,
    requestPlay,
    requestPause,
    requestSeek,
    requestEnded,
    syncInfo,
    commandError,
  };
}