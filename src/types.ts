export {
  type DepartmentName,
  type LeaveType,
  OFFICIAL_DEPARTMENTS,
  OFFICIAL_LEAVE_TYPES,
  DEPARTMENT_MASTER_DATA,
  LEAVE_TYPE_MASTER_DATA,
  LEAVE_TYPE_CONFIGS,
  isPaidLeaveType,
  getLeaveTypeConfig,
  getActiveDepartments,
  getActiveLeaveTypes,
} from './constants/masterData';

import type { LeaveType, DepartmentName } from './constants/masterData';

export type UserRole = 'employee' | 'admin';

export type EmployeeStatus = 'active' | 'disabled';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type LeaveTransactionType =
  | 'initial_allocation'
  | 'leave_deduction'
  | 'leave_reversal'
  | 'holiday_credit'
  | 'holiday_credit_reversal'
  | 'admin_adjustment'
  | 'manual_adjustment';

export interface LeaveTransaction {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type: LeaveType;
  amount: number; // Positive (credit/allocation) or Negative (deduction/reversal)
  balance_after: number;
  transaction_type: LeaveTransactionType;
  reference_type?: 'leave_request' | 'holiday_shift' | 'admin_adjustment' | 'initial_allocation';
  reference_id?: string; // Connected directly to Leave Request ID or Holiday Shift ID
  holiday_date?: string;
  holiday_name?: string;
  description: string;
  notes?: string;
  performed_by_id?: string;
  performed_by_name?: string;
  created_by_name?: string;
  created_at: string;
  timestamp?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  employee_id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  job_title: string;
  country: string;
  region?: string;
  timezone?: string;
  date_joined: string;
  hire_date?: string;
  date_of_birth?: string;
  birthday?: string;
  avatar_url: string;
  role: UserRole;
  status: EmployeeStatus;
  is_pc?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  allocated_days: number;
  used_days: number;
  created_at: string;
  updated_at: string;
}

export type HalfDayPeriod = 'morning' | 'afternoon';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_department: string;
  employee_avatar?: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day?: boolean;
  half_day_period?: HalfDayPeriod;
  reason: string;
  attachment_name?: string;
  attachment_url?: string;
  status: LeaveStatus;
  admin_note?: string;
  submitted_at: string;
  updated_at?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewed_by_name?: string;
}

export type HolidayType = 'Public Holiday' | 'Company Holiday' | 'Regional Holiday' | 'Observance';
export type HolidayScope = 'Country-specific' | 'Company-wide';

export interface Holiday {
  id: string;
  name: string;
  date: string;
  country: string;
  region?: string;
  holiday_type: HolidayType;
  scope: HolidayScope;
  description?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type HolidayShiftStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface HolidayShiftRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_department: string;
  employee_avatar?: string;
  job_title: string;
  is_pc: boolean;
  holiday_id: string;
  holiday_name: string;
  holiday_date: string;
  working_hours: string; // e.g., '9:00 AM – 5:00 PM'
  reason?: string;
  status: HolidayShiftStatus;
  admin_note?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export type HolidayCoverageStatus = 'Good' | 'PC Coverage Needed' | 'Understaffed';

export type EmployeeHolidayStatusType =
  | 'Working'
  | 'On Leave'
  | 'Holiday Shift Pending'
  | 'Leave Pending'
  | 'No Request'
  | 'Request Rejected'
  | 'Conflict';

export interface HolidayEmployeeStatus {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  department: string;
  job_title: string;
  is_pc: boolean;
  avatar_url: string;
  status: EmployeeHolidayStatusType;
  status_label: string;
  details?: string;
  shift_request?: HolidayShiftRequest;
  leave_request?: LeaveRequest;
}

export interface HolidayStaffingCoverage {
  holiday: Holiday;
  total_employees: number;
  working_count: number;
  leave_count: number;
  pending_leave_count: number;
  pending_shift_count: number;
  total_pending_count: number;
  unaccounted_count: number;
  pcs_working_count: number;
  pcs_required: number;
  coverage_status: HolidayCoverageStatus;
  conflicts_count: number;
  working_shifts: HolidayShiftRequest[];
  on_leave_records: { employee_id: string; employee_name: string; employee_email: string; department: string; avatar_url: string; job_title: string; is_pc: boolean; leave_request: LeaveRequest }[];
  pending_shifts: HolidayShiftRequest[];
  pending_leaves: { employee_id: string; employee_name: string; employee_email: string; department: string; avatar_url: string; job_title: string; is_pc: boolean; leave_request: LeaveRequest }[];
  all_employee_statuses: HolidayEmployeeStatus[];
}

export interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  target_type: 'employee' | 'leave_request' | 'holiday' | 'leave_balance' | 'security';
  target_id: string;
  details: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'leave_approved' | 'leave_rejected' | 'new_request' | 'system' | 'holiday';
  read: boolean;
  created_at: string;
  link_tab?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  end_date?: string;
  type: 'holiday' | 'approved_leave' | 'pending_leave' | 'holiday_shift';
  employee_name?: string;
  department?: string;
  employee_department?: string;
  description?: string;
  leave_type?: LeaveType;
  total_days?: number;
  is_half_day?: boolean;
  half_day_period?: HalfDayPeriod;
  is_pc?: boolean;
  working_hours?: string;
  status?: string;
}

export interface AuthResponse {
  user: UserProfile;
  mustChangePassword?: boolean;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  name: string;
  category: 'Contract' | 'ID Proof' | 'Resume' | 'Certificate' | 'Review' | 'Other';
  file_size: string;
  file_data?: string;
  uploaded_at: string;
  uploaded_by_name: string;
}

export interface CompanySettings {
  company_name: string;
  timezone: string;
  working_hours: string;
  workweek: string;
  annual_leave_default: number;
  sick_leave_default: number;
  casual_leave_default: number;
  holiday_credit_rate: number;
  require_medical_cert_days: number;
  email_notifications_enabled: boolean;
  browser_notifications_enabled: boolean;
  leave_approval_digest: 'instant' | 'daily' | 'weekly';
  supabase_configured: boolean;
  updated_at?: string;
}

export interface ReportSummary {
  totalEmployees: number;
  activeEmployees: number;
  totalLeaveRequests: number;
  approvedLeaveDays: number;
  pendingRequests: number;
  rejectedRequests: number;
  departmentStats: {
    department: string;
    totalStaff: number;
    daysTaken: number;
    pendingCount: number;
    utilizationRate: number;
  }[];
  leaveTypeBreakdown: {
    type: LeaveType;
    days: number;
    percentage: number;
  }[];
}
