import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { getToken } from './tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// These names must match the server (WatchRoomHub and RoomNotifier) exactly, including the capital letters.
// SignalR never complains about an event name nobody sends, so a typo would fail silently.
export const HubEvents = {
  RoomStateUpdated: 'RoomStateUpdated',
  RoomClosed: 'RoomClosed',
};

export const HubMethods = {
  JoinRoom: 'JoinRoom',
  LeaveRoom: 'LeaveRoom',
};

export function createRoomConnection() {
  return new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}/hubs/room`, {
      // Read on every (re)connection, so a fresh login is picked up automatically
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect({
      // 1s, 2s, 4s, 8s, 16s, then every 30s. Returning a number (never null) means we never give up.
      nextRetryDelayInMilliseconds: (retryContext) =>
        Math.min(1000 * 2 ** retryContext.previousRetryCount, 30000),
    })
    .configureLogging(LogLevel.Warning)
    .build();
}