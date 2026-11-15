// A throwaway test client for Phase 8A. Not part of the app.
// Usage (from the client folder):
//   node scripts/chat-check.mjs <hostEmail> <hostPassword> <memberEmail> <memberPassword>
// The two accounts must already exist. It takes about 20 seconds because it waits out the rate limit.

import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const [hostEmail, hostPassword, memberEmail, memberPassword] = process.argv.slice(2);

if (!memberPassword) {
  console.error('Usage: node scripts/chat-check.mjs <hostEmail> <hostPassword> <memberEmail> <memberPassword>');
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

async function isRejected(action) {
  try {
    await action();
    return false;
  } catch {
    return true;
  }
}

async function login(email, password) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${email} (status ${response.status})`);
  }

  return (await response.json()).token;
}

// Unlike a normal helper this does not throw on 4xx, because we WANT to check those statuses
async function request(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
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
  console.log('Logging in and creating a room...');
  const hostToken = await login(hostEmail, hostPassword);
  const memberToken = await login(memberEmail, memberPassword);

  const created = await request('POST', '/api/rooms', hostToken, { roomName: 'Chat script test' });
  const room = created.data;

  const host = createClient('host', hostToken);
  const member = createClient('member', memberToken);

  try {
    await host.connection.start();
    await member.connection.start();
    await host.connection.invoke('JoinRoom', room.id);

    console.log('\n1. Someone who is NOT in the room');
    const outsiderHistory = await request('GET', `/api/rooms/${room.id}/messages`, memberToken);
    check('cannot read the history (404)', outsiderHistory.status === 404, `status ${outsiderHistory.status}`);
    check(
      'cannot join the live group',
      await isRejected(() => member.connection.invoke('JoinRoom', room.id)),
    );
    check(
      'cannot send a message',
      await isRejected(() => member.connection.invoke('SendMessage', room.id, 'let me in')),
    );

    await request('POST', '/api/rooms/join', memberToken, { roomCode: room.roomCode });
    await member.connection.invoke('JoinRoom', room.id);
    await sleep(300);
    host.received.length = 0;
    member.received.length = 0;

    console.log('\n2. Sending and receiving');
    const first = await host.connection.invoke('SendMessage', room.id, '   Hello everyone   ');
    await sleep(400);
    check('the text was trimmed', first.text === 'Hello everyone', `"${first.text}"`);
    check('the sender is named by the server', typeof first.displayName === 'string' && first.displayName.length > 0);
    check('the message has a number id', Number.isInteger(first.id));
    check(
      'the time comes from the server and is recent',
      Math.abs(Date.now() - new Date(first.sentAt).getTime()) < 10000,
      first.sentAt,
    );
    check(
      'both the host and the member received it live',
      host.received.length === 1 && member.received.length === 1 && member.received[0].id === first.id,
    );

    console.log('\n3. Validation');
    check('a blank message is rejected', await isRejected(() => host.connection.invoke('SendMessage', room.id, '    ')));
    check(
      'a 1001 character message is rejected',
      await isRejected(() => host.connection.invoke('SendMessage', room.id, 'x'.repeat(1001))),
    );

    const cleaned = await host.connection.invoke('SendMessage', room.id, 'line1\nline2\tend\u0007');
    check('control characters are removed', cleaned.text === 'line1line2end', `"${cleaned.text}"`);

    const html = await host.connection.invoke('SendMessage', room.id, '<script>alert(1)</script>');
    check('HTML is stored as plain text, unchanged', html.text === '<script>alert(1)</script>');

    console.log('\n4. History');
    const reply1 = await member.connection.invoke('SendMessage', room.id, 'reply one');
    const reply2 = await member.connection.invoke('SendMessage', room.id, 'reply two');
    await sleep(300);

    const latest = await request('GET', `/api/rooms/${room.id}/messages?limit=3`, hostToken);
    check(
      'latest 3, oldest first, ending with the newest',
      latest.ok &&
        latest.data.length === 3 &&
        latest.data[0].id < latest.data[1].id &&
        latest.data[2].id === reply2.id,
    );

    const older = await request('GET', `/api/rooms/${room.id}/messages?before=${latest.data[0].id}&limit=3`, hostToken);
    check('older page: the 2 messages before those', older.ok && older.data.length === 2 && older.data[0].id === first.id);

    const newer = await request('GET', `/api/rooms/${room.id}/messages?after=${cleaned.id}`, hostToken);
    check(
      'newer page: everything after message 2',
      newer.ok && newer.data.length === 3 && newer.data[0].id === html.id && newer.data[2].id === reply2.id,
    );

    const both = await request('GET', `/api/rooms/${room.id}/messages?before=5&after=1`, hostToken);
    check('before and after together are rejected (400)', both.status === 400);

    console.log('\n5. The rate limit (5 messages per 10 seconds per user)');
    // The host has sent 3 accepted messages so far (rejected ones did not count)
    await host.connection.invoke('SendMessage', room.id, 'fourth');
    await host.connection.invoke('SendMessage', room.id, 'fifth');
    check(
      'the sixth message in a row is rejected',
      await isRejected(() => host.connection.invoke('SendMessage', room.id, 'sixth')),
    );

    console.log('   waiting 11 seconds for the window to pass...');
    await sleep(11000);
    const afterWait = await host.connection.invoke('SendMessage', room.id, 'back again');
    check('after the wait, sending works again', afterWait.text === 'back again');

    console.log('\n6. Leaving the room');
    await request('POST', `/api/rooms/${room.id}/leave`, memberToken);
    const leftHistory = await request('GET', `/api/rooms/${room.id}/messages`, memberToken);
    check('a member who left can no longer read the history', leftHistory.status === 404);
    check(
      'and can no longer send',
      await isRejected(() => member.connection.invoke('SendMessage', room.id, 'still here?')),
    );
  } finally {
    await host.connection.stop();
    await member.connection.stop();
    await request('DELETE', `/api/rooms/${room.id}`, hostToken);
    console.log('\nTest room deleted (its messages went with it).');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});