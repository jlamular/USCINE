// Reads the expiry time (the "exp" claim) out of a login token, in milliseconds.
// This is only to show a friendly message in time. It is NOT a security check:
// the server validates every token itself, so a faked value here gains an attacker nothing.
export function getTokenExpiryMs(token) {
  try {
    const payloadPart = token.split('.')[1];
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));

    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}