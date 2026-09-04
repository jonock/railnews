const sqliteTimestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const titleDatePattern = /\s+-\s+(\d{4}-\d{2}-\d{2})$/;

function parseDate(value) {
  if (!value) return null;
  const dateOnly = dateOnlyPattern.exec(value);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const normalized = sqliteTimestampPattern.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
}

export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function formatLongDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export function localDateKey(value) {
  const date = parseDate(value);
  if (!date) return 'undated';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function calendarDaysUntil(dateKey, timeZone, now = new Date()) {
  const targetParts = dateOnlyPattern.exec(dateKey);
  if (!targetParts) return null;

  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const today = Object.fromEntries(todayParts.map(({ type, value }) => [type, value]));
  const targetTimestamp = Date.UTC(Number(targetParts[1]), Number(targetParts[2]) - 1, Number(targetParts[3]));
  const todayTimestamp = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day));
  return Math.round((targetTimestamp - todayTimestamp) / 86_400_000);
}

export function hasDateTimePassed(dateTime, now = new Date()) {
  const target = parseDate(dateTime);
  return target !== null && now.getTime() >= target.getTime();
}

export function briefingTitle(title = '') {
  return String(title).replace(titleDatePattern, '');
}
