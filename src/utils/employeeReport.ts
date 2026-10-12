import type { UserProfile } from '../types';
import { csvRow } from './csv';
import { employeeCalendar } from './employeeCalendar';

/** Explicit columns prevent credentials or private document data entering exports. */
export function employeeReportCsv(employees: UserProfile[]): string {
  const headers = ['Employee ID', 'Full Name', 'Email', 'Department', 'Job Title', 'Country', 'Region', 'Holiday Calendar', 'Holiday Region', 'Hire Date', 'Role', 'Status'];
  return '\uFEFF' + [headers, ...employees.map(employee => {
    const calendar = employeeCalendar(employee);
    return [employee.employee_id, employee.full_name, employee.email, employee.department,
      employee.job_title, employee.country, employee.region, calendar.country || 'Company-wide only',
      calendar.region, employee.hire_date || employee.date_joined, employee.role, employee.status];
  })].map(csvRow).join('\r\n');
}
