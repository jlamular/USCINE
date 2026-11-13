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