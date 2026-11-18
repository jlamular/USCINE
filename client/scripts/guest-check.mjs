// A throwaway test client for Phase 8.5A-1. Not part of the app.
// Usage (from the client folder):
//   node scripts/guest-check.mjs <hostEmail> <hostPassword>
// The registered account must already exist.

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const [hostEmail, hostPassword] = process.argv.slice(2);

if (!hostPassword) {
  console.error('Usage: node scripts/guest-check.mjs <hostEmail> <hostPassword>');
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

function readTokenPayload(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
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

function createClient(name, token) {
  const connection = new HubConnectionBuilder()
    .withUrl(`${API}/hubs/room`, { accessTokenFactory: () => token })
    .configureLogging(LogLevel.Warning)
    .build();

  const client = { name, connection, received: [] };

  connection.on('ReceiveMessage', (message) => {
    client.received.push(message);
    console.log(`   [${name}] ReceiveMessage #${message.id}  ${message.displayName}: ${message.text}`);
  });

  return client;
}

async function main() {
  console.log('1. Guest login');
  const guestLogin = await request('POST', '/api/auth/guest');
  check('POST /api/auth/guest succeeds', guestLogin.ok, `status ${guestLogin.status}`);

  const guestToken = guestLogin.data.token;
  const guestUser = guestLogin.data.user;
  const claims = readTokenPayload(guestToken);

  check('the user is flagged as a guest', guestUser.isGuest === true);
  check('the name looks like Guest-1234', /^Guest-\d{4}$/.test(guestUser.displayName), guestUser.displayName);
  check('the token contains is_guest = "true"', claims.is_guest === 'true');
  check(
    'the guest token lasts about 24 hours',
    Math.abs(claims.exp - claims.iat - 24 * 3600) < 5,
    `${((claims.exp - claims.iat) / 3600).toFixed(2)} h`,
  );

  const me = await request('GET', '/api/auth/me', guestToken);
  check('/api/auth/me works for the guest', me.ok && me.data.isGuest === true);

  const passwordLogin = await request('POST', '/api/auth/login', null, {
    email: guestUser.email,
    password: 'Anything123',
  });
  check('a guest cannot log in with an email and password (401)', passwordLogin.status === 401);

  console.log('\n2. A registered user still gets a normal token');
    const hostLogin = await request('POST', '/api/auth/login', null, { email: hostEmail, password: hostPassword });
  check('the registered login works', hostLogin.ok, `status ${hostLogin.status}`);

  if (!hostLogin.ok) {
    console.error(`\nStopping: the registered login failed: ${hostLogin.data?.errors?.[0] ?? 'no message'}`);
    process.exit(1);
  }

  const hostToken = hostLogin.data.token;
  const hostClaims = readTokenPayload(hostToken);
  check('no is_guest claim in the registered token', hostClaims.is_guest === undefined);
  check('the registered user is not flagged as guest', hostLogin.data.user.isGuest === false);

  console.log('\n3. Setting up a room');
  const created = await request('POST', '/api/rooms', hostToken, { roomName: 'Guest chat test' });
  const room = created.data;

  const host = createClient('host', hostToken);
  const guest = createClient('guest', guestToken);

  try {
    const joined = await request('POST', '/api/rooms/join', guestToken, { roomCode: room.roomCode });
    check('the guest can join by room code', joined.ok, `status ${joined.status}`);

    await host.connection.start();
    await guest.connection.start();
    await host.connection.invoke('JoinRoom', room.id);
    await guest.connection.invoke('JoinRoom', room.id);
    await sleep(300);

    console.log('\n4. Registered user: chat works as in Phase 8');
    const hostMessage = await host.connection.invoke('SendMessage', room.id, 'Hello from the host');
    await sleep(400);
    check('the host message was saved', Number.isInteger(hostMessage.id));

    console.log('\n5. Guest: reading works');
    check(
      'the guest received the host message live',
      guest.received.length === 1 && guest.received[0].id === hostMessage.id,
    );

    const history = await request('GET', `/api/rooms/${room.id}/messages`, guestToken);
    check(
      'the guest can read the history',
      history.ok && history.data.length === 1 && history.data[0].id === hostMessage.id,
    );

    console.log('\n6. Guest: sending is refused (raw SignalR client, no UI involved)');
    let errorMessage = '';
    try {
      await guest.connection.invoke('SendMessage', room.id, 'I am a guest');
    } catch (error) {
      errorMessage = error.message;
    }

    check(
      'the guest send fails with the clear message',
      errorMessage.includes('Guests cannot chat. Register to send messages.'),
      errorMessage || 'no error was thrown',
    );

    await sleep(300);
    const historyAfter = await request('GET', `/api/rooms/${room.id}/messages`, hostToken);
    check('the refused message was NOT stored', historyAfter.ok && historyAfter.data.length === 1);
    check('nobody received it live', host.received.length === 1 && guest.received.length === 1);

    console.log('\n7. The host can still chat after the guest was refused');
    const second = await host.connection.invoke('SendMessage', room.id, 'Still working');
    check('the host can send again', second.text === 'Still working');
  } finally {
    await host.connection.stop();
    await guest.connection.stop();
    await request('DELETE', `/api/rooms/${room.id}`, hostToken);
    console.log('\nTest room deleted. (The guest account stays until the cleanup job from 8.5A-4 exists.)');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});