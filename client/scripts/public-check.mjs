// A throwaway test client for Phase 8.5A-2. Not part of the app.
// Usage (from the client folder):
//   node scripts/public-check.mjs '<hostEmail>' '<hostPassword>'

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const [hostEmail, hostPassword] = process.argv.slice(2);

if (!hostPassword) {
  console.error("Usage: node scripts/public-check.mjs '<hostEmail>' '<hostPassword>'");
  process.exit(1);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let failures = 0;

function check(name, passed, details = '') {
  if (!passed) {
    failures += 1;
  }

  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${details ? `  (${details})` : ''}`);
}

// Does not throw on 4xx, because we WANT to check those statuses
async function request(method, path, token, body) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await response.text();

  return { ok: response.ok, status: response.status, data: text ? JSON.parse(text) : null };
}

function createConnection(token) {
  return new HubConnectionBuilder()
    .withUrl(`${API}/hubs/room`, { accessTokenFactory: () => token })
    .configureLogging(LogLevel.Error)
    .build();
}

async function main() {
  const hostLogin = await request('POST', '/api/auth/login', null, { email: hostEmail, password: hostPassword });
  if (!hostLogin.ok) {
    console.error(`Stopping: the registered login failed: ${hostLogin.data?.errors?.[0] ?? 'no message'}`);
    process.exit(1);
  }

  const hostToken = hostLogin.data.token;
  const guestLogin = await request('POST', '/api/auth/guest');
  const guestToken = guestLogin.data.token;

  console.log('1. Creating rooms');
  const publicRoom = (await request('POST', '/api/rooms', hostToken, { roomName: 'Public test', isPublic: true })).data;
  const privateRoom = (await request('POST', '/api/rooms', hostToken, { roomName: 'Private test' })).data;

  check('a room created with isPublic = true is public', publicRoom.isPublic === true);
  check('a room created WITHOUT the flag is private (old clients still work)', privateRoom.isPublic === false);

  const hostConnection = createConnection(hostToken);

  try {
    console.log('\n2. Host is offline');
    let list = await request('GET', '/api/rooms/public', guestToken);
    check('the guest can call the public list', list.ok, `status ${list.status}`);
    check(
      'the public room is NOT listed while the host is offline',
      !list.data.some((room) => room.id === publicRoom.id),
    );

    console.log('\n3. Host opens the public room');
    await hostConnection.start();
    await hostConnection.invoke('JoinRoom', publicRoom.id);
    await sleep(300);

    list = await request('GET', '/api/rooms/public', guestToken);
    const listed = list.data.find((room) => room.id === publicRoom.id);

    check('the public room is listed while the host is online', listed !== undefined);
    check('the private room is never listed', !list.data.some((room) => room.id === privateRoom.id));
    check('the list does not expose a room code', listed !== undefined && listed.roomCode === undefined);
    check('the guest is not yet a member', listed !== undefined && listed.isMember === false);
    check('online count is 1', listed !== undefined && listed.onlineCount === 1);

    console.log('\n4. Guest joins without a code');
    const joined = await request('POST', `/api/rooms/${publicRoom.id}/join-public`, guestToken);
    check('join-public succeeds', joined.ok, `status ${joined.status}`);
    check(
      'the guest joined as a participant, not as host',
      joined.ok && joined.data.isHost === false && joined.data.participants.length === 2,
    );

    const joinedAgain = await request('POST', `/api/rooms/${publicRoom.id}/join-public`, guestToken);
    check('joining twice is harmless', joinedAgain.ok && joinedAgain.data.participants.length === 2);

    list = await request('GET', '/api/rooms/public', guestToken);
    const listedAfter = list.data.find((room) => room.id === publicRoom.id);
    check(
      'the list now shows isMember = true and 2 participants',
      listedAfter !== undefined && listedAfter.isMember === true && listedAfter.participantCount === 2,
    );

    console.log('\n5. Private rooms cannot be joined this way');
    const joinPrivate = await request('POST', `/api/rooms/${privateRoom.id}/join-public`, guestToken);
    check('join-public on a PRIVATE room is 404', joinPrivate.status === 404, `status ${joinPrivate.status}`);

    const joinMissing = await request('POST', '/api/rooms/00000000-0000-0000-0000-000000000001/join-public', guestToken);
    check('join-public on a missing room is 404 too (same answer)', joinMissing.status === 404);

    console.log('\n6. Host goes offline');
    await hostConnection.stop();
    await sleep(1000);

    list = await request('GET', '/api/rooms/public', guestToken);
    check(
      'the room disappears from the list again',
      !list.data.some((room) => room.id === publicRoom.id),
    );
  } finally {
    try {
      await hostConnection.stop();
    } catch {
      // already stopped
    }

    await request('DELETE', `/api/rooms/${publicRoom.id}`, hostToken);
    await request('DELETE', `/api/rooms/${privateRoom.id}`, hostToken);
    console.log('\nTest rooms deleted.');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});