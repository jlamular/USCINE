// A throwaway test client for Phase 8.5A-4. Not part of the app.
// Start the API with short timers first:
//   $env:GuestCleanup__GuestLifetimeMinutes = "0.25"
//   $env:GuestCleanup__SweepIntervalSeconds = "3"
// Usage (from the client folder):
//   node scripts/cleanup-check.mjs '<hostEmail>' '<hostPassword>'
// Takes about 20-30 seconds.

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const [hostEmail, hostPassword] = process.argv.slice(2);

if (!hostPassword) {
  console.error("Usage: node scripts/cleanup-check.mjs '<hostEmail>' '<hostPassword>'");
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
  const guestAToken = (await request('POST', '/api/auth/guest')).data.token;
  const guestBToken = (await request('POST', '/api/auth/guest')).data.token;

  console.log('1. Setting up');
  // Guest A HOSTS room A (public, so the registered host can join it too)
  const roomA = (await request('POST', '/api/rooms', guestAToken, { roomName: 'Cleanup A', isPublic: true })).data;
  // The registered host owns room R, and guest A is only a MEMBER of it
  const roomR = (await request('POST', '/api/rooms', hostToken, { roomName: 'Cleanup R' })).data;
  await request('POST', '/api/rooms/join', guestAToken, { roomCode: roomR.roomCode });
  await request('POST', `/api/rooms/${roomA.id}/join-public`, guestBToken);
  await request('POST', `/api/rooms/${roomA.id}/join-public`, hostToken);

  const hostConnection = createConnection(hostToken);
  const guestBConnection = createConnection(guestBToken);
  let guestBSawRoomClosed = false;
  guestBConnection.on('RoomClosed', () => {
    guestBSawRoomClosed = true;
  });

  try {
    await hostConnection.start();
    await hostConnection.invoke('JoinRoom', roomR.id);
    await hostConnection.invoke('SendMessage', roomR.id, 'cleanup check message');
    await guestBConnection.start();
    await guestBConnection.invoke('JoinRoom', roomA.id);

    const roomABefore = await request('GET', `/api/rooms/${roomA.id}`, hostToken);
    const roomRBefore = await request('GET', `/api/rooms/${roomR.id}`, hostToken);
    check('before: room A exists with 3 members', roomABefore.ok && roomABefore.data.participants.length === 3);
    check('before: room R has the host and guest A', roomRBefore.ok && roomRBefore.data.participants.length === 2);
    check('before: guest A has a working account', (await request('GET', '/api/auth/me', guestAToken)).ok);

    console.log('\n2. Waiting for the cleanup job (guests expire after 15 s, sweep every 3 s)...');
    let accountGone = false;
    const deadline = Date.now() + 60000;

    while (Date.now() < deadline) {
      // The token is still valid, so a 401 here means the ACCOUNT was deleted
      if ((await request('GET', '/api/auth/me', guestAToken)).status === 401) {
        accountGone = true;
        break;
      }

      await sleep(2000);
    }

    check('guest A account was deleted', accountGone);
    await sleep(1500);
    check('guest B account was deleted', (await request('GET', '/api/auth/me', guestBToken)).status === 401);

    console.log('\n3. What was removed');
    const roomAAfter = await request('GET', `/api/rooms/${roomA.id}`, hostToken);
    check('the room hosted by guest A is gone (404)', roomAAfter.status === 404, `status ${roomAAfter.status}`);
    check('people inside it received RoomClosed', guestBSawRoomClosed === true);

    console.log('\n4. What must survive');
    const roomRAfter = await request('GET', `/api/rooms/${roomR.id}`, hostToken);
    check('the registered host\'s room still exists', roomRAfter.ok, `status ${roomRAfter.status}`);
    check(
      'guest A left it (only the host remains)',
      roomRAfter.ok && roomRAfter.data.participants.length === 1 && roomRAfter.data.participants[0].isHost === true,
    );

    const messages = await request('GET', `/api/rooms/${roomR.id}/messages`, hostToken);
    check(
      'the registered host\'s chat message is untouched',
      messages.ok && messages.data.some((message) => message.text === 'cleanup check message'),
    );

    const secondLogin = await request('POST', '/api/auth/login', null, { email: hostEmail, password: hostPassword });
    check('the registered account can still log in', secondLogin.ok);
  } finally {
    for (const connection of [hostConnection, guestBConnection]) {
      try {
        await connection.stop();
      } catch {
        // already stopped
      }
    }

    await request('DELETE', `/api/rooms/${roomR.id}`, hostToken);
    console.log('\nTest room deleted.');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});