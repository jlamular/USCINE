import { apiGet } from './api';

// before: messages older than this id.  after: messages newer than this id.  limit: page size.
export function getMessages(roomId, { before, after, limit } = {}) {
  const parameters = new URLSearchParams();

  if (before !== undefined) {
    parameters.set('before', String(before));
  }

  if (after !== undefined) {
    parameters.set('after', String(after));
  }

  if (limit !== undefined) {
    parameters.set('limit', String(limit));
  }

  const query = parameters.toString();
  return apiGet(`/api/rooms/${roomId}/messages${query ? `?${query}` : ''}`);
}