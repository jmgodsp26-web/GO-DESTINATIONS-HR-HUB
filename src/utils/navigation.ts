import type { NotificationItem, UserRole } from '../types';
import { navigateWorkspace, type WorkspaceMode } from './workspace';
export type WorkspaceRoute = { mode: WorkspaceMode; tab: string; query: string };
export function resolveRoute(role: UserRole, mode: WorkspaceMode, value: string): WorkspaceRoute {
  const [path, raw = ''] = value.replace(/^#?\/?/, '').split('?');
  const parts = path.split('/');
  const explicit = parts[0] === 'personal' || parts[0] === 'administration';
  const target = navigateWorkspace(role, explicit ? parts[0] as WorkspaceMode : mode, explicit ? parts[1] || '' : path);
  const query = new URLSearchParams();
  new URLSearchParams(raw).forEach((v, k) => { if (['id', 'request', 'employee', 'status'].includes(k) && v.length <= 180) query.set(k, v); });
  return { ...target, query: query.toString() };
}
export const routeHash = (r: WorkspaceRoute) => `#/${r.mode}/${r.tab}${r.query ? '?' + r.query : ''}`;
export function notificationDestination(n: NotificationItem) {
  if (n.announcement_id) return `personal/announcements?id=${encodeURIComponent(n.announcement_id)}`;
  if (n.request_id) return `${n.link_tab || 'leave'}?request=${encodeURIComponent(n.request_id)}`;
  return n.link_tab || 'notifications';
}
