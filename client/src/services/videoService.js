import { ApiError, apiDelete, apiGet, apiPost, extractErrors } from './api';
import { getToken } from './tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function getRoomVideos(roomId) {
  return apiGet(`/api/rooms/${roomId}/videos`);
}

export function deleteVideo(videoId) {
  return apiDelete(`/api/videos/${videoId}`);
}

export function createStreamToken(videoId) {
  return apiPost(`/api/videos/${videoId}/stream-token`);
}

// The <video> tag cannot send an Authorization header, so the token travels in the URL
export function buildStreamUrl(videoId, token) {
  return `${API_BASE_URL}/api/videos/${videoId}/stream?token=${encodeURIComponent(token)}`;
}

function parseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// fetch() cannot report upload progress, XMLHttpRequest can.
// Returns { promise, cancel }: the promise resolves with the saved video.
export function uploadVideo(roomId, file, onProgress) {
  const request = new XMLHttpRequest();

  const promise = new Promise((resolve, reject) => {
    request.open('POST', `${API_BASE_URL}/api/rooms/${roomId}/videos`);

    const token = getToken();
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      const data = parseJson(request.responseText);

      if (request.status >= 200 && request.status < 300) {
        resolve(data);
        return;
      }

      if (request.status === 413) {
        reject(new ApiError(413, ['The file is larger than the server accepts.']));
        return;
      }

      reject(new ApiError(request.status, extractErrors(request.status, data)));
    };

    request.onerror = () => {
      reject(new ApiError(0, ['Could not reach the server. Check your connection and try again.']));
    };

    request.onabort = () => {
      reject(new ApiError(0, ['Upload cancelled.']));
    };

    // Do NOT set Content-Type here: the browser must add it itself, including the multipart boundary
    const formData = new FormData();
    formData.append('file', file);
    request.send(formData);
  });

  return {
    promise,
    cancel: () => request.abort(),
  };
}