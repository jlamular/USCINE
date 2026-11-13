import { apiGet, apiPost, apiPut } from './api';
import { clearToken, getToken, saveToken } from './tokenStorage';

export async function register(email, password, displayName) {
  const result = await apiPost('/api/auth/register', { email, password, displayName });
  saveToken(result.token);
  return result.user;
}

export async function login(email, password) {
  const result = await apiPost('/api/auth/login', { email, password });
  saveToken(result.token);
  return result.user;
}

export function logout() {
  clearToken();
}

export function hasStoredToken() {
  return getToken() !== null;
}

export function getCurrentUser() {
  return apiGet('/api/auth/me');
}

export function updateDisplayName(displayName) {
  return apiPut('/api/auth/me', { displayName });
}