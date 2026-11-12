import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { greetingFor, isNightHour, titleWords, ringOffset, RING_CIRCUMFERENCE, countUpValue, formatTripRange, formatMediumDate, ticketParts, nextTimeOff, heroTip, reviewOutlook, buddyMessages, daysBetween, countdownLabel, formatLeaveSpan, balanceSummary, leaveTypeList, coverageLabel, formatDateRange, formatDayCount, formatStamp, friendlyMessage, balanceCardFigures } from '../src/utils/brandDisplay.ts';

const leave = (overrides = {}) => ({ id: 'r1', employee_id: 'e1', employee_name: 'Synthetic Person', employee_department: 'Operations', leave_type: 'Vacation Leave', start_date: '2026-12-21', end_date: '2026-12-23', total_days: 3, status: 'Approved', reason: 'Synthetic', submitted_at: '2026-11-01T00:00:00Z', ...overrides });
const balance = (overrides = {}) => ({ id: 'b1', employee_id: 'e1', leave_type: 'Vacation Leave', allocated_days: 20, used_days: 3, created_at: '', updated_at: '', ...overrides });

test('greetings follow the local hour', () => {
  assert.equal(greetingFor(5), 'Good morning');
  assert.equal(greetingFor(11), 'Good morning');
  assert.equal(greetingFor(12), 'Good afternoon');
  assert.equal(greetingFor(17), 'Good afternoon');
  assert.equal(greetingFor(18), 'Good evening');
  assert.equal(greetingFor(2), 'Good evening');
  assert.deepEqual([4, 5, 12, 17, 18, 23].map(isNightHour), [true, false, false, false, true, true]);
});

test('page titles accent only the last word of multi-word titles', () => {
  assert.deepEqual(titleWords('Team overview'), [{ word: 'Team', accent: false }, { word: 'overview', accent: true }]);
  assert.deepEqual(titleWords('  Reports '), [{ word: 'Reports', accent: false }]);
  assert.deepEqual(titleWords(''), []);
});

test('rings clamp their fraction and count-up lands exactly on the target', () => {
  assert.equal(ringOffset(1), 0);
  assert.equal(ringOffset(0), Number(RING_CIRCUMFERENCE.toFixed(3)));
  assert.equal(ringOffset(2), 0);
  assert.equal(ringOffset(-1), ringOffset(0));
  assert.equal(ringOffset(NaN), ringOffset(0));
  assert.equal(ringOffset(0.5), Number((RING_CIRCUMFERENCE / 2).toFixed(3)));
  assert.equal(countUpValue(17, 1), 17);
  assert.equal(countUpValue(17, 0), 0);
  assert.ok(Number.isInteger(countUpValue(17, 0.4)));
  assert.equal(countUpValue(2.5, 1), 2.5);
  assert.equal(countUpValue(2.5, 0.5) % 0.5, 0);
  assert.equal(countUpValue(1, 1, 2), 1);
});

test('trip ranges and boarding-pass stubs use the stored dates without shifting days', () => {
  assert.equal(formatTripRange('2026-12-21', '2026-12-23'), 'Dec 21–23');
  assert.equal(formatTripRange('2026-12-30', '2027-01-02'), 'Dec 30 – Jan 2');
  assert.equal(formatTripRange('2026-12-21', '2026-12-21'), 'Dec 21');
  assert.deepEqual(ticketParts('2026-11-26'), { month: 'NOV', day: '26', weekday: 'Thu' });
  assert.deepEqual(ticketParts('2027-01-01'), { month: 'JAN', day: '1', weekday: 'Fri' });
  assert.equal(ticketParts('not-a-date').day, 'not-a-date');
});

test('the hero names the current or next approved leave and the vacation balance', () => {
  const requests = [leave(), leave({ id: 'r2', start_date: '2026-11-20', end_date: '2026-11-20', status: 'Pending' }), leave({ id: 'r3', start_date: '2026-10-01', end_date: '2026-10-02' })];
  const next = nextTimeOff(requests, '2026-11-11');
  assert.equal(next.request.id, 'r1');
  assert.equal(next.current, false);
  assert.equal(heroTip({ vacation: balance(), next }), '17 vacation days left. Your next time off is approved for Dec 21–23.');
  assert.equal(nextTimeOff(requests, '2026-12-22').current, true);
  assert.equal(heroTip({ vacation: balance(), next: nextTimeOff(requests, '2026-12-22') }), 'You’re on approved leave until Dec 23. Enjoy the break!');
  assert.equal(nextTimeOff(requests, '2027-01-01'), null);
  assert.equal(heroTip({ vacation: balance({ used_days: 19 }), next: null }), '1 vacation day left. No time off booked yet.');
  assert.equal(heroTip({ vacation: undefined, next: null }), 'No time off booked yet.');
});

test('quick review explains the balance after approval and department overlaps', () => {
  const pending = leave({ id: 'p1', status: 'Pending', total_days: 2 });
  const overlap = leave({ id: 'a1', employee_id: 'e2', employee_name: 'Colleague One', start_date: '2026-12-22', end_date: '2026-12-22' });
  const otherDept = leave({ id: 'a2', employee_id: 'e3', employee_name: 'Elsewhere', employee_department: 'Sales' });
  const outlook = reviewOutlook(pending, balance(), [overlap, otherDept, leave({ id: 'a3', employee_id: 'e2', employee_name: 'Colleague One' })]);
  assert.deepEqual(outlook, { paid: true, allocated: 20, remaining: 17, after: 15, enough: true, overlaps: ['Colleague One'] });
  assert.equal(reviewOutlook(pending, balance({ used_days: 19 }), []).enough, false);
  assert.equal(reviewOutlook(pending, undefined, []).enough, false);
  const unpaid = reviewOutlook(leave({ leave_type: 'Unpaid Leave', status: 'Pending' }), undefined, []);
  assert.equal(unpaid.paid, false);
  assert.equal(unpaid.enough, true);
  assert.equal(reviewOutlook(leave({ leave_type: 'Holiday Shift Credit', status: 'Pending', total_days: 1 }), balance({ leave_type: 'Holiday Shift Credit', allocated_days: 1, used_days: 0 }), []).after, 0);
});

test('the GO buddy only mentions facts it was given', () => {
  const friday = buddyMessages({ firstName: 'Ana', hour: 9, weekday: 5, unread: 2 });
  assert.equal(friday[0], 'Have a lovely weekend, Ana!');
  assert.ok(friday.includes('You have 2 unread notifications.'));
  assert.ok(!friday.some(line => /leave request/.test(line)));
  assert.equal(buddyMessages({ firstName: 'Ana', hour: 9, weekday: 6, unread: 0 })[0], 'Enjoy your weekend, Ana!');
  assert.equal(buddyMessages({ firstName: 'Ana', hour: 9, weekday: 1, unread: 0 })[0], 'Have a great week, Ana!');
  assert.equal(buddyMessages({ firstName: 'Ana', hour: 10, weekday: 3, unread: 0 })[0], 'Have a great day, Ana!');
  const admin = buddyMessages({ firstName: 'Maria', hour: 20, weekday: 3, unread: 0, newRequests: 1, onboarding: false });
  assert.equal(admin[0], 'Have a restful evening, Maria!');
  assert.ok(admin.includes('1 new leave request to review.'));
  assert.ok(admin.includes('You’re all caught up on notifications.'));
});

