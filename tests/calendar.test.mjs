import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventsOnDate, filterCalendarEvents, monthDates, moveCalendarMonth } from '../src/utils/calendar.ts';
const leave = { id: 'leave', type: 'approved_leave', date: '2026-10-30', end_date: '2026-11-02', employee_department: 'Operations' };
const holiday = { id: 'holiday', type: 'holiday', date: '2026-11-01' };
test('calendar includes multi-day leave on inclusive boundaries across months', () => {
  assert.equal(eventsOnDate([leave], '2026-10-29').length, 0);
  for (const date of ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']) assert.deepEqual(eventsOnDate([leave], date), [leave]);
  assert.equal(eventsOnDate([leave], '2026-11-03').length, 0);
  assert.deepEqual(eventsOnDate([holiday], '2026-11-01'), [holiday]);
});
test('calendar combines type and department filters without hiding shared holidays', () => {
  const other = { ...leave, id: 'other', employee_department: 'Sales' };
  assert.deepEqual(filterCalendarEvents([leave, holiday, other], ['approved_leave', 'holiday'], 'Operations'), [leave, holiday]);
  assert.deepEqual(filterCalendarEvents([leave, holiday], ['holiday'], 'all'), [holiday]);
  assert.deepEqual(filterCalendarEvents([leave, holiday], [], 'all'), []);
});
test('calendar navigation handles year boundaries and leap-month lengths', () => {
  assert.equal(moveCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(moveCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(monthDates('2024-02').at(-1), '2024-02-29');
  assert.equal(monthDates('2026-02').length, 28);
});
