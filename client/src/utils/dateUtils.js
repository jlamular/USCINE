// The API sends UTC timestamps without a "Z" at the end, so browsers would read them as local time.
// This adds the missing UTC marker before creating the Date.
export function parseUtcDate(value) {
  const hasTimeZone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
}

export function formatDate(value) {
  return parseUtcDate(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// "3:45 PM" for today, "Nov 14, 3:45 PM" for earlier days
export function formatMessageTime(value) {
  const date = parseUtcDate(value);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (date.toDateString() === new Date().toDateString()) {
    return time;
  }

  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}

export function formatFullDateTime(value) {
  return parseUtcDate(value).toLocaleString();
}