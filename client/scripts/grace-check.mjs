// A throwaway test client for Phase 8.5A-3. Not part of the app.
// Start the API with short timers first:
//   $env:PublicRooms__HostGraceSeconds = "6"
//   $env:PublicRooms__SweepIntervalSeconds = "2"
// Usage (from the client folder):
//   node scripts/grace-check.mjs '<hostEmail>' '<hostPassword>'
// It takes about 35 seconds because it waits out the grace period twice.

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const GRACE_SECONDS = Number(process.env.GRACE_SECONDS ?? 6);
const SWEEP_SECONDS = Number(process.env.SWEEP_SECONDS ?? 2);
const [hostEmail, hostPassword] = process.argv.slice(2);

if (!hostPassword) {
  console.error("Usage: node scripts/grace-check.mjs '<hostEmail>' '<hostPassword>'");
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
  const guestToken = (await request('POST', '/api/auth/guest')).data.token;

  console.log(`Timers: grace ${GRACE_SECONDS} s, sweep every ${SWEEP_SECONDS} s (must match the API's settings)\n`);

  const publicRoom = (await request('POST', '/api/rooms', hostToken, { roomName: 'Grace public', isPublic: true })).data;
  const privateRoom = (await request('POST', '/api/rooms', hostToken, { roomName: 'Grace private' })).data;
  await request('POST', `/api/rooms/${publicRoom.id}/join-public`, guestToken);

  const host = createConnection(hostToken);
  const guest = createConnection(guestToken);
  let guestSawRoomClosed = false;
  guest.on('RoomClosed', () => {
    guestSawRoomClosed = true;
  });

  const roomExists = async (id) => (await request('GET', `/api/rooms/${id}`, hostToken)).status === 200;

  try {
    await host.start();
    await guest.start();
    await host.invoke('JoinRoom', publicRoom.id);
    await host.invoke('JoinRoom', privateRoom.id);
    await guest.invoke('JoinRoom', publicRoom.id);
    await sleep(500);

    console.log('1. The host comes back inside the grace period');
    await host.stop();
    await sleep(2000);
    await host.start();
    await host.invoke('JoinRoom', publicRoom.id);

    const longWait = GRACE_SECONDS + SWEEP_SECONDS * 2 + 1;
    console.log(`   waiting ${longWait} seconds (longer than the grace period)...`);
    await sleep(longWait * 1000);

    check('the public room is still open', await roomExists(publicRoom.id));
    check('the guest was NOT thrown out', guestSawRoomClosed === false);

    console.log('\n2. The host leaves and does not come back');
    await host.stop();
    await sleep(2000);
    check('2 seconds later the room is still open (inside the grace period)', await roomExists(publicRoom.id));

    console.log(`   waiting for the grace period to run out...`);
    await sleep((GRACE_SECONDS + SWEEP_SECONDS * 2) * 1000);

    check('the public room has been closed', !(await roomExists(publicRoom.id)));
    check('the guest received RoomClosed', guestSawRoomClosed === true);

    const list = await request('GET', '/api/rooms/public', guestToken);
    check('it is gone from the public list', list.ok && !list.data.some((room) => room.id === publicRoom.id));

    console.log('\n3. A PRIVATE room is never closed this way');
    check('the private room is still open', await roomExists(privateRoom.id));
  } finally {
    for (const connection of [host, guest]) {
      try {
        await connection.stop();
      } catch {
        // already stopped
      }
    }

    await request('DELETE', `/api/rooms/${publicRoom.id}`, hostToken);
    await request('DELETE', `/api/rooms/${privateRoom.id}`, hostToken);
    console.log('\nTest rooms deleted (the public one was already closed by the server).');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});