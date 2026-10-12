import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HRDatabase } from '../server/db.ts';
import { employeeCalendar } from '../src/utils/employeeCalendar.ts';
import { employeeReportCsv } from '../src/utils/employeeReport.ts';
import { isHolidayApplicableToEmployee, EMPLOYEE_COUNTRIES } from '../src/utils/countryUtils.ts';
import { OFFICIAL_DEPARTMENTS, DEPARTMENT_MASTER_DATA } from '../src/constants/masterData.ts';

process.env.INITIAL_ADMIN_EMAIL = 'calendar-admin@example.test';
process.env.INITIAL_ADMIN_PASSWORD = 'Synthetic-Calendar-Admin-938!';
const seed = HRDatabase.bootstrap();
const admin = seed.getAllEmployees()[0];
const employee = seed.createEmployee({full_name:'Calendar employee',email:'calendar@example.test',phone:'',department:'HR',job_title:'HR specialist',country:'Philippines',region:'Cebu',holiday_calendar:'United States',holiday_region:'California',date_joined:'2026-01-01'},admin);
const baseline = seed.exportState();
const scenario = (name, run) => test(name, () => run(new HRDatabase(baseline)));

test('HR and all six employee countries are available', () => {
  assert.ok(OFFICIAL_DEPARTMENTS.includes('HR'));
  assert.ok(DEPARTMENT_MASTER_DATA.some(d => d.name === 'HR' && d.is_active));
  assert.deepEqual(EMPLOYEE_COUNTRIES, ['Canada','Argentina','United States','Philippines','Costa Rica','United Kingdom']);
});
scenario('physical country is independent from calendar, leave and calendar events', db => {
  const us = db.addHoliday({name:'Synthetic US holiday',date:'2026-10-12',country:'United States'}, admin);
  const ph = db.addHoliday({name:'Synthetic PH holiday',date:'2026-10-13',country:'Philippines'}, admin);
  const request = db.submitLeaveRequest(employee,{leave_type:'Vacation Leave',start_date:'2026-10-12',end_date:'2026-10-13',reason:'Synthetic test'});
  assert.equal(request.total_days,1);
  const ids = db.getCalendarEvents(employee).map(e=>e.id);
  assert.ok(ids.includes(us.id)); assert.ok(!ids.includes(ph.id));
  assert.equal(isHolidayApplicableToEmployee(us,employee),true);
  assert.equal(isHolidayApplicableToEmployee(ph,employee),false);
});
scenario('physical location edits preserve the assigned calendar across reloads', db => {
  db.updateEmployee(employee.id,{country:'Canada',region:'Ontario'},admin);
  const restored = new HRDatabase(db.exportState()).getAllEmployees().find(e=>e.id===employee.id);
  assert.equal(restored.country,'Canada');
  assert.deepEqual(employeeCalendar(restored),{country:'United States',region:'California'});
});
scenario('changing holiday country clears stale holiday region', db => {
  const updated=db.updateEmployee(employee.id,{holiday_calendar:'Argentina'},admin);
  assert.deepEqual(employeeCalendar(updated),{country:'Argentina',region:''});
});
scenario('legacy country and region remain assigned when physical country is changed', db => {
  const state=db.exportState();
  const row=state.users.find(u=>u.id===employee.id);
  delete row.profile.holiday_calendar; delete row.profile.holiday_region;
  const legacyDb=new HRDatabase(state);
  const updated=legacyDb.updateEmployee(employee.id,{country:'Canada',region:'Ontario'},admin);
  assert.deepEqual(employeeCalendar(updated),{country:'Philippines',region:'Cebu'});
});
scenario('explicit company-wide only excludes national holidays', db => {
  const updated=db.updateEmployee(employee.id,{holiday_calendar:'',holiday_region:''},admin);
  assert.equal(isHolidayApplicableToEmployee({country:'Philippines',is_active:true},updated),false);
  assert.equal(isHolidayApplicableToEmployee({country:'Global',scope:'Company-wide',is_active:true},updated),true);
});
test('regional matching uses holiday region, not physical region', () => {
  assert.equal(isHolidayApplicableToEmployee({country:'United States',region:'California',is_active:true},employee),true);
  assert.equal(isHolidayApplicableToEmployee({country:'United States',region:'Cebu',is_active:true},employee),false);
});
test('CSV separates country/calendar, escapes cells and omits private fields', () => {
  const csv=employeeReportCsv([{...employee, full_name:'=1+1',job_title:'HR, "People"',passwordHash:'SECRET_HASH',phone:'SECRET_PHONE',date_of_birth:'SECRET_DOB'}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"HR, ""People"""'));
  assert.ok(csv.includes('"Philippines","Cebu","United States","California"'));
  assert.equal(csv.includes('SECRET_'),false);
  assert.equal(csv.split('\r\n').length,2);
});
scenario('reject non-string calendar updates', db => {
  assert.throws(()=>db.updateEmployee(employee.id,{holiday_calendar:42},admin),/Invalid holiday/);
});
