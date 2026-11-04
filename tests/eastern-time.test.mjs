import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easternDate, easternDateTimeInput, easternInputToISOString } from '../src/utils/easternTime.ts';

test('Eastern calendar date rolls over at New York midnight in winter and summer', () => {
  assert.equal(easternDate(new Date('2026-11-05T04:59:59Z')), '2026-11-04');
  assert.equal(easternDate(new Date('2026-11-05T05:00:00Z')), '2026-11-05');
  assert.equal(easternDate(new Date('2026-07-01T04:00:00Z')), '2026-07-01');
});

test('Eastern announcement expiry round trips with seasonal offsets', () => {
  for (const [local, utc] of [['2026-11-05T09:00', '2026-11-05T14:00:00.000Z'], ['2026-07-01T09:00', '2026-07-01T13:00:00.000Z']]) {
    assert.equal(easternInputToISOString(local), utc);
    assert.equal(easternDateTimeInput(new Date(utc)), local);
  }
  assert.equal(easternInputToISOString('2026-03-08T02:30'), null);
  assert.equal(easternInputToISOString('2026-11-01T01:30'), null);
  assert.equal(easternInputToISOString('2026-02-30T09:00'), null);
});
