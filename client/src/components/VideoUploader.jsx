import { useEffect, useRef, useState } from 'react';
import ErrorList from './ErrorList';
import { uploadVideo } from '../services/videoService';
import { formatFileSize } from '../utils/mediaUtils';

// Must not be larger than Storage:MaxVideoSizeMb on the server (1024 MB by default).
// The server is the real gatekeeper. This check just saves you a long upload that would be refused.
const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

function validateFile(file) {
  if (!file.name.toLowerCase().endsWith('.mp4')) {
    return 'Only .mp4 videos are supported.';
  }

  if (file.size === 0) {
    return 'The file is empty.';
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return `The file is too large (${formatFileSize(file.size)}). The maximum is ${formatFileSize(MAX_UPLOAD_BYTES)}.`;
  }

  return null;
}

function VideoUploader({ roomId, onUploaded }) {
  const fileInputRef = useRef(null);
  const activeUploadRef = useRef(null);
  const wasCancelledRef = useRef(false);

  const [errors, setErrors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  // If the user leaves the page in the middle of an upload, stop it
  useEffect(() => {
    return () => {
      wasCancelledRef.current = true;
      activeUploadRef.current?.cancel();
    };
  }, []);

  async function handleFileSelected(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setErrors([]);

    const validationError = validateFile(file);
    if (validationError) {
      setErrors([validationError]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    wasCancelledRef.current = false;
    setFileName(file.name);
    setProgress(0);
    setIsUploading(true);

    const upload = uploadVideo(roomId, file, setProgress);
    activeUploadRef.current = upload;

    try {
      const video = await upload.promise;
      onUploaded(video);
    } catch (error) {
      if (!wasCancelledRef.current) {
        setErrors(error.errors ?? ['Upload failed. Please try again.']);
      }
    } finally {
      activeUploadRef.current = null;
      setIsUploading(false);
    }
  }

  function handleCancel() {
    wasCancelledRef.current = true;
    activeUploadRef.current?.cancel();
  }

  return (
    <div className="uploader">
      <ErrorList errors={errors} />

      {isUploading ? (
        <div className="upload-progress">
          <p className="small">
            {fileName} {progress < 100 ? `${progress}%` : '(processing on the server...)'}
          </p>

          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          <button className="button button-secondary button-small" type="button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      ) : (
        <label className="button button-secondary upload-button">
          Upload video (.mp4)
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,video/mp4"
            onChange={handleFileSelected}
            hidden
          />
        </label>
      )}
    </div>
  );
}

export default VideoUploader;