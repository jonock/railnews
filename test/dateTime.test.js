import assert from 'node:assert/strict';
import test from 'node:test';

import { calendarDaysUntil, hasDateTimePassed } from '../public/dateTime.js';

const EVENT_DATE = '2026-09-10';
const TIME_ZONE = 'Europe/Zurich';

test('calendarDaysUntil preserves the event expiry state in Zurich', () => {
  assert.equal(calendarDaysUntil(EVENT_DATE, TIME_ZONE, new Date('2026-09-09T21:59:00Z')), 1);
  assert.equal(calendarDaysUntil(EVENT_DATE, TIME_ZONE, new Date('2026-09-09T22:00:00Z')), 0);
  assert.equal(calendarDaysUntil(EVENT_DATE, TIME_ZONE, new Date('2026-09-10T22:00:00Z')), -1);
});

test('the four-day trip ends after 13 September in Zurich', () => {
  assert.equal(calendarDaysUntil('2026-09-13', TIME_ZONE, new Date('2026-09-13T21:59:00Z')), 0);
  assert.equal(calendarDaysUntil('2026-09-13', TIME_ZONE, new Date('2026-09-13T22:00:00Z')), -1);
});

test('the Belgium special starts at exactly 17:00 in Zurich', () => {
  const startAt = '2026-09-10T17:00:00+02:00';

  assert.equal(hasDateTimePassed(startAt, new Date('2026-09-10T14:59:59.999Z')), false);
  assert.equal(hasDateTimePassed(startAt, new Date('2026-09-10T15:00:00.000Z')), true);
});
