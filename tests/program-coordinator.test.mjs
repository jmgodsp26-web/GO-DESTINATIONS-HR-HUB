import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isProgramCoordinator, coordinatorFromRole, coordinatorSetting, coordinatorOverride } from '../src/utils/programCoordinator.ts';
import { HRDatabase } from '../server/db.ts';

test('only real Program Coordinators count, not every coordinator', () => {
  const is = (department, job_title, is_pc) => isProgramCoordinator({ department, job_title, is_pc });
  assert.equal(is('Program Coordinator', 'Travel Coordinator'), true, 'the Program Coordinator department');
  assert.equal(is('Leadership', 'Program Coordinator'), true);
  assert.equal(is('Technology', 'Senior Program Coordinator - Flights'), true);
  assert.equal(is('Revenue', 'PC'), true);
  assert.equal(is('Revenue', 'Senior PC'), true);
  assert.equal(is('Revenue', 'PC - Flights'), true);
  assert.equal(is('HR', 'HR Coordinator'), false, 'other coordinators are not PCs');
  assert.equal(is('Property Services Division', 'Property Services Coordinator'), false);
  assert.equal(is('Leadership', 'Coordinator'), false);
  assert.equal(is('Technology', 'Epcot Specialist'), false, 'PC only counts as a word of its own');
  assert.equal(is('Technology', 'IT Support (PCs and laptops)'), false);
  assert.equal(is('', '', undefined), false);
});

test("HR's choice wins over department and job title", () => {
  assert.equal(isProgramCoordinator({ department: 'HR', job_title: 'HR Coordinator', is_pc: true }), true);
  assert.equal(isProgramCoordinator({ department: 'Program Coordinator', job_title: 'Program Coordinator', is_pc: false }), false);
  assert.equal(isProgramCoordinator({ department: 'Program Coordinator', job_title: 'x', is_pc: null }), true, 'null means automatic');
  assert.equal(coordinatorFromRole({ department: 'Program Coordinator', is_pc: false }), true, 'the automatic value ignores the choice');
  assert.deepEqual([true, false, null, undefined].map(coordinatorSetting), ['yes', 'no', 'auto', 'auto']);
  assert.deepEqual(['yes', 'no', 'auto'].map(coordinatorOverride), [true, false, null]);
});

function setup() {
  process.env.INITIAL_ADMIN_EMAIL = 'pc-admin@example.test';
  process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Pc-Admin-724!';
  const db = HRDatabase.bootstrap();
  const admin = db.getAllEmployees()[0];
  const make = (name, department, job_title) => db.createEmployee({ full_name: name, email: name.toLowerCase().replace(/ /g, '.') + '@example.test', password: 'Synthetic-Pc-User-724!', phone: '', department, job_title, country: 'Philippines', date_joined: '2026-01-05', role: 'employee' }, admin);
  const hr = make('Trixie Sample', 'HR', 'HR Coordinator');
  const pc = make('Paolo Sample', 'Program Coordinator', 'Program Coordinator');
  const holiday = db.addHoliday({ name: 'Sample Holiday', date: '2027-01-01', country: 'Philippines', scope: 'Company-wide' }, admin);
  return { db, admin, hr, pc, holiday };
}
const listed = (db, id) => db.getAllEmployees().find(e => e.id === id);

test('HR can set, unset and return to automatic, and the list shows both the result and the choice', () => {
  const { db, admin, hr } = setup();
  assert.equal(listed(db, hr.id).is_pc, false);
  assert.equal(listed(db, hr.id).is_pc_override, null);
  db.updateEmployee(hr.id, { is_pc: true }, admin);
  assert.equal(listed(db, hr.id).is_pc, true);
  assert.equal(listed(db, hr.id).is_pc_override, true);
  assert.match(db.getAuditLogs()[0].details, /Now counts as a Program Coordinator/);
  db.updateEmployee(hr.id, { is_pc: null }, admin);
  assert.equal(listed(db, hr.id).is_pc, false);
  assert.equal(listed(db, hr.id).is_pc_override, null);
  assert.equal('is_pc' in db.getProfile(hr.id), false, 'automatic is stored as no value at all');
  assert.match(db.getAuditLogs()[0].details, /No longer counts as a Program Coordinator/);
  assert.throws(() => db.updateEmployee(hr.id, { is_pc: 'yes' }, admin), /program coordinator setting/);
  // Saving other details does not touch the setting.
  db.updateEmployee(hr.id, { phone: '+63 2 8555 0100' }, admin);
  assert.equal(listed(db, hr.id).is_pc_override, null);
});

test('the PC badge on holiday shifts follows the employee, including requests already sent', () => {
  const { db, admin, hr, pc, holiday } = setup();
  db.submitHolidayShiftRequest(db.getProfile(hr.id), { holiday_id: holiday.id, working_hours: '9:00 AM – 5:00 PM' });
  db.submitHolidayShiftRequest(db.getProfile(pc.id), { holiday_id: holiday.id, working_hours: '9:00 AM – 5:00 PM' });
  const shiftOf = (d, id) => d.getHolidayShifts({ holiday_id: holiday.id }).find(s => s.employee_id === id);
  assert.equal(shiftOf(db, hr.id).is_pc, false);
  assert.equal(shiftOf(db, pc.id).is_pc, true);

  // A request saved under the old rule (any "coordinator" counted) is corrected when the data is loaded.
  const state = db.exportState();
  state.holidayShifts.find(s => s.employee_id === hr.id).is_pc = true;
  const reloaded = new HRDatabase(state);
  assert.equal(shiftOf(reloaded, hr.id).is_pc, false);
  assert.equal(reloaded.exportState().holidayShifts.find(s => s.employee_id === hr.id).is_pc, false);

  // Changing the employee updates their existing requests straight away.
  reloaded.updateEmployee(hr.id, { is_pc: true }, admin);
  assert.equal(shiftOf(reloaded, hr.id).is_pc, true);
  reloaded.updateEmployee(pc.id, { department: 'Revenue', job_title: 'Sales Lead' }, admin);
  assert.equal(shiftOf(reloaded, pc.id).is_pc, false);
});

test('holiday coverage counts only Program Coordinators', () => {
  const { db, admin, hr, pc, holiday } = setup();
  for (const id of [hr.id, pc.id]) db.assignHolidayShift(admin, { employee_id: id, holiday_id: holiday.id, working_hours: '9:00 AM – 5:00 PM', status: 'Approved' });
  const coverage = db.getHolidayStaffingCoverage(holiday.id);
  assert.equal(coverage.working_count, 2);
  assert.equal(coverage.pcs_working_count, 1, 'the HR Coordinator is not counted as a PC');
  assert.equal(coverage.pcs_required, 2);
  const statuses = Object.fromEntries(coverage.all_employee_statuses.map(s => [s.employee_id, s.is_pc]));
  assert.equal(statuses[hr.id], false);
  assert.equal(statuses[pc.id], true);
});