test('countdowns, leave spans and balances are derived from stored values only', () => {
  assert.equal(daysBetween('2026-11-11', '2026-12-21'), 40);
  assert.equal(daysBetween('2026-12-21', '2026-11-11'), -40);
  assert.equal(daysBetween('nope', '2026-11-11'), null);
  assert.equal(countdownLabel('2026-11-11', '2026-12-21'), '40 days to go');
  assert.equal(countdownLabel('2026-12-20', '2026-12-21'), 'Starts tomorrow');
  assert.equal(countdownLabel('2026-12-21', '2026-12-21'), 'Starts today');
  assert.equal(countdownLabel('2026-12-22', '2026-12-21'), '');
  assert.equal(formatLeaveSpan(leave()), 'Dec 21–23, 2026 · 3 days');
  assert.equal(formatLeaveSpan(leave({ start_date: '2026-11-20', end_date: '2026-11-20', total_days: 1 })), 'Nov 20, 2026 · 1 day');
  assert.equal(formatLeaveSpan(leave({ start_date: '2026-11-20', end_date: '2026-11-20', total_days: 0.5, is_half_day: true })), 'Nov 20, 2026 · Half day');
  assert.equal(formatLeaveSpan(leave({ start_date: '2026-12-30', end_date: '2027-01-02', total_days: 3 })), 'Dec 30 – Jan 2, 2027 · 3 days');
  assert.equal(formatMediumDate('2026-12-30'), 'Wed, Dec 30, 2026');
  assert.deepEqual(balanceSummary([balance(), balance({ leave_type: 'Sick Leave', allocated_days: 10, used_days: 12 })]), { remaining: 17, allocated: 30, used: 15, fraction: 17 / 30 });
  assert.deepEqual(balanceSummary([]), { remaining: 0, allocated: 0, used: 0, fraction: 0 });
  assert.equal(leaveTypeList([balance({ leave_type: 'Emergency Leave' }), balance({ leave_type: 'Medical Leave' })]), 'Emergency and Medical');
  assert.equal(leaveTypeList([balance({ leave_type: 'Emergency Leave' }), balance({ leave_type: 'Medical Leave' }), balance({ leave_type: 'Holiday Shift Credit' })]), 'Emergency, Medical and Holiday Shift Credit');
  assert.equal(leaveTypeList([]), '');
});

test('inner pages show friendly dates, day counts and company-time stamps', () => {
  assert.equal(formatDateRange('2026-11-20', '2026-11-20'), 'Nov 20, 2026');
  assert.equal(formatDateRange('2026-12-21', '2026-12-23'), 'Dec 21–23, 2026');
  assert.equal(formatDateRange('2026-12-30', '2027-01-02'), 'Dec 30 – Jan 2, 2027');
  assert.equal(formatDateRange('not-a-date', 'also-not'), 'not-a-date – also-not');
  assert.deepEqual([1, 0.5, 3].map(formatDayCount), ['1 day', '0.5 days', '3 days']);
  assert.equal(formatStamp('2026-11-07T09:04:27Z'), 'Nov 7, 2026');
  assert.equal(formatStamp('2026-11-07T09:04:27Z', true), 'Nov 7, 2026, 4:04 AM EST');
  assert.equal(formatStamp('2026-07-01T16:30:00Z', true), 'Jul 1, 2026, 12:30 PM EDT');
  assert.equal(formatStamp(''), '');
  assert.equal(formatStamp('garbage'), '');
});

test('older notification messages lose raw ISO dates and "day(s)"', () => {
  assert.equal(friendlyMessage('Ben Carter submitted a request for 1 day(s) of Vacation Leave (2026-11-27).'), 'Ben Carter submitted a request for 1 day of Vacation Leave (Nov 27, 2026).');
  assert.equal(friendlyMessage('3 day(s) of Vacation Leave (2026-12-21 to 2026-12-23).'), '3 days of Vacation Leave (Dec 21–23, 2026).');
  assert.equal(friendlyMessage('Shift on 2026-13-45 stays as written'), 'Shift on 2026-13-45 stays as written');
  assert.equal(friendlyMessage('A company update is available.'), 'A company update is available.');
});

test('balance cards everywhere use the same figures', () => {
  assert.deepEqual(balanceCardFigures(balance()), { remaining: 17, unit: 'of 20 days left', fraction: 0.85, caption: '3 days used or booked' });
  assert.deepEqual(balanceCardFigures(balance({ allocated_days: 0, used_days: 0 })), { remaining: 0, unit: 'days left', fraction: 0, caption: 'No allowance assigned' });
  assert.deepEqual(balanceCardFigures(balance({ allocated_days: 1, used_days: 2 })).remaining, 0);
  assert.deepEqual(balanceCardFigures(balance({ leave_type: 'Unpaid Leave', allocated_days: 0, used_days: 2 })), { remaining: 2, unit: 'days taken', fraction: 0, caption: 'Unpaid · no balance deducted' });
  assert.equal(balanceCardFigures(undefined).remaining, null);
});

