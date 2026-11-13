import { apiDelete, apiGet, apiPost } from './api';

export function getMyRooms() {
  return apiGet('/api/rooms');
}

export function createRoom(roomName) {
  return apiPost('/api/rooms', { roomName });
}

export function joinRoom(roomCode) {
  return apiPost('/api/rooms/join', { roomCode });
}

export function getRoom(roomId) {
  return apiGet(`/api/rooms/${roomId}`);
}

export function leaveRoom(roomId) {
  return apiPost(`/api/rooms/${roomId}/leave`);
}

export function deleteRoom(roomId) {
  return apiDelete(`/api/rooms/${roomId}`);
}