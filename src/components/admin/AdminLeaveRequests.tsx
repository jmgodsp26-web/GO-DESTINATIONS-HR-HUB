import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveRequest, UserProfile, LeaveBalance, LeaveType, LEAVE_TYPE_MASTER_DATA } from '../../types';
import { api } from '../../services/api';
import {
  ClipboardList,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Paperclip,
  Check,
  X,
  AlertCircle,
  FileText,
  User,
  Calendar,
  ChevronDown,
  Info,
  RotateCcw,
} from 'lucide-react';

export const AdminLeaveRequests: React.FC = () => {
  const { user: adminUser } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<(UserProfile & { leave_balances: LeaveBalance[] })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'Approved' | 'Rejected'>('Approved');
  const [adminNote, setAdminNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Batch Selection State
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [reqRes, empRes] = await Promise.all([
        api.getLeaveRequests({
          status: statusFilter !== 'All' ? statusFilter : undefined,
          employee: employeeFilter || undefined,
          leave_type: typeFilter !== 'All' ? typeFilter : undefined,
          date: dateFilter || undefined,
        }),
        api.getAllEmployees(),
      ]);
      setRequests(reqRes);
      setEmployees(empRes);
    } catch (err: any) {
      if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
        console.error('Failed to load leave requests:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, employeeFilter, typeFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenReview = (req: LeaveRequest, action: 'Approved' | 'Rejected') => {
    setSelectedRequest(req);
    setReviewAction(action);
    setAdminNote('');
    setActionError(null);
  };

  const handleProcessReview = async () => {
    if (!selectedRequest) return;
    setIsSubmitting(true);
    setActionError(null);

    try {
      await api.reviewLeaveRequest(selectedRequest.id, reviewAction, adminNote.trim() || undefined);
      showToast({
        type: reviewAction === 'Approved' ? 'success' : 'info',
        title: `Request ${reviewAction}`,
        message: `${selectedRequest.employee_name}'s ${selectedRequest.leave_type} request was ${reviewAction.toLowerCase()}.`,
      });
      setSelectedRequest(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to process request review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setStatusFilter('All');
    setEmployeeFilter('');
    setTypeFilter('All');
    setDateFilter('');
    setSelectedRequestIds([]);
  };

  const pendingVisibleRequests = requests.filter((r) => r.status === 'Pending');
  const isAllPendingSelected =
    pendingVisibleRequests.length > 0 &&
    pendingVisibleRequests.every((r) => selectedRequestIds.includes(r.id));

  const toggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(pendingVisibleRequests.map((r) => r.id));
    }
  };

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchAction = async (action: 'Approved' | 'Rejected') => {
    if (selectedRequestIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      await Promise.all(
        selectedRequestIds.map((id) =>
          api.reviewLeaveRequest(
            id,
            action,
            `Bulk ${action.toLowerCase()} by HR administrator`
          )
        )
      );
      showToast({
        type: action === 'Approved' ? 'success' : 'info',
        title: `Batch ${action} Completed`,
        message: `Successfully processed ${selectedRequestIds.length} leave request(s) as ${action.toLowerCase()}.`,
      });
      setSelectedRequestIds([]);
      await loadData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Batch Action Failed',
        message: err.message || `Failed to process selected requests.`,
      });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leave Requests</h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
                {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Filter, review, approve, or reject employee leave applications across the company.
          </p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Status */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending Only</option>
              <option value="Approved">Approved Only</option>
              <option value="Rejected">Rejected Only</option>
            </select>
          </div>

          {/* 2. Employee */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Employee</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>

          {/* 3. Leave Type */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Leave Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            >
              <option value="All">All Types</option>
              {LEAVE_TYPE_MASTER_DATA.map((lt) => (
                <option key={lt.id} value={lt.name}>
                  {lt.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Active on Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Active on Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>
        </div>

        {(statusFilter !== 'All' || employeeFilter || typeFilter !== 'All' || dateFilter) && (
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Filtering {requests.length} total request(s)</span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-[#3A5D83] hover:text-[#182E3F] flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Requests Container (Desktop Table + Mobile Cards) */}
      <div className="go-surface bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Batch Actions Banner */}
        {selectedRequestIds.length > 0 && (
          <div className="bg-[#3A5D83]/10 border-b border-[#3A5D83]/20 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-[#3A5D83] text-white flex items-center justify-center font-bold text-xs">
                {selectedRequestIds.length}
              </span>
              <span className="font-semibold text-slate-800">
                {selectedRequestIds.length} pending leave {selectedRequestIds.length === 1 ? 'request' : 'requests'} selected
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => handleBatchAction('Approved')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Selected ({selectedRequestIds.length})</span>
              </button>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => handleBatchAction('Rejected')}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-semibold flex items-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject Selected ({selectedRequestIds.length})</span>
              </button>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => setSelectedRequestIds([])}
                className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No leave requests found</p>
            <p className="text-slate-400 text-xs mt-0.5">Try changing or clearing your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={isAllPendingSelected}
                        onChange={toggleSelectAll}
                        disabled={pendingVisibleRequests.length === 0}
                        title={
                          pendingVisibleRequests.length === 0
                            ? 'No pending requests to select'
                            : isAllPendingSelected
                            ? 'Deselect all pending requests'
                            : 'Select all pending requests'
                        }
                        className="w-4 h-4 rounded border-slate-300 text-[#3A5D83] focus:ring-[#3A5D83] cursor-pointer disabled:opacity-40"
                      />
                    </th>
                    <th className="px-5 py-3.5 font-semibold">Employee</th>
                    <th className="px-5 py-3.5 font-semibold">Leave Type</th>
                    <th className="px-5 py-3.5 font-semibold">Dates</th>
                    <th className="px-5 py-3.5 text-center font-semibold">Days</th>
                    <th className="px-5 py-3.5 font-semibold">Reason &amp; Attachments</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req) => {
                    const statusClass =
                      req.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : req.status === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : 'bg-amber-50 text-amber-700 border-amber-200/80';
                    const isPending = req.status === 'Pending';
                    const isSelected = selectedRequestIds.includes(req.id);

                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <td className="w-10 px-4 py-3.5 text-center">
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRequest(req.id)}
                              className="w-4 h-4 rounded border-slate-300 text-[#3A5D83] focus:ring-[#3A5D83] cursor-pointer"
                            />
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        {/* Employee */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            {req.employee_avatar && req.employee_avatar.trim() ? (
                              <img
                                src={req.employee_avatar}
                                alt={req.employee_name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">
                                {req.employee_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'HR'}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900">{req.employee_name}</p>
                              <p className="text-[11px] text-slate-500">{req.employee_department}</p>
                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                          <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md text-[11px]">
                            {req.leave_type}
                          </span>
                        </td>

                        {/* Dates */}
                        <td className="px-5 py-3.5 text-slate-700 font-medium">
                          <div className="tabular-nums">
                            {req.start_date === req.end_date
                              ? req.start_date
                              : `${req.start_date} → ${req.end_date}`}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Submitted: {new Date(req.submitted_at).toLocaleDateString()}
                          </div>
                        </td>

                        {/* Duration */}
                        <td className="px-5 py-3.5 text-center">
                          {req.is_half_day ? (
                            <span className="inline-flex items-center space-x-1 font-bold text-amber-900 bg-amber-100/90 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                              <span>0.5 day</span>
                              <span className="text-[10px] text-amber-700 uppercase font-semibold">({req.half_day_period === 'morning' ? 'AM' : 'PM'})</span>
                            </span>
                          ) : (
                            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] tabular-nums">
                              {req.total_days} {req.total_days === 1 ? 'day' : 'days'}
                            </span>
                          )}
                        </td>

                        {/* Reason & Attachments */}
                        <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                          <p className="truncate font-medium text-slate-800">&ldquo;{req.reason}&rdquo;</p>
                          {req.attachment_name && (
                            <div className="flex items-center space-x-1 text-[11px] text-indigo-600 mt-0.5">
                              <Paperclip className="w-3 h-3" />
                              <span className="truncate">{req.attachment_name}</span>
                            </div>
                          )}
                          {req.admin_note && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                              HR: &ldquo;{req.admin_note}&rdquo;
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusClass}`}>
                            {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {req.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                            {req.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                            {req.status}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {req.status === 'Pending' ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenReview(req, 'Approved')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReview(req, 'Rejected')}
                                className="px-3 py-1.5 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              Reviewed by {req.reviewed_by_name?.split(' ')[0] || 'Admin'}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Stack */}
            <div className="md:hidden divide-y divide-slate-100">
              {requests.map((req) => {
                const statusClass =
                  req.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : req.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                    : 'bg-amber-50 text-amber-700 border-amber-200/80';

                return (
                  <div key={req.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        {req.employee_avatar && req.employee_avatar.trim() ? (
                          <img
                            src={req.employee_avatar}
                            alt={req.employee_name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">
                            {req.employee_name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'HR'}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{req.employee_name}</p>
                          <p className="text-xs text-slate-500">{req.employee_department}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {req.status === 'Pending' && (
                          <input
                            type="checkbox"
                            checked={selectedRequestIds.includes(req.id)}
                            onChange={() => toggleSelectRequest(req.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#3A5D83] focus:ring-[#3A5D83] cursor-pointer"
                          />
                        )}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusClass}`}>
                          {req.status}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-700">{req.leave_type}</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {req.is_half_day ? '0.5 day' : `${req.total_days} days`}
                        </span>
                      </div>
                      <div className="text-slate-600 tabular-nums">
                        {req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`}
                      </div>
                      <p className="text-slate-500 italic mt-1">&ldquo;{req.reason}&rdquo;</p>
                      {req.attachment_name && (
                        <div className="flex items-center space-x-1 text-[11px] text-indigo-600 pt-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{req.attachment_name}</span>
                        </div>
                      )}
                    </div>

                    {req.status === 'Pending' ? (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(req, 'Approved')}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1 min-h-[40px]"
                        >
                          <Check className="w-4 h-4" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReview(req, 'Rejected')}
                          className="w-full py-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1 min-h-[40px]"
                        >
                          <X className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 text-right">
                        Reviewed by {req.reviewed_by_name?.split(' ')[0] || 'Admin'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-sm font-bold text-slate-900">
                {reviewAction === 'Approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">{selectedRequest.employee_name}</span>
                  <span className="text-slate-500 font-mono text-[11px]">{selectedRequest.employee_department}</span>
                </div>
                <p className="text-slate-700">
                  <strong>{selectedRequest.leave_type}</strong>:{' '}
                  {selectedRequest.is_half_day
                    ? `${selectedRequest.start_date} (${selectedRequest.half_day_period === 'morning' ? 'Morning 9AM–1PM' : 'Afternoon 1PM–5PM'})`
                    : `${selectedRequest.start_date} to ${selectedRequest.end_date}`}{' '}
                  (
                  <strong className="text-slate-900 tabular-nums">
                    {selectedRequest.total_days} day(s) {selectedRequest.is_half_day ? 'Half-Day' : ''}
                  </strong>
                  )
                </p>
                <p className="text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                  &ldquo;{selectedRequest.reason}&rdquo;
                </p>
                {selectedRequest.attachment_name && (
                  <div className="flex items-center space-x-1.5 text-indigo-600 pt-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Attached Document: {selectedRequest.attachment_name}</span>
                    {selectedRequest.attachment_url?.startsWith('/api/leave-attachments/') ? <a href={selectedRequest.attachment_url} className="underline font-semibold">Download</a> : <span className="text-slate-500">File not available</span>}
                  </div>
                )}
              </div>

              {reviewAction === 'Approved' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                  <p className="font-semibold">Confirming Approval</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    {selectedRequest.total_days} day(s) will automatically be deducted from {selectedRequest.employee_name}&rsquo;s {selectedRequest.leave_type} balance.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
                  <p className="font-semibold">Confirming Rejection</p>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    No balance will be deducted. Please provide an optional explanation below.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {reviewAction === 'Approved' ? 'Optional Note for Employee' : 'Reason for Rejection'}
                </label>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    reviewAction === 'Approved'
                      ? 'e.g. Approved. Enjoy your time off!'
                      : 'e.g. Team coverage constraints for this sprint milestone.'
                  }
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessReview}
                disabled={isSubmitting}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors shadow-2xs ${
                  reviewAction === 'Approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting
                  ? 'Saving...'
                  : reviewAction === 'Approved'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
