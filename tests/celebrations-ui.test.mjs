import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { goAnniversaryLabel } from '../src/utils/celebrations.ts';

let dir, Spotlight, Board, AdminBoard;
before(async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  dir = await mkdtemp(root + '/.celebrations-render-');
  await build({ entryPoints: { team: root + '/src/components/dashboard/TeamCelebrations.tsx', admin: root + '/src/components/admin/CelebrationsWidget.tsx' }, outdir: dir, bundle: true, platform: 'node', format: 'esm', packages: 'external', loader: { '.css': 'empty' }, outExtension: { '.js': '.mjs' } });
  const team = await import(pathToFileURL(dir + '/team.mjs'));
  Spotlight = team.CelebrationSpotlight; Board = team.TeamCelebrations;
  AdminBoard = (await import(pathToFileURL(dir + '/admin.mjs'))).CelebrationsWidget;
});
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

const item = { id: 'synthetic:birthday:2027-01-01', employee_id: 'synthetic', name: 'Test Colleague', type: 'birthday', date: '2027-01-01', days_until: 3, my_reaction: null, reactions: ['🎉', '🎂', '❤️', '👏'].map(emoji => ({ emoji, people: [] })) };
const render = (event, extra = {}) => renderToStaticMarkup(React.createElement(Spotlight, { item: event, busy: false, peopleOpen: false, onReact() {}, onTogglePeople() {}, ...extra }));
const visible = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('birthday board distinguishes upcoming and today, omits years, and offers reactions only today', () => {
  const future = render({ ...item, years: 1990 }); // Even an unexpected birthday years field must not render.
  assert.match(visible(future), /Upcoming birthday: Test Colleague/);
  assert.match(visible(future), /January 1/);
  assert.doesNotMatch(visible(future), /1990|2027|Turning|birthday today/);
  assert.doesNotMatch(future, /aria-label="Celebration reactions"/);
  const today = render({ ...item, days_until: 0 });
  assert.match(visible(today), /It’s Test Colleague’s birthday today!/);
  assert.match(visible(today), /Your GO team wishes you a wonderful birthday!/);
  assert.match(today, /aria-label="Celebration reactions"/);
  assert.equal((today.match(/aria-pressed="false"/g) || []).length, 4);
  const board = renderToStaticMarkup(React.createElement(Board));
  assert.doesNotMatch(board, /checkbox|birthday visibility|Show my birthday/);
});

test('anniversary board distinguishes service years, and shared reaction details stay accessible', () => {
  const anniversary = render({ ...item, type: 'anniversary', years: 1, days_until: 1 });
  assert.match(visible(anniversary), /Upcoming 1st GO Anniversary: Test Colleague/);
  assert.match(visible(anniversary), /1 year with GO on January 1/);
  const today = render({ ...item, type: 'anniversary', years: 5, days_until: 0, my_reaction: '🎉', reactions: [{ emoji: '🎉', people: [{ id: 'peer', name: 'Synthetic Teammate' }] }] }, { peopleOpen: true, busy: true });
  assert.match(visible(today), /Happy 5th GO Anniversary! Test Colleague/);
  assert.match(visible(today), /5 years with GO/);
  assert.match(today, /aria-pressed="true"/);
  assert.match(today, /aria-label="Who reacted"/);
  assert.match(visible(today), /Synthetic Teammate/);
  assert.match(today, /disabled=""/);
});

test('GO anniversary messages use correct service-year ordinals, including teen and later milestones', () => {
  for (const [years, ordinal] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [111, '111th']]) {
    assert.equal(goAnniversaryLabel(years), `${ordinal} GO Anniversary`);
    assert.ok(visible(render({ ...item, type: 'anniversary', years, days_until: 0 })).includes(`Happy ${ordinal} GO Anniversary!`));
  }
  for (const value of [undefined, 0, -1, 1.5, NaN]) assert.equal(goAnniversaryLabel(value), 'GO Anniversary');
});

test('admin birthday cards omit the original birth year and calculated age', () => {
  const now = new Date(), month = String(now.getMonth() + 1).padStart(2, '0'), day = String(now.getDate()).padStart(2, '0');
  const html = renderToStaticMarkup(React.createElement(AdminBoard, { employees: [{ id: 'synthetic', full_name: 'Test Colleague', email: 'synthetic@example.test', department: 'HR', job_title: 'Test role', date_of_birth: `1990-${month}-${day}` }] }));
  assert.match(visible(html), /Birthday today!/);
  assert.doesNotMatch(visible(html), /1990|Turning|Born on/);
});
