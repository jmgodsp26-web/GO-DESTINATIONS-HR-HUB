import type { Holiday, HolidayShiftRequest, LeaveBalance, LeaveRequest, UserProfile } from '../types';

export interface PersonalDashboardData {
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  holidays: Holiday[];
  shifts: HolidayShiftRequest[];
}
export interface AdministrationDashboardData {
  employees: (UserProfile & { leave_balances: LeaveBalance[]; is_pc?: boolean })[];
  requests: LeaveRequest[];
  holidays: Holiday[];
}
