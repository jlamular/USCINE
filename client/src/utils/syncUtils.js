// All the timing numbers of the synchronization in one place
export const SYNC = {
  toleranceSeconds: 0.3,        // closer than this: nobody can tell
  pausedToleranceSeconds: 0.1,  // paused videos can be matched more precisely
  hardSeekSeconds: 2,           // further off than this: jump instead of nudging
  rateAdjustment: 0.05,         // nudge the speed by 5%
  hostReanchorSeconds: 1.5,     // the host re-anchors the server if its own video drifted this far
  driftCheckIntervalMs: 1000,
  minHardSeekGapMs: 3000,       // never jump twice within this time, so a slow seek cannot fight itself
  minReanchorGapMs: 5000,
  clockSamples: 5,
  clockResyncIntervalMs: 60000,
};

// Where the video should be right now, given the anchor the host last set.
// serverNowMs is the SERVER's clock (estimated), not the computer's.
export function getExpectedPosition(playback, serverNowMs, durationSeconds) {
  let position = playback.positionSeconds;

  if (playback.isPlaying) {
    const elapsedSeconds = (serverNowMs - playback.updatedAtUnixMs) / 1000;

    if (elapsedSeconds > 0) {
      position += elapsedSeconds;
    }
  }

  if (Number.isFinite(durationSeconds)) {
    position = Math.min(position, durationSeconds);
  }

  return Math.max(0, position);
}

// driftSeconds: positive = the viewer is AHEAD of where it should be, negative = BEHIND
export function decideCorrection(isPlaying, driftSeconds) {
  const size = Math.abs(driftSeconds);

  if (!isPlaying) {
    return { type: size > SYNC.pausedToleranceSeconds ? 'seek' : 'none', rate: 1 };
  }

  if (size > SYNC.hardSeekSeconds) {
    return { type: 'seek', rate: 1 };
  }

  if (size > SYNC.toleranceSeconds) {
    // Ahead: slow down a little. Behind: speed up a little.
    const rate = driftSeconds > 0 ? 1 - SYNC.rateAdjustment : 1 + SYNC.rateAdjustment;
    return { type: 'rate', rate };
  }

  return { type: 'none', rate: 1 };
}

// The ping with the shortest round trip is the most trustworthy clock measurement
export function pickBestClockSample(samples) {
  if (samples.length === 0) {
    return null;
  }

  return samples.reduce((best, sample) => (sample.roundTripMs < best.roundTripMs ? sample : best));
}