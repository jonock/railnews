const sqliteTimestampPattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const titleDatePattern = /\s+-\s+(\d{4}-\d{2}-\d{2})$/;

const BRIEFING_COUNTRIES = [
  {
    code: 'se',
    name: 'Schweden',
    flag: '🇸🇪',
    terms: [
      'schweden', 'schwedisch', 'schwedische', 'schwedischen', 'schwedischer', 'schwedisches',
      'sweden', 'swedish', 'sverige', 'svensk', 'svenska', 'trafikverket', 'sj',
      'stockholm', 'goteborg', 'gothenburg', 'malmo', 'kiruna', 'malmbanan', 'ostlanken', 'jarnvagar'
    ]
  },
  {
    code: 'no',
    name: 'Norwegen',
    flag: '🇳🇴',
    terms: [
      'norwegen', 'norwegisch', 'norwegische', 'norwegischen', 'norwegischer', 'norwegisches',
      'norway', 'norwegian', 'norge', 'norsk', 'norske', 'bane nor',
      'oslo', 'bergen', 'trondheim', 'nordlandsbanen'
    ]
  },
  {
    code: 'dk',
    name: 'Dänemark',
    flag: '🇩🇰',
    terms: [
      'danemark', 'danisch', 'danische', 'danischen', 'danischer', 'danisches',
      'denmark', 'danish', 'danmark', 'dansk', 'danske', 'banedanmark', 'dsb',
      'kobenhavn', 'copenhagen', 'kopenhagen', 'aarhus'
    ]
  },
  {
    code: 'fi',
    name: 'Finnland',
    flag: '🇫🇮',
    terms: [
      'finnland', 'finnisch', 'finnische', 'finnischen', 'finnischer', 'finnisches',
      'finland', 'finnish', 'suomi', 'vaylavirasto', 'traficom', 'vr',
      'helsinki', 'tampere', 'turku'
    ]
  }
];

function normalizeCountryText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .toLowerCase();
}

function containsCountryTerm(text, term) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
}

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

export function briefingCountryFlags(summary = '') {
  return briefingCountryDetails(summary).map(({ flag }) => flag).join(' ');
}

export function briefingCountryDetails(summary = '') {
  const text = normalizeCountryText(summary);
  return BRIEFING_COUNTRIES
    .filter(({ terms }) => terms.some((term) => containsCountryTerm(text, term)))
    .map(({ code, name, flag }) => ({ code, name, flag }));
}

export function briefingTitle(title = '', summary = '') {
  const cleanTitle = String(title).replace(titleDatePattern, '');
  const flags = briefingCountryFlags(summary);
  return flags ? `${flags} ${cleanTitle}` : cleanTitle;
}
