import { parseUtcDate } from './dateUtils';

const GROUP_GAP_MS = 5 * 60 * 1000;

// Combines message lists. A message that appears twice (live AND in a history fetch) is kept once,
// and the result is always ordered oldest to newest.
export function mergeMessages(current, incoming) {
  const byId = new Map();

  current.forEach((message) => byId.set(message.id, message));
  incoming.forEach((message) => byId.set(message.id, message));

  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

// Consecutive messages from the same person within 5 minutes share one name and time
export function shouldShowHeader(previousMessage, message) {
  if (!previousMessage || previousMessage.userId !== message.userId) {
    return true;
  }

  const gapMs = parseUtcDate(message.sentAt).getTime() - parseUtcDate(previousMessage.sentAt).getTime();
  return gapMs > GROUP_GAP_MS;
}

// SignalR wraps our server message like this:
// "An unexpected error occurred invoking 'SendMessage' on the server. HubException: You are sending messages too fast."
// We only want the last part.
export function extractHubErrorMessage(error) {
  const text = error?.message ?? '';
  const marker = 'HubException: ';
  const index = text.indexOf(marker);

  if (index >= 0) {
    return text.slice(index + marker.length);
  }

  if (text === 'Not connected.') {
    return 'You are offline. Please wait for the connection to come back.';
  }

  return 'The message could not be sent. Please try again.';
}