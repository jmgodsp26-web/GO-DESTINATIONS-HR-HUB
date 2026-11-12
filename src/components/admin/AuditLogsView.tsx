import { easternDate } from '../../utils/easternTime';
import { LoadError } from '../common/LoadFeedback';
import { PageHeading } from '../common/WorkspaceUI';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuditLog } from '../../types';
import { api } from '../../services/api';
import { auditTone, groupAuditLogs } from '../../utils/auditDisplay';
import { formatStamp } from '../../utils/brandDisplay';
import {
  Activity,
  CalendarDays,
  CalendarX,
  CheckCircle2,
  ClipboardList,
  FileText,
  KeyRound,
  LogIn,
  Megaphone,
  RefreshCw,
  Scale,
  Search,
  Settings,
  ShieldAlert,
  UserCog,
  UserPlus,
  UserX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

const PAGE_SIZE = 60;

const TONE_ICON: Record<ReturnType<typeof auditTone>['icon'], LucideIcon> = {
  signin: LogIn, signinFailed: ShieldAlert, password: KeyRound, approved: CheckCircle2, rejected: XCircle, cancelled: CalendarX,
  employeeCreated: UserPlus, employeeUpdated: UserCog, employeeRemoved: UserX, balance: Scale, holiday: CalendarDays,
  announcement: Megaphone, document: FileText, settings: Settings, onboarding: ClipboardList, other: Activity,
};

const targetLabel = (type: string) => { const text = String(type || 'record').replace(/_/g, ' '); return text.charAt(0).toUpperCase() + text.slice(1); };

const timeOnly = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setLogs(await api.getAuditLogs());
      setLoaded(true);
    } catch (err: any) {
      setError(err?.message || 'Could not load the activity log.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => setShown(PAGE_SIZE), [searchQuery, actionFilter]);

  const actions = useMemo(() => [...new Set(logs.map(log => log.action))].sort((a, b) => a.localeCompare(b)), [logs]);
  const query = searchQuery.trim().toLowerCase();
  const filteredLogs = useMemo(() => logs.filter((log) => {
    const matchesSearch = !query || [log.user_name, log.details, log.action].some(value => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (actionFilter === 'All' || log.action === actionFilter);
  }), [logs, query, actionFilter]);
  const groups = useMemo(() => groupAuditLogs(filteredLogs.slice(0, shown), easternDate()), [filteredLogs, shown]);

  return (
    <div className="go-activity space-y-6 max-w-5xl mx-auto">
      <div className="go-page-header">
        <PageHeading
          eyebrow="Administration"
          title="Activity Log"
          description="See changes to employee records, leave requests, and HR settings."
          badge={loaded ? <span className="go-heading-badge">{logs.length} {logs.length === 1 ? 'event' : 'events'}</span> : undefined}
        />
        <button type="button" onClick={loadLogs} disabled={isLoading}><RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>
      </div>

      {error && <LoadError message={loaded ? 'Could not refresh. The activity below may be out of date.' : error} onRetry={loadLogs} />}

      <div className="go-surface go-activity-filters">
        <label className="go-activity-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search activity</span>
          <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by person, action, or details…" />
        </label>
        <label className="go-activity-action">
          <span className="sr-only">Filter by action</span>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="All">All actions</option>
            {actions.map(action => <option key={action} value={action}>{action}</option>)}
          </select>
        </label>
      </div>

      {!loaded ? (
        !error && <p className="go-refresh-status" role="status">Loading activity…</p>
      ) : filteredLogs.length === 0 ? (
        <div className="go-surface go-activity-empty">
          <Activity size={28} aria-hidden="true" />
          <p><strong>No activity found</strong>{query || actionFilter !== 'All' ? 'Nothing matches this search or action. Try clearing the filters.' : 'Changes to records, leave and settings will appear here.'}</p>
        </div>
      ) : (
        <>
          {groups.map(group => (
            <section key={group.date} className="go-surface go-activity-day" aria-labelledby={`activity-${group.date}`}>
              <header>
                <h2 id={`activity-${group.date}`}>{group.label}</h2>
                <span>{group.items.length} {group.items.length === 1 ? 'event' : 'events'}</span>
              </header>
              <ol className="go-activity-list">
                {group.items.map(log => {
                  const tone = auditTone(log.action);
                  const Icon = TONE_ICON[tone.icon];
                  const at = new Date(log.timestamp);
                  return (
                    <li key={log.id} className={`go-activity-item is-${tone.color}`}>
                      <span className="go-activity-icon" aria-hidden="true"><Icon size={17} /></span>
                      <div className="go-activity-copy">
                        <p className="go-activity-line">
                          <strong>{log.action}</strong>
                          <span>by {log.user_name || 'System'}</span>
                          {log.user_role && <span className="go-chip">{log.user_role === 'admin' ? 'HR admin' : 'Employee'}</span>}
                        </p>
                        {log.details && <p className="go-activity-details">{log.details}</p>}
                        <p className="go-activity-meta">
                          <time dateTime={log.timestamp} title={formatStamp(log.timestamp, true)}>{Number.isFinite(at.getTime()) ? timeOnly.format(at) : ''}</time>
                          {log.target_id && <span title={`${log.target_type} ${log.target_id}`}>{targetLabel(log.target_type)} · {log.target_id}</span>}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {filteredLogs.length > shown && (
            <div className="go-activity-more">
              <p>Showing {shown} of {filteredLogs.length} events</p>
              <button type="button" className="go-button go-button-secondary" onClick={() => setShown(count => count + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, filteredLogs.length - shown)} more</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
