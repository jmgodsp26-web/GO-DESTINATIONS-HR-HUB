import { createHash } from 'node:crypto';

// Only reviewed GET handlers use a reduced collection set. New/unknown routes
// retain the full store until their dependencies have been checked.
export const READ_TABLES = {
  '/celebrations': ['celebrationPreferences','celebrationReactions'],
  '/dashboard/personal': ['leaveBalances', 'leaveRequests', 'holidays', 'holidayShifts'],
  '/dashboard/administration': ['leaveBalances', 'leaveRequests', 'holidays'],
  '/onboarding/summary': ['onboardingPlans'],
  '/leave-attachments': ['leaveAttachments'],
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
export const sessionIdFor = (token: string) => createHash('sha256').update(token).digest('hex');

export function readPlanFor(method: string, pathname: string, token: string): ReadPlan | undefined {
  if (!['GET', 'HEAD'].includes(method) || !token) return undefined;
  const route = pathname.replace(/\/+$/, '').toLowerCase();
  const key = /^\/holiday-coverage\/[^/]+$/.test(route) ? '/holiday-coverage'
    : /^\/leave-attachments\/[^/]+$/.test(route) ? '/leave-attachments'
    : /^\/documents\/[^/]+\/file$/.test(route) || /^\/admin\/employees\/[^/]+\/documents$/.test(route) ? '/documents'
    : /^\/announcements\/[^/]+\/report$/.test(route) ? '/announcements' : route;
  const dependencies = READ_TABLES[key as keyof typeof READ_TABLES];
  return {
    sessionId: sessionIdFor(token),
    ...(dependencies ? { tables: ['users', 'sessions', ...dependencies] } : {}),
  };
}

// Reviewed business operations still acquire the metadata serialization barrier,
// but do not need unrelated documents, onboarding or announcement collections.
const LEAVE_TABLES = ['users', 'sessions', 'leaveBalances', 'leaveRequests', 'leaveTransactions', 'holidays', 'leaveAttachments', 'auditLogs', 'notifications'] as const;
export function writeTablesFor(method: string, pathname: string) {
  const route = pathname.replace(/\/+$/, '').toLowerCase();
  if ((method === 'POST' && route === '/leave-requests') ||
      (method === 'PATCH' && /^\/leave-requests\/[^/]+\/(review|cancel)$/.test(route)) ||
      (method === 'DELETE' && /^\/leave-requests\/[^/]+$/.test(route))) return [...LEAVE_TABLES];
  if (method === 'PATCH' && route === '/celebrations/visibility') return ['users','sessions','celebrationPreferences'] as const;
  if (method === 'POST' && route === '/celebrations/reaction') return ['users','sessions','celebrationPreferences','celebrationReactions','notifications'] as const;
  if (method === 'POST' && route === '/employees/import') return ['users', 'sessions', 'leaveBalances', 'auditLogs'] as const;
  if (method === 'POST' && route === '/holidays') return ['users', 'sessions', 'holidays', 'auditLogs'] as const;
  if (method === 'PATCH' && /^\/holidays\/[^/]+(?:\/toggle-active)?$/.test(route)) return ['users', 'sessions', 'holidays', 'holidayShifts', 'auditLogs'] as const;
  if ((method === 'POST' && /^\/admin\/employees\/[^/]+\/documents$/.test(route)) ||
      (method === 'DELETE' && /^\/admin\/employees\/[^/]+\/documents\/[^/]+$/.test(route))) return ['users', 'sessions', 'employeeDocuments'] as const;
  if (method === 'PATCH' && route === '/settings') return ['users', 'sessions'] as const;
  return undefined;
}
