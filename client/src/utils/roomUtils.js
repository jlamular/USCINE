// Shows a code like ABCD2345 as ABCD-2345 so it is easier to read aloud and type
export function formatRoomCode(roomCode) {
  if (roomCode.length <= 4) {
    return roomCode;
  }

  return `${roomCode.slice(0, 4)}-${roomCode.slice(4)}`;
}

export function buildInviteLink(roomCode) {
  return `${window.location.origin}/join/${roomCode}`;
}