import { useEffect, useRef, useState } from 'react';
import { formatDuration } from '../utils/mediaUtils';

function describeMediaError(mediaError) {
  if (mediaError.code === MediaError.MEDIA_ERR_NETWORK) {
    return 'A network problem interrupted the video.';
  }

  if (mediaError.code === MediaError.MEDIA_ERR_DECODE) {
    return 'Your browser could not decode this video.';
  }

  return 'The video could not be played. The format may not be supported by this browser, or the access link may have expired.';
}

function VideoPlayer({ src, error, onReload }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const lastTimeRef = useRef(0);
  const resumeAtRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    setDuration(video.duration);
    setPlaybackError('');

    // After "Try again", continue from where the video stopped
    if (resumeAtRef.current > 0) {
      video.currentTime = resumeAtRef.current;
      resumeAtRef.current = 0;
    }
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    lastTimeRef.current = video.currentTime;

    if (!isScrubbing) {
      setCurrentTime(video.currentTime);
    }
  }

  function handleVolumeChange() {
    const video = videoRef.current;
    setVolume(video.volume);
    setIsMuted(video.muted);
  }

  function handleVideoError() {
    const mediaError = videoRef.current?.error;

    // "Aborted" just means the source changed or the user left
    if (!mediaError || mediaError.code === MediaError.MEDIA_ERR_ABORTED) {
      return;
    }

    setIsPlaying(false);
    setIsBuffering(false);
    setPlaybackError(describeMediaError(mediaError));
  }

  function handleRetry() {
    resumeAtRef.current = lastTimeRef.current;
    setPlaybackError('');
    onReload();
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused || video.ended) {
      video.play().catch(() => {
        // The browser refused or the request was interrupted. Nothing to do.
      });
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    videoRef.current.muted = !videoRef.current.muted;
  }

  function handleVolumeSlider(event) {
    const video = videoRef.current;
    const newVolume = Number(event.target.value);
    video.volume = newVolume;
    video.muted = newVolume === 0;
  }

  // While dragging, only the slider moves. The video jumps when you let go.
  function handleScrub(event) {
    setIsScrubbing(true);
    setScrubTime(Number(event.target.value));
  }

  function commitSeek() {
    if (!isScrubbing) {
      return;
    }

    videoRef.current.currentTime = scrubTime;
    setCurrentTime(scrubTime);
    setIsScrubbing(false);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen().catch(() => {
        // Fullscreen can be refused by the browser. Nothing to do.
      });
    }
  }

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const message = error || playbackError;
  const isPreparing = !src && !error;

  return (
    <div className="video-player" ref={containerRef}>
      <div className="video-stage">
        {src ? (
          <video
            ref={videoRef}
            className="video-element"
            src={src}
            preload="metadata"
            playsInline
            onClick={togglePlay}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => {
              setIsBuffering(false);
              setIsPlaying(true);
            }}
            onCanPlay={() => setIsBuffering(false)}
            onVolumeChange={handleVolumeChange}
            onError={handleVideoError}
          />
        ) : (
          <div className="video-element" />
        )}

        {isPreparing && (
          <div className="player-overlay">
            <p>Preparing video...</p>
          </div>
        )}

        {src && isBuffering && !message && (
          <div className="player-overlay overlay-passive">
            <p>Buffering...</p>
          </div>
        )}

        {message && (
          <div className="player-overlay">
            <p>{message}</p>
            <button className="button button-small" type="button" onClick={handleRetry}>
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="player-controls">
        <button
          className="control-button"
          type="button"
          onClick={togglePlay}
          disabled={!src}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>

        <span className="control-time">
          {formatDuration(displayTime)} / {formatDuration(duration)}
        </span>

        <input
          className="seek-bar"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={displayTime}
          disabled={!duration}
          onChange={handleScrub}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          aria-label="Seek"
        />

        <button
          className="control-button"
          type="button"
          onClick={toggleMute}
          disabled={!src}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? '🔇' : '🔊'}
        </button>

        <input
          className="volume-bar"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          disabled={!src}
          onChange={handleVolumeSlider}
          aria-label="Volume"
        />

        <button
          className="control-button"
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}

export default VideoPlayer;