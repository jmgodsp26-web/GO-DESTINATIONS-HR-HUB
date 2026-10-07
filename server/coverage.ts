import type { HolidayStaffingCoverage, UserProfile } from '../src/types.js';
// Staffing visibility is separate from confidential leave and review details.
export function visibleCoverage(coverage: HolidayStaffingCoverage, user: UserProfile): HolidayStaffingCoverage {
  if (user.role === 'admin') return coverage;
  const request = (r: any) => !r || r.employee_id === user.id ? r : {
    id: r.id, employee_id: r.employee_id, employee_name: r.employee_name,
    employee_email: '', employee_department: r.employee_department, employee_avatar: r.employee_avatar,
    holiday_id: r.holiday_id, holiday_date: r.holiday_date, holiday_name: r.holiday_name,
    working_hours: r.working_hours, is_pc: r.is_pc, status: r.status,
    start_date: r.start_date, end_date: r.end_date, total_days: r.total_days,
    is_half_day: r.is_half_day, half_day_period: r.half_day_period,
    leave_type: r.leave_type ? 'Out of Office' : undefined,
  };
  const record = (r: any) => r.employee_id === user.id ? r : {
    employee_id: r.employee_id, employee_name: r.employee_name, employee_email: '', department: r.department,
    job_title: r.job_title, avatar_url: r.avatar_url, is_pc: r.is_pc,
    status: r.status, status_label: r.status_label,
    details: r.leave_request ? 'Out of Office' : undefined,
    leave_request: request(r.leave_request), shift_request: request(r.shift_request),
  };
  return { ...coverage,
    working_shifts: coverage.working_shifts.map(request), pending_shifts: coverage.pending_shifts.map(request),
    on_leave_records: coverage.on_leave_records.map(record), pending_leaves: coverage.pending_leaves.map(record),
    all_employee_statuses: coverage.all_employee_statuses.map(record),
  };
}