test('holiday coverage labels say what is missing', () => {
  assert.deepEqual(coverageLabel({ pcs_working_count: 0, pcs_required: 2 }), { text: 'Needs 2 more coordinators', attention: true });
  assert.deepEqual(coverageLabel({ pcs_working_count: 1, pcs_required: 2, conflicts_count: 1 }), { text: 'Needs 1 more coordinator · 1 conflict', attention: true });
  assert.deepEqual(coverageLabel({ pcs_working_count: 2, pcs_required: 2 }), { text: 'Covered · 2 of 2', attention: false });
  assert.deepEqual(coverageLabel({ pcs_working_count: 0, pcs_required: 0 }), { text: 'No coordinator required', attention: false });
});

let dir, ui;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  dir = await mkdtemp(root + '/.brand-render-');
  await build({ entryPoints: { ui: root + '/src/components/common/WorkspaceUI.tsx' }, outdir: dir, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outExtension: { '.js': '.mjs' } });
  ui = await import(pathToFileURL(dir + '/ui.mjs'));
});
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
const visible = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('page headings keep the full title for screen readers and accent the last word', () => {
  const html = renderToStaticMarkup(React.createElement(ui.PageHeading, { eyebrow: 'Administration', title: 'Team overview', description: 'Welcome back.' }));
  assert.match(html, /<h1><span class="sr-only">Team overview<\/span><span class="go-title-words" aria-hidden="true">/);
  assert.match(html, /class="go-title-word is-accent"[^>]*>overview</);
  assert.doesNotMatch(html, /class="go-title-word is-accent"[^>]*>Team</);
});

test('stat cards expose the real value to assistive technology and draw rings only when asked', () => {
  const html = renderToStaticMarkup(React.createElement(ui.StatCard, { label: 'Vacation Leave', value: 17, unit: 'days remaining', detail: '3 used of 20 allocated', icon: () => null, ring: 0.85 }));
  assert.match(html, /<span class="sr-only">17<\/span>/);
  assert.match(html, /go-stat-ring-bar/);
  assert.match(html, /stroke-dashoffset="26.389"/);
  const text = renderToStaticMarkup(React.createElement(ui.StatCard, { label: 'Holiday coverage', value: '0/2', detail: 'Thanksgiving', icon: () => null }));
  assert.match(visible(text), /0\/2/);
  assert.doesNotMatch(text, /go-stat-ring/);
  const empty = renderToStaticMarkup(React.createElement(ui.StatCard, { label: 'Sick Leave', value: 0, detail: 'None', icon: () => null, ring: 0 }));
  assert.match(empty, /go-stat-ring-track/);
  assert.doesNotMatch(empty, /go-stat-ring-bar/);
});

test('balance cards show a dash without an allowance and only draw a ring when days remain', () => {
  const full = renderToStaticMarkup(React.createElement(ui.BalanceCard, { label: 'Vacation Leave', icon: () => null, remaining: 17, unit: 'of 20 days left', caption: '3 days used or booked', fraction: 0.85 }));
  assert.match(full, /<span class="sr-only">17<\/span>/);
  assert.match(visible(full), /of 20 days left/);
  assert.match(full, /go-balance-ring-bar/);
  const none = renderToStaticMarkup(React.createElement(ui.BalanceCard, { label: 'Sick Leave', icon: () => null, remaining: null, unit: 'Not assigned', caption: 'Ask HR to check your allowance', fraction: 0 }));
  assert.match(visible(none), /—/);
  assert.doesNotMatch(none, /go-balance-ring-bar/);
  assert.match(renderToStaticMarkup(React.createElement(ui.StatusPill, { status: 'Approved' })), /go-pill is-approved/);
  assert.match(renderToStaticMarkup(React.createElement(ui.StatusPill, { status: 'Something else' })), /go-pill is-cancelled/);
  assert.match(visible(renderToStaticMarkup(React.createElement(ui.DateTile, { date: '2026-11-20' }))), /NOV 20/);
  const grid = renderToStaticMarkup(React.createElement(ui.LeaveBalanceGrid, { balances: [balance(), balance({ id: 'b2', leave_type: 'Medical Leave', allocated_days: 0, used_days: 0 })] }));
  assert.equal((grid.match(/go-balance-card/g) || []).length, 2);
  assert.match(visible(grid), /Vacation Leave.*of 20 days left.*Medical Leave.*No allowance assigned/);
  assert.doesNotMatch(grid, /<button/);
});
