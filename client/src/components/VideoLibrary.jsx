import { useEffect, useState } from 'react';
import ErrorList from './ErrorList';
import VideoUploader from './VideoUploader';
import { deleteVideo, getRoomVideos } from '../services/videoService';
import { formatDuration, formatFileSize } from '../utils/mediaUtils';

function VideoLibrary({ roomId, currentVideoId, onSelectVideo, onVideoDeleted }) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [busyVideoId, setBusyVideoId] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadVideos() {
      try {
        const loadedVideos = await getRoomVideos(roomId);
        if (!isCancelled) {
          setVideos(loadedVideos);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrors(error.errors ?? ['Could not load the videos.']);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadVideos();

    return () => {
      isCancelled = true;
    };
  }, [roomId]);

  function handleUploaded(video) {
    setVideos((currentVideos) => [video, ...currentVideos]);
  }

  async function handleSelect(videoId) {
    setErrors([]);
    setBusyVideoId(videoId);

    try {
      await onSelectVideo(videoId);
    } catch (error) {
      setErrors(error.errors ?? ['Could not select the video.']);
    } finally {
      setBusyVideoId(null);
    }
  }

  async function handleDelete(video) {
    const confirmed = window.confirm(`Delete "${video.fileName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setErrors([]);
    setBusyVideoId(video.id);

    try {
      await deleteVideo(video.id);
      setVideos((currentVideos) => currentVideos.filter((item) => item.id !== video.id));
      onVideoDeleted(video.id);
    } catch (error) {
      setErrors(error.errors ?? ['Could not delete the video.']);
    } finally {
      setBusyVideoId(null);
    }
  }

  return (
    <div className="card library-card">
      <h2>Video library</h2>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Only upload videos you own or have permission to share.
      </p>

      <VideoUploader roomId={roomId} onUploaded={handleUploaded} />

      <ErrorList errors={errors} />

      {isLoading && <p className="muted">Loading videos...</p>}

      {!isLoading && videos.length === 0 && (
        <div className="empty-state">
          <p>No videos yet. Upload an .mp4 to get started.</p>
        </div>
      )}

      {videos.length > 0 && (
        <ul className="video-list">
          {videos.map((video) => {
            const isCurrent = video.id === currentVideoId;
            const isBusy = busyVideoId === video.id;

            return (
              <li key={video.id} className="video-item">
                <div className="video-item-info">
                  <p className="video-item-name" title={video.fileName}>
                    {video.fileName} {isCurrent && <span className="badge">Now playing</span>}
                  </p>
                  <p className="muted small">
                    {formatDuration(video.durationSeconds)} · {formatFileSize(video.fileSizeBytes)} · uploaded by{' '}
                    {video.uploadedByDisplayName}
                  </p>
                </div>

                <div className="video-item-actions">
                  {!isCurrent && (
                    <button
                      className="button button-small"
                      type="button"
                      onClick={() => handleSelect(video.id)}
                      disabled={isBusy}
                    >
                      Play in room
                    </button>
                  )}

                  <button
                    className="button button-secondary button-small"
                    type="button"
                    onClick={() => handleDelete(video)}
                    disabled={isBusy}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default VideoLibrary;