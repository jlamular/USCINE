import { getToken } from './tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

let unauthorizedHandler = null;

// The AuthProvider registers a function here. It runs when the server rejects a request from a
// logged-in user with HTTP 401, which means the token expired or is no longer valid.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function reportUnauthorized() {
  unauthorizedHandler?.();
}

export class ApiError extends Error {
  constructor(status, errors) {
    super(errors[0] ?? 'Request failed.');
    this.status = status;
    this.errors = errors;
  }
}

async function readJsonBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractErrors(status, data) {
  if (data && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors;
  }

  if (status === 401) {
    return ['Your session has expired. Please log in again.'];
  }

  return [`Something went wrong (status ${status}). Please try again.`];
}

function isLoginOrRegister(path) {
  return path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
}

async function request(method, path, body) {
  const headers = {};

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, ['Could not reach the server. Check your connection and try again.']);
  }

  const data = await readJsonBody(response);

  if (!response.ok) {
    // A wrong password also answers 401, but then there was no token to reject.
    // Only a rejected token means "your session is over".
    if (response.status === 401 && token && !isLoginOrRegister(path)) {
      reportUnauthorized();
    }

    throw new ApiError(response.status, extractErrors(response.status, data));
  }

  return data;
}

export function apiGet(path) {
  return request('GET', path);
}

export function apiPost(path, body) {
  return request('POST', path, body);
}

export function apiPut(path, body) {
  return request('PUT', path, body);
}

export function apiDelete(path) {
  return request('DELETE', path);
}