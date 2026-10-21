import type { HRDatabase } from './db.js';
import type { UserProfile } from '../src/types.js';
import type { PersonalDashboardData, AdministrationDashboardData } from '../src/types/dashboard.js';
import { employeeCalendar } from '../src/utils/employeeCalendar.js';
import { getTodayDateString } from '../src/utils/countryUtils.js';

export function personalDashboard(db: HRDatabase, actor: UserProfile): PersonalDashboardData {
  return {
    balances: db.getLeaveBalances(actor.id),
    // Administrators also use My Workspace: never include colleagues' requests.
    requests: db.getLeaveRequests(actor, { employee: actor.id }),
    holidays: db.getHolidays({ country: employeeCalendar(actor).country, is_active: true, upcoming_only: true, reference_date: getTodayDateString(actor.timezone) }),
    shifts: db.getHolidayShifts({ employee_id: actor.id }),
  };
}
export function administrationDashboard(db: HRDatabase, actor: UserProfile): AdministrationDashboardData {
  if (actor.role !== 'admin') throw new Error('Administrative privileges required.');
  return { employees: db.getAllEmployees(), requests: db.getLeaveRequests(actor), holidays: db.getHolidays() };
}
