import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigateWorkspace } from '../src/utils/workspace.ts';

test('admin can open personal pages and return to administration without changing identity', () => {
  for (const tab of ['profile', 'leave', 'dashboard']) assert.deepEqual(navigateWorkspace('admin', 'administration', tab), {mode: 'personal', tab});
  assert.deepEqual(navigateWorkspace('admin', 'administration', 'my-workspace'), {mode: 'personal', tab: 'dashboard'});
  assert.deepEqual(navigateWorkspace('admin', 'personal', 'admin-dashboard'), {mode: 'administration', tab: 'admin-dashboard'});
  for (const mode of ['personal', 'administration']) for (const tab of ['calendar', 'holidays', 'documents', 'settings', 'notifications']) assert.deepEqual(navigateWorkspace('admin', mode, tab), {mode, tab});
});
test('personal status notifications open My Leave; review notifications open approvals', () => {
  assert.deepEqual(navigateWorkspace('admin', 'administration', 'leave'), {mode: 'personal', tab: 'leave'});
  assert.deepEqual(navigateWorkspace('admin', 'personal', 'leave-requests'), {mode: 'administration', tab: 'leave-requests'});
  assert.deepEqual(navigateWorkspace('admin', 'administration', 'history'), {mode: 'personal', tab: 'leave'});
  assert.deepEqual(navigateWorkspace('employee', 'personal', 'leave-requests'), {mode: 'personal', tab: 'leave'});
});
test('employee navigation never enables administration', () => {
  for (const tab of ['admin-dashboard', 'employees', 'reports', 'audit-logs', 'settings']) assert.equal(navigateWorkspace('employee', 'administration', tab).mode, 'personal');
});
