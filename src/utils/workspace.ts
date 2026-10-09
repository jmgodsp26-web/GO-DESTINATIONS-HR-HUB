import type { UserRole } from '../types';

export type WorkspaceMode = 'personal' | 'administration';
const adminTabs = new Set(['admin-dashboard', 'employees', 'leave-requests', 'audit-logs', 'reports']);
const personalTabs = new Set(['dashboard', 'profile', 'leave']);
const sharedTabs = new Set(['calendar', 'holidays', 'documents', 'notifications', 'settings']);

export function navigateWorkspace(role: UserRole, mode: WorkspaceMode, target: string): { mode: WorkspaceMode; tab: string } {
  if (target === 'my-workspace' || target === 'employee-dashboard') target = 'dashboard';
  if (target === 'history' || target === 'my-leaves') target = 'leave';
  if (target === 'requests' || target === 'admin-requests') target = role === 'admin' ? 'leave-requests' : 'leave';
  if (adminTabs.has(target)) return role === 'admin' ? { mode: 'administration', tab: target } : { mode: 'personal', tab: target === 'leave-requests' ? 'leave' : 'dashboard' };
  if (personalTabs.has(target)) return { mode: 'personal', tab: target };
  if (sharedTabs.has(target)) return { mode: role === 'admin' ? mode : 'personal', tab: target };
  return role === 'admin' && mode === 'administration' ? {mode, tab: 'admin-dashboard'} : {mode: 'personal', tab: 'dashboard'};
}
