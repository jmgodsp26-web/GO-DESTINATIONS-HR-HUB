import React, { useState, useEffect, useCallback } from 'react';
import { AuditLog } from '../../types';
import { api } from '../../services/api';
import {
  FileText,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserPlus,
  Sliders,
  CalendarDays,
  Clock,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load audit logs:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = actionFilter === 'All' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('approved')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('rejected') || action.includes('disabled') || action.includes('deleted')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (action.includes('created')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              HR activity
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Activity Log</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            See who changed employee records, reviewed leave, or updated HR settings.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by person, action, or details..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500"
        >
          <option value="All">All Actions</option>
          <option value="Signed in">Signed In</option>
          <option value="Sign-in failed">Sign-In Failed</option>
          <option value="Leave approved">Leave Approved</option>
          <option value="Leave rejected">Leave Rejected</option>
          <option value="Employee created">Employee Created</option>
          <option value="Employee updated">Employee Updated</option>
          <option value="Employee disabled">Employee Disabled</option>
          <option value="Leave balance changed">Balance Changed</option>
          <option value="Holiday created">Holiday Created</option>
        </select>
      </div>

      {/* Audit Log Entries */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No audit records found matching the query.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[12px] font-bold border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        by {log.user_name}
                      </span>
                      <span className="text-[12px] text-slate-400 font-mono">
                        ({log.user_role})
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      {log.details}
                    </p>

                    <div className="text-[12px] text-slate-400 font-mono">
                      Target Ref: {log.target_type} • ID: {log.target_id}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-xs text-slate-500 font-medium">{dateStr}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
