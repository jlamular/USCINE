// A throwaway test client for Phase 7A. Not part of the app.
// Usage (from the client folder):
//   node scripts/hub-check.mjs <hostEmail> <hostPassword> <memberEmail> <memberPassword> <path-to-mp4>
// The two accounts must already exist. The video must be at least 60 seconds long.

import { openAsBlob } from 'node:fs';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API = process.env.API_URL ?? 'http://localhost:5000';
const [hostEmail, hostPassword, memberEmail, memberPassword, mp4Path] = process.argv.slice(2);

if (!mp4Path) {
  console.error('Usage: node scripts/hub-check.mjs <hostEmail> <hostPassword> <memberEmail> <memberPassword> <path-to-mp4>');
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

async function api(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const response = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${method} ${path} failed with status ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function createClient(name, token) {
  const connection = new HubConnectionBuilder()
    .withUrl(`${API}/hubs/room`, { accessTokenFactory: () => token })
    .configureLogging(LogLevel.Warning)
    .build();

  const client = { name, connection, playbackEvents: [] };

  connection.on('PlaybackUpdated', (state) => {
    client.playbackEvents.push(state);
    console.log(
      `   [${name}] PlaybackUpdated  v${state.version}  playing=${state.isPlaying}  position=${state.positionSeconds.toFixed(2)}`,
    );
  });

  return client;
}

async function main() {
  console.log('Logging in...');
  const hostToken = await login(hostEmail, hostPassword);
  const memberToken = await login(memberEmail, memberPassword);

  console.log('Creating a room and uploading the video...');
  const room = await api('POST', '/api/rooms', hostToken, { roomName: 'Sync script test' });
  await api('POST', '/api/rooms/join', memberToken, { roomCode: room.roomCode });

  const form = new FormData();
  form.append('file', await openAsBlob(mp4Path), 'script-test.mp4');
  const video = await api('POST', `/api/rooms/${room.id}/videos`, hostToken, form);

  if (video.durationSeconds < 60) {
    await api('DELETE', `/api/rooms/${room.id}`, hostToken);
    throw new Error(`The video is only ${video.durationSeconds.toFixed(1)} s long. Use one of at least 60 s.`);
  }

  await api('PUT', `/api/rooms/${room.id}/current-video`, hostToken, { videoId: video.id });
  console.log(`Room ${room.roomCode}, video "${video.fileName}" (${video.durationSeconds.toFixed(1)} s)\n`);

  const host = createClient('host', hostToken);
  const member = createClient('member', memberToken);
  const connections = [host, member];

  try {
    await host.connection.start();
    await member.connection.start();

    console.log('1. Joining');
    await host.connection.invoke('JoinRoom', room.id);
    await sleep(500);
    await member.connection.invoke('JoinRoom', room.id);
    await sleep(500);

    check('each joiner received the current state', host.playbackEvents.length >= 1 && member.playbackEvents.length >= 1);
    check(
      'initial state is paused at the start',
      host.playbackEvents[0].isPlaying === false && host.playbackEvents[0].positionSeconds === 0,
    );
    check('a new joiner did NOT trigger a playback message for the others', host.playbackEvents.length === 1);

    const initialVersion = host.playbackEvents[0].version;

    console.log('\n2. Host presses play at 5 s');
    host.playbackEvents.length = 0;
    member.playbackEvents.length = 0;
    const playState = await host.connection.invoke('PlayVideo', room.id, 5);
    await sleep(500);

    check(
      'host got the new state back from the command',
      playState.isPlaying === true && Math.abs(playState.positionSeconds - 5) < 0.01 && playState.version > initialVersion,
    );
    check('member received the broadcast', member.playbackEvents.length === 1 && member.playbackEvents[0].isPlaying);
    check('the host also received the broadcast (the browser will ignore it by version)', host.playbackEvents.length === 1);

    console.log('\n3. The formula: three seconds later, where should the video be?');
    await sleep(3000);
    const serverNow = await member.connection.invoke('GetServerTime');
    const last = member.playbackEvents[member.playbackEvents.length - 1];
    const expected = last.positionSeconds + (serverNow - last.updatedAtUnixMs) / 1000;
    check('expected position is about 8.5 s', Math.abs(expected - 8.5) < 1.0, `calculated ${expected.toFixed(2)} s`);

    console.log('\n4. A member tries to control playback');
    for (const commandName of ['PlayVideo', 'PauseVideo', 'SeekVideo']) {
      let wasRejected = false;
      try {
        await member.connection.invoke(commandName, room.id, 1);
      } catch {
        wasRejected = true;
      }
      check(`member's ${commandName} is rejected`, wasRejected);
    }

    console.log('\n5. Host seeks to 20 s, then pauses at 21.5 s');
    member.playbackEvents.length = 0;
    await host.connection.invoke('SeekVideo', room.id, 20);
    const pauseState = await host.connection.invoke('PauseVideo', room.id, 21.5);
    await sleep(500);

    check(
      'member received both, in order, with rising versions',
      member.playbackEvents.length === 2 &&
        member.playbackEvents[1].version > member.playbackEvents[0].version &&
        member.playbackEvents[1].isPlaying === false,
    );

    console.log('\n6. Host pauses again at the same spot (nothing changes)');
    member.playbackEvents.length = 0;
    const repeatState = await host.connection.invoke('PauseVideo', room.id, 21.5);
    await sleep(500);
    check(
      'same version, and nobody was bothered',
      repeatState.version === pauseState.version && member.playbackEvents.length === 0,
    );

    console.log('\n7. A late joiner arrives');
    const late = createClient('late-joiner', memberToken);
    connections.push(late);
    await late.connection.start();
    await late.connection.invoke('JoinRoom', room.id);
    await sleep(500);
    check(
      'late joiner got the current state (paused at 21.5 s)',
      late.playbackEvents.length === 1 &&
        late.playbackEvents[0].version === pauseState.version &&
        Math.abs(late.playbackEvents[0].positionSeconds - 21.5) < 0.01,
    );
    await late.connection.stop();

    console.log('\n8. Host plays at 30 s, then everybody leaves');
    await host.connection.invoke('PlayVideo', room.id, 30);
    await sleep(2000);
    await host.connection.stop();
    await member.connection.stop();
    await sleep(1500);

    const checker = createClient('checker', hostToken);
    connections.push(checker);
    await checker.connection.start();
    await checker.connection.invoke('JoinRoom', room.id);
    await sleep(500);
    const emptied = checker.playbackEvents[0];
    check(
      'the empty room was paused around 32 s',
      emptied !== undefined && emptied.isPlaying === false && emptied.positionSeconds > 31 && emptied.positionSeconds < 35,
      emptied ? `paused at ${emptied.positionSeconds.toFixed(2)} s` : 'no state received',
    );
  } finally {
    for (const client of connections) {
      try {
        await client.connection.stop();
      } catch {
        // already stopped
      }
    }

    await api('DELETE', `/api/rooms/${room.id}`, hostToken);
    console.log('\nTest room deleted.');
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nThe script stopped with an error:', error.message);
  process.exit(1);
});