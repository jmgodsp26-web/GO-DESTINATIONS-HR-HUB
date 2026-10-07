import { csvRow } from '../../utils/csv';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import {
  LeaveRequest,
  UserProfile,
  LeaveBalance,
  LeaveType,
  OFFICIAL_DEPARTMENTS,
  LEAVE_TYPE_MASTER_DATA,
  getLeaveTypeConfig,
} from '../../types';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  Sparkles,
  PieChart,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<(UserProfile & { leave_balances: LeaveBalance[] })[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<string>('2026-YTD');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqData, empData] = await Promise.all([
        api.getLeaveRequests(),
        api.getAllEmployees(),
      ]);
      setRequests(reqData);
      setEmployees(empData);
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load report data:', err);
        showToast({
          type: 'error',
          title: 'Error Loading Reports',
          message: err.message || 'Could not fetch leave analytics.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Standardized official company departments
  const departments = useMemo(() => {
    return OFFICIAL_DEPARTMENTS;
  }, []);

  // Filter requests based on time range and department
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Department filter
      if (departmentFilter !== 'All' && r.employee_department !== departmentFilter) {
        return false;
      }
      // Time range filter
      if (timeRange === '2026-YTD') {
        return r.start_date.startsWith('2026');
      } else if (timeRange === 'Q1-2026') {
        return r.start_date >= '2026-01-01' && r.start_date <= '2026-03-31';
      } else if (timeRange === 'Q2-2026') {
        return r.start_date >= '2026-04-01' && r.start_date <= '2026-06-30';
      } else if (timeRange === 'Q3-2026') {
        return r.start_date >= '2026-07-01' && r.start_date <= '2026-09-30';
      }
      return true;
    });
  }, [requests, departmentFilter, timeRange]);

  const approvedRequests = useMemo(
    () => filteredRequests.filter((r) => r.status === 'Approved'),
    [filteredRequests]
  );
  const pendingRequests = useMemo(
    () => filteredRequests.filter((r) => r.status === 'Pending'),
    [filteredRequests]
  );
  const rejectedRequests = useMemo(
    () => filteredRequests.filter((r) => r.status === 'Rejected'),
    [filteredRequests]
  );

  const totalApprovedDays = useMemo(() => {
    return approvedRequests.reduce((sum, r) => sum + (r.total_days || 0), 0);
  }, [approvedRequests]);

  const totalPendingDays = useMemo(() => {
    return pendingRequests.reduce((sum, r) => sum + (r.total_days || 0), 0);
  }, [pendingRequests]);

  // Leave Type Breakdown
  const leaveTypeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    approvedRequests.forEach((r) => {
      counts[r.leave_type] = (counts[r.leave_type] || 0) + (r.total_days || 0);
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts).map(([type, days]) => ({
      type,
      days,
      percentage: Math.round((days / total) * 100),
    })).sort((a, b) => b.days - a.days);
  }, [approvedRequests]);

  // Department Statistics
  const departmentStats = useMemo(() => {
    const map: Record<
      string,
      { totalStaff: number; approvedDays: number; pendingCount: number }
    > = {};

    // Pre-populate with official departments
    OFFICIAL_DEPARTMENTS.forEach((dept) => {
      map[dept] = { totalStaff: 0, approvedDays: 0, pendingCount: 0 };
    });

    employees.forEach((emp) => {
      const dept = emp.department || 'Other';
      if (!map[dept]) {
        map[dept] = { totalStaff: 0, approvedDays: 0, pendingCount: 0 };
      }
      map[dept].totalStaff += 1;
    });

    approvedRequests.forEach((r) => {
      const dept = r.employee_department || 'Other';
      if (map[dept]) {
        map[dept].approvedDays += r.total_days || 0;
      }
    });

    pendingRequests.forEach((r) => {
      const dept = r.employee_department || 'Other';
      if (map[dept]) {
        map[dept].pendingCount += 1;
      }
    });

    const maxDays = Math.max(...Object.values(map).map((m) => m.approvedDays), 1);

    return Object.entries(map)
      .map(([dept, data]) => ({
        department: dept,
        totalStaff: data.totalStaff,
        approvedDays: data.approvedDays,
        pendingCount: data.pendingCount,
        avgPerStaff: (data.approvedDays / (data.totalStaff || 1)).toFixed(1),
        barWidthPercent: Math.min(100, Math.round((data.approvedDays / maxDays) * 100)),
      }))
      .filter((dept) => dept.totalStaff > 0 || dept.approvedDays > 0 || dept.pendingCount > 0)
      .sort((a, b) => b.approvedDays - a.approvedDays || a.department.localeCompare(b.department));
  }, [employees, approvedRequests, pendingRequests]);

  // Generate and trigger real CSV export
  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Request ID',
        'Employee ID',
        'Employee Name',
        'Department',
        'Leave Type',
        'Start Date',
        'End Date',
        'Days Count',
        'Is Half Day',
        'Reason',
        'Status',
        'Submitted At',
        'Admin Note',
      ];

      const rows = filteredRequests.map(r => [r.id, r.employee_id, r.employee_name, r.employee_department, r.leave_type, r.start_date, r.end_date, r.total_days, r.is_half_day ? 'Yes' : 'No', r.reason, r.status, r.submitted_at, r.admin_note]);
      const csvContent = [headers, ...rows].map(csvRow).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `HR_Hub_Leave_Report_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast({
        type: 'success',
        title: 'Report Exported',
        message: `Successfully downloaded CSV report with ${filteredRequests.length} leave records.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message || 'Could not generate CSV file.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Reports &amp; Analytics
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Leave utilization, department absence distribution, and exportable HR compliance data.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting || isLoading || filteredRequests.length === 0}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Generating CSV...' : 'Export to CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Timeframe:</span>
            </div>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="2026-YTD">2026 Year-to-Date</option>
              <option value="Q3-2026">Q3 2026 (Jul - Sep)</option>
              <option value="Q2-2026">Q2 2026 (Apr - Jun)</option>
              <option value="Q1-2026">Q1 2026 (Jan - Mar)</option>
              <option value="ALL">All Available Time</option>
            </select>

            <div className="flex items-center space-x-1.5 text-slate-600 font-medium ml-0 sm:ml-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Department:</span>
            </div>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="text-slate-500 text-[11px] font-normal">
            Matching records: <span className="font-semibold text-slate-800">{filteredRequests.length}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Approved Leave</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {totalApprovedDays}
            </span>
            <span className="text-xs font-semibold text-slate-500">days taken</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {approvedRequests.length} approved applications</p>
        </div>

        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Review</span>
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold text-amber-600 tabular-nums">
              {pendingRequests.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">requests</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{totalPendingDays} days currently awaiting sign-off</p>
        </div>

        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workforce Size</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {employees.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">team members</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {departments.length} functional operational divisions
          </p>
        </div>

        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Absence Rate</span>
            <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
              {(totalApprovedDays / (employees.length || 1)).toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">days/staff</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Average leave consumed per employee</p>
        </div>
      </div>

      {/* Main Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Utilization Breakdown */}
        <div className="lg:col-span-2 go-surface bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Department Leave Utilization</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of approved leave days and pending load by division
              </p>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
              {departmentStats.length} departments
            </span>
          </div>

          <div className="space-y-4">
            {departmentStats.map((dept) => (
              <div key={dept.department} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800">{dept.department}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-medium">
                      {dept.totalStaff} staff
                    </span>
                    {dept.pendingCount > 0 && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-medium">
                        {dept.pendingCount} pending
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 tabular-nums">{dept.approvedDays}</span>{' '}
                    <span className="text-slate-500">days ({dept.avgPerStaff}d / person)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${dept.barWidthPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Type Distribution */}
        <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Leave Type Share</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ratio of categories approved</p>
            </div>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>

          {leaveTypeStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No approved leaves in selected timeframe.
            </div>
          ) : (
            <div className="space-y-3.5">
              {leaveTypeStats.map((item) => {
                const getBadgeColor = (type: string) => {
                  switch (type) {
                    case 'Vacation Leave':
                      return 'bg-indigo-500 text-white';
                    case 'Sick Leave':
                      return 'bg-rose-500 text-white';
                    case 'Emergency Leave':
                      return 'bg-amber-500 text-white';
                    case 'Medical Leave':
                      return 'bg-teal-500 text-white';
                    case 'Unpaid Leave':
                      return 'bg-slate-500 text-white';
                    default:
                      return 'bg-indigo-500 text-white';
                  }
                };

                return (
                  <div key={item.type} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-800">{item.type}</span>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">
                        {item.days} days ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${getBadgeColor(item.type)}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-indigo-900 text-xs flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              Vacation Leave accounts for the largest proportion of planned absences, aligned with standard company time-off pacing.
            </p>
          </div>
        </div>
      </div>

      {/* Filtered Records Summary Table */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Leave Applications Register</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive transaction log for audit and verification
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Showing <strong className="text-slate-800 font-semibold">{filteredRequests.length}</strong> records
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No records found for the chosen filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 px-4">Department</th>
                  <th className="pb-3 px-4">Leave Type</th>
                  <th className="pb-3 px-4">Duration</th>
                  <th className="pb-3 px-4 text-center">Days</th>
                  <th className="pb-3 px-4 text-center">Status</th>
                  <th className="pb-3 pl-4">Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.slice(0, 15).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                      {r.employee_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.employee_department}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          getLeaveTypeConfig(r.leave_type).badgeClass
                        }`}
                      >
                        {r.leave_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap tabular-nums">
                      {r.start_date} → {r.end_date}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-800 tabular-nums">
                      {r.total_days}d
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          r.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : r.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-slate-500 max-w-xs truncate" title={r.reason}>
                      {r.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRequests.length > 15 && (
              <div className="pt-3 text-center text-xs text-slate-400">
                Displaying the first 15 records. Use <strong>Export to CSV</strong> above to download all{' '}
                {filteredRequests.length} rows.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
