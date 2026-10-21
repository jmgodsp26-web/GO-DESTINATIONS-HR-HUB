import { createHash } from 'node:crypto';

// Only reviewed GET handlers use a reduced collection set. New/unknown routes
// retain the full store until their dependencies have been checked.
export const READ_TABLES = {
  '/auth/me': [],
  '/profile': [],
  '/settings': [],
  '/employees': ['leaveBalances'],
  '/leave-balances': ['leaveBalances'],
  '/leave-transactions': ['leaveTransactions'],
  '/leave/transactions': ['leaveTransactions'],
  '/leave-requests': ['leaveRequests'],
  '/holidays': ['holidays'],
  '/holiday-shifts': ['holidayShifts'],
  '/calendar': ['holidays', 'holidayShifts', 'leaveRequests'],
  '/holiday-coverage': ['holidays', 'holidayShifts', 'leaveRequests', 'leaveBalances'],
  '/audit-logs': ['auditLogs'],
  '/documents': ['employeeDocuments'],
  '/my-documents': ['employeeDocuments'],
  '/announcements': ['announcements', 'announcementReceipts'],
  // Reading notifications generates daily reminders: these collections must
  // still be committed atomically, including each task's last_reminded value.
  '/notifications': ['notifications', 'announcements', 'onboardingPlans'],
} as const;

export type ReadTable = 'users' | 'sessions' | typeof READ_TABLES[keyof typeof READ_TABLES][number];
export interface ReadPlan { sessionId: string; tables?: ReadTable[]; }

export function readPlanFor(method: string, pathname: string, token: string): ReadPlan | undefined {
  if (!['GET', 'HEAD'].includes(method) || !token) return undefined;
  const route = pathname.replace(/\/+$/, '').toLowerCase();
  const key = /^\/holiday-coverage\/[^/]+$/.test(route) ? '/holiday-coverage'
    : /^\/documents\/[^/]+\/file$/.test(route) || /^\/admin\/employees\/[^/]+\/documents$/.test(route) ? '/documents'
    : /^\/announcements\/[^/]+\/report$/.test(route) ? '/announcements' : route;
  const dependencies = READ_TABLES[key as keyof typeof READ_TABLES];
  return {
    sessionId: createHash('sha256').update(token).digest('hex'),
    ...(dependencies ? { tables: ['users', 'sessions', ...dependencies] } : {}),
  };
}
