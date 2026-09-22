/**
 * HR HUB CENTRALIZED MASTER DATA LAYER
 * Single source of truth for Departments and Leave Types.
 * Designed for immediate client/server consistency and clean future migration to database/Supabase.
 */

// ==========================================
// 1. DEPARTMENT MASTER DATA
// ==========================================

export type DepartmentName =
  | 'Leadership'
  | 'Relationship Management'
  | 'Program Management'
  | 'Program Administrator'
  | 'Program Coordinator'
  | 'Technology'
  | 'Revenue'
  | 'Property Services Division'
  | 'REA Careers'
  | 'Graphics & Design'
  | 'Audit'
  | 'Admin & Support'
  | 'WRW';

export interface DepartmentItem {
  id: string;
  name: DepartmentName;
  code: string;
  is_active: boolean;
  description: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Official Company Departments (13 Total)
 * Strictly enforced across employee profiles, directories, filters, and reports.
 */
export const OFFICIAL_DEPARTMENTS: readonly DepartmentName[] = [
  'Leadership',
  'Relationship Management',
  'Program Management',
  'Program Administrator',
  'Program Coordinator',
  'Technology',
  'Revenue',
  'Property Services Division',
  'REA Careers',
  'Graphics & Design',
  'Audit',
  'Admin & Support',
  'WRW',
] as const;

export const DEPARTMENT_MASTER_DATA: DepartmentItem[] = [
  {
    id: 'dept-01',
    name: 'Leadership',
    code: 'LDR',
    is_active: true,
    description: 'Executive strategy, governance, and organizational direction.',
  },
  {
    id: 'dept-02',
    name: 'Relationship Management',
    code: 'RM',
    is_active: true,
    description: 'Key client management, enterprise relations, and partnership retention.',
  },
  {
    id: 'dept-03',
    name: 'Program Management',
    code: 'PM',
    is_active: true,
    description: 'Overseeing comprehensive operational programs, delivery, and quality frameworks.',
  },
  {
    id: 'dept-04',
    name: 'Program Administrator',
    code: 'PA',
    is_active: true,
    description: 'Program operations oversight, process compliance, and administrative execution.',
  },
  {
    id: 'dept-05',
    name: 'Program Coordinator',
    code: 'PC',
    is_active: true,
    description: 'Day-to-day coordination, schedule adherence, and active program logistics.',
  },
  {
    id: 'dept-06',
    name: 'Technology',
    code: 'TECH',
    is_active: true,
    description: 'Software development, systems architecture, cloud infrastructure, and security.',
  },
  {
    id: 'dept-07',
    name: 'Revenue',
    code: 'REV',
    is_active: true,
    description: 'Business development, commercial monetization, and revenue operations.',
  },
  {
    id: 'dept-08',
    name: 'Property Services Division',
    code: 'PSD',
    is_active: true,
    description: 'Property portfolio management, facilities maintenance, and asset oversight.',
  },
  {
    id: 'dept-09',
    name: 'REA Careers',
    code: 'REA',
    is_active: true,
    description: 'Talent recruitment, career pathing, and specialized recruitment advisory.',
  },
  {
    id: 'dept-10',
    name: 'Graphics & Design',
    code: 'GND',
    is_active: true,
    description: 'Visual branding, UI/UX creative design, marketing assets, and multimedia.',
  },
  {
    id: 'dept-11',
    name: 'Audit',
    code: 'AUD',
    is_active: true,
    description: 'Financial controls, operational audits, compliance reviews, and risk verification.',
  },
  {
    id: 'dept-12',
    name: 'Admin & Support',
    code: 'AS',
    is_active: true,
    description: 'Internal HR administrative services, office operations, and employee support desk.',
  },
  {
    id: 'dept-13',
    name: 'WRW',
    code: 'WRW',
    is_active: true,
    description: 'Workplace resources, wellbeing programs, and workforce facilities management.',
  },
];

// ==========================================
// 2. LEAVE TYPE MASTER DATA
// ==========================================

export type LeaveType =
  | 'Vacation Leave'
  | 'Sick Leave'
  | 'Emergency Leave'
  | 'Medical Leave'
  | 'Unpaid Leave'
  | 'Holiday Shift Credit';

export interface LeaveTypeConfig {
  id: string;
  name: LeaveType;
  code: string;
  is_paid: boolean;
  deducts_from_balance: boolean;
  default_allocation_days: number;
  is_active: boolean;
  description: string;
  badgeClass: string;
  colorClass: string;
  requires_attachment?: boolean;
}

/**
 * Official Company Leave Types (5 Total)
 * Strictly enforced across leave requests, balances, ledger, and approvals.
 */
export const OFFICIAL_LEAVE_TYPES: readonly LeaveType[] = [
  'Vacation Leave',
  'Sick Leave',
  'Emergency Leave',
  'Medical Leave',
  'Unpaid Leave',
] as const;

export const LEAVE_TYPE_MASTER_DATA: LeaveTypeConfig[] = [
  {
    id: 'lt-vl',
    name: 'Vacation Leave',
    code: 'VL',
    is_paid: true,
    deducts_from_balance: true,
    default_allocation_days: 15,
    is_active: true,
    description: 'Planned vacation and annual personal time off for rest and recreation.',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    colorClass: 'bg-emerald-500',
  },
  {
    id: 'lt-sl',
    name: 'Sick Leave',
    code: 'SL',
    is_paid: true,
    deducts_from_balance: true,
    default_allocation_days: 10,
    is_active: true,
    description: 'Absence due to personal illness, medical consultation, or dental treatment.',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80',
    colorClass: 'bg-rose-500',
  },
  {
    id: 'lt-el',
    name: 'Emergency Leave',
    code: 'EL',
    is_paid: true,
    deducts_from_balance: true,
    default_allocation_days: 5,
    is_active: true,
    description: 'Urgent unplanned circumstances, critical family emergencies, or natural disasters.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    colorClass: 'bg-amber-500',
  },
  {
    id: 'lt-ml',
    name: 'Medical Leave',
    code: 'ML',
    is_paid: true,
    deducts_from_balance: true,
    default_allocation_days: 15,
    is_active: true,
    description: 'Prolonged illness, surgery, hospitalization, or physician-mandated recuperation.',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
    colorClass: 'bg-indigo-500',
  },
  {
    id: 'lt-ul',
    name: 'Unpaid Leave',
    code: 'UL',
    is_paid: false,
    deducts_from_balance: false,
    default_allocation_days: 0,
    is_active: true,
    description: 'Authorized absence without salary compensation. Does NOT deduct from paid balances.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    colorClass: 'bg-slate-500',
  },
];

export const LEAVE_TYPE_CONFIGS: Record<LeaveType, LeaveTypeConfig> = {
  'Vacation Leave': LEAVE_TYPE_MASTER_DATA[0],
  'Sick Leave': LEAVE_TYPE_MASTER_DATA[1],
  'Emergency Leave': LEAVE_TYPE_MASTER_DATA[2],
  'Medical Leave': LEAVE_TYPE_MASTER_DATA[3],
  'Unpaid Leave': LEAVE_TYPE_MASTER_DATA[4],
  'Holiday Shift Credit': {
    id: 'lt-hsc',
    name: 'Holiday Shift Credit',
    code: 'HSC',
    is_paid: true,
    deducts_from_balance: true,
    default_allocation_days: 0,
    is_active: true,
    description: 'Compensatory leave credit earned from approved holiday shifts worked.',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
    colorClass: 'bg-amber-500',
  },
};

// ==========================================
// 3. MASTER DATA HELPER UTILITIES
// ==========================================

export function getLeaveTypeConfig(type: LeaveType | string): LeaveTypeConfig {
  if (type in LEAVE_TYPE_CONFIGS) {
    return LEAVE_TYPE_CONFIGS[type as LeaveType];
  }
  // Safe fallback to Vacation Leave
  return LEAVE_TYPE_CONFIGS['Vacation Leave'];
}

export function isPaidLeaveType(type: LeaveType | string): boolean {
  return type !== 'Unpaid Leave';
}

export function getActiveDepartments(): DepartmentItem[] {
  return DEPARTMENT_MASTER_DATA.filter((d) => d.is_active);
}

export function getActiveLeaveTypes(): LeaveTypeConfig[] {
  return LEAVE_TYPE_MASTER_DATA.filter((lt) => lt.is_active);
}
