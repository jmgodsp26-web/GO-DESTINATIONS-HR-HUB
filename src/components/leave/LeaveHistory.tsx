import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LeaveBalance, LeaveRequest, LeaveTransaction, LeaveStatus } from '../../types';
import { isPaidLeaveType } from '../../constants/masterData';
import { api } from '../../services/api';
import { LeaveRequestModal } from './LeaveRequestModal';
import { downloadIcsFile, getGoogleCalendarUrl } from '../../utils/calendar';
import {
  CalendarCheck,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  FileText,
  Paperclip,
  Download,
  AlertCircle,
  ChevronRight,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  History,
  X,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export const LeaveHistory: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [transactions, setTransactions] = useState<LeaveTransaction[]>([]);
  const [activeView, setActiveView] = useState<'requests' | 'ledger'>('requests');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [balRes, reqRes, txRes] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaveRequests(),
        api.getLeaveTransactions(),
      ]);
      setBalances(balRes);
      setRequests(reqRes);
      setTransactions(txRes);
    } catch (err) {
      console.error('Failed to load leave history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'All') return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Balances */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leave Management &amp; Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Submit new leave applications, monitor active balances, and view your verified transaction audit trail.
          </p>
        </div>

        <button
          type="button"
          id="leave-history-new-request-btn"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#3A5D83] hover:bg-[#2F4D6D] text-white rounded-xl font-semibold text-xs transition-colors shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Leave Request</span>
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((bal) => {
          const isPaid = isPaidLeaveType(bal.leave_type);
          const remaining = isPaid ? bal.allocated_days - bal.used_days : null;

          return (
            <div
              key={bal.id}
              className="rounded-2xl border p-4 sm:p-5 shadow-xs transition-all bg-white border-slate-200/80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {bal.leave_type}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                    !isPaid
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'text-slate-600 bg-slate-100'
                  }`}
                >
                  {isPaid ? `${bal.allocated_days} days total` : 'Unpaid'}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                    {isPaid ? remaining : bal.used_days}
                  </span>
                  <span className="text-xs text-slate-500 font-medium ml-1.5">
                    {isPaid ? 'days remaining' : 'days taken'}
                  </span>
                </div>
                {isPaid && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{bal.used_days}</span>
                    <span className="text-[11px] text-slate-400 block">days used</span>
                  </div>
                )}
                {!isPaid && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded">
                      No paid quota deduction
                    </span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {isPaid && (
                <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-300 bg-indigo-600"
                    style={{
                      width: `${Math.min(100, Math.round((bal.used_days / (bal.allocated_days || 1)) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Main Card with View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Nav Header Switcher */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-100/80">
            <button
              type="button"
              id="view-tab-requests"
              onClick={() => setActiveView('requests')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeView === 'requests'
                  ? 'bg-white text-[#3A5D83] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>Leave Applications ({requests.length})</span>
            </button>
            <button
              type="button"
              id="view-tab-ledger"
              onClick={() => setActiveView('ledger')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 ${
                activeView === 'ledger'
                  ? 'bg-white text-[#3A5D83] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Transaction Ledger ({transactions.length})</span>
            </button>
          </div>

          {activeView === 'requests' && (
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">Filter:</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white">
                {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      statusFilter === status
                        ? 'bg-[#3A5D83] text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* View 1: Leave Requests */}
        {activeView === 'requests' && (
          <div>
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No leave requests match the selected status filter.
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80">
                      <tr>
                        <th className="px-5 py-3.5">Leave Type</th>
                        <th className="px-5 py-3.5">Dates</th>
                        <th className="px-5 py-3.5 text-center">Duration</th>
                        <th className="px-5 py-3.5">Reason</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRequests.map((req) => {
                        const statusClass =
                          req.status === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : req.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                            : 'bg-amber-50 text-amber-700 border-amber-200/80';

                        return (
                          <tr
                            key={req.id}
                            onClick={() => setSelectedRequest(req)}
                            className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-900">{req.leave_type}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Submitted: {new Date(req.submitted_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-slate-700 font-medium tabular-nums">
                              {req.start_date === req.end_date
                                ? req.start_date
                                : `${req.start_date} → ${req.end_date}`}
                            </td>
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
                            <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                              <div className="truncate font-medium text-slate-800">&ldquo;{req.reason}&rdquo;</div>
                              {req.attachment_name && (
                                <div className="flex items-center space-x-1 text-[11px] text-indigo-600 mt-0.5">
                                  <Paperclip className="w-3 h-3" />
                                  <span className="truncate">{req.attachment_name}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusClass}`}>
                                {req.status === 'Approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                {req.status === 'Rejected' && <XCircle className="w-3 h-3 mr-1" />}
                                {req.status === 'Pending' && <Clock className="w-3 h-3 mr-1" />}
                                {req.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              {req.status === 'Approved' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadIcsFile({
                                      title: `Out of Office - ${req.leave_type}`,
                                      startDate: req.start_date,
                                      endDate: req.end_date,
                                      description: req.reason,
                                      isHalfDay: req.is_half_day,
                                      halfDayPeriod: req.half_day_period,
                                      employeeName: user.full_name,
                                    });
                                  }}
                                  title="Export .ics calendar file"
                                  className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-[#3A5D83] bg-indigo-50/70 hover:bg-indigo-100/80 rounded-md mr-1.5 transition-colors"
                                >
                                  <Calendar className="w-3 h-3" />
                                  <span className="hidden xl:inline">.ics</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className="text-slate-400 hover:text-indigo-600 p-1 rounded-md"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Stack View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredRequests.map((req) => {
                    const statusClass =
                      req.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : req.status === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : 'bg-amber-50 text-amber-700 border-amber-200/80';

                    return (
                      <div
                        key={req.id}
                        onClick={() => setSelectedRequest(req)}
                        className="p-4 space-y-2.5 cursor-pointer active:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-sm">{req.leave_type}</span>
                            <p className="text-[11px] text-slate-400">Submitted: {new Date(req.submitted_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusClass}`}>
                            {req.status}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-500">Dates:</span>
                            <span className="text-slate-800 tabular-nums">
                              {req.start_date === req.end_date ? req.start_date : `${req.start_date} → ${req.end_date}`}
                            </span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-500">Duration:</span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {req.is_half_day ? '0.5 day' : `${req.total_days} days`}
                            </span>
                          </div>
                          <p className="text-slate-600 italic pt-1">&ldquo;{req.reason}&rdquo;</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* View 2: Transaction Ledger Audit Table */}
        {activeView === 'ledger' && (
          <div>
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No ledger transactions recorded yet.
              </div>
            ) : (
              <>
                {/* Desktop Ledger Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80">
                      <tr>
                        <th className="px-5 py-3.5">Date &amp; Time</th>
                        <th className="px-5 py-3.5">Leave Type</th>
                        <th className="px-5 py-3.5">Transaction Type</th>
                        <th className="px-5 py-3.5 text-center">Amount</th>
                        <th className="px-5 py-3.5 text-center">Balance After</th>
                        <th className="px-5 py-3.5">Description &amp; Notes</th>
                        <th className="px-5 py-3.5 text-right">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((tx) => {
                        const isCredit = tx.amount > 0;
                        const txDate = tx.created_at ? new Date(tx.created_at) : tx.timestamp ? new Date(tx.timestamp) : new Date();
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3.5 text-slate-700 font-medium tabular-nums">
                              <div>{txDate.toLocaleDateString()}</div>
                              <div className="text-[10px] text-slate-400">
                                {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-bold text-slate-900">{tx.leave_type}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  tx.transaction_type === 'holiday_credit'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : tx.transaction_type === 'leave_deduction'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : tx.transaction_type === 'manual_adjustment' || tx.transaction_type === 'admin_adjustment'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {tx.transaction_type.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span
                                className={`inline-flex items-center font-bold text-xs tabular-nums ${
                                  isCredit ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {isCredit ? (
                                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                ) : (
                                  <ArrowDownLeft className="w-3.5 h-3.5 mr-0.5" />
                                )}
                                {isCredit ? `+${tx.amount}` : tx.amount} day(s)
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] tabular-nums">
                                {tx.balance_after} days
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 max-w-sm">
                              <div className="font-medium text-slate-800">{tx.description}</div>
                              {tx.notes && <div className="text-[11px] text-slate-400 italic mt-0.5">&ldquo;{tx.notes}&rdquo;</div>}
                            </td>
                            <td className="px-5 py-3.5 text-right text-slate-500 font-medium">
                              {tx.performed_by_name || tx.created_by_name || 'System'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Ledger Stack */}
                <div className="md:hidden divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isCredit = tx.amount > 0;
                    return (
                      <div key={tx.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">{tx.leave_type}</span>
                          <span
                            className={`inline-flex items-center font-bold text-xs tabular-nums ${
                              isCredit ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {isCredit ? `+${tx.amount}` : tx.amount} day(s)
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{tx.description}</p>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>{new Date(tx.created_at || tx.timestamp || Date.now()).toLocaleDateString()}</span>
                          <span>Balance: <strong className="text-slate-700">{tx.balance_after}d</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-sm font-bold text-slate-900">Leave Request Details</h3>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${
                  selectedRequest.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                    : selectedRequest.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                    : 'bg-amber-50 text-amber-700 border-amber-200/80'
                }`}>
                  {selectedRequest.status}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Leave Type:</span>
                <span className="font-bold text-slate-900">{selectedRequest.leave_type}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">{selectedRequest.is_half_day ? 'Date:' : 'Date Range:'}</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {selectedRequest.start_date === selectedRequest.end_date
                    ? selectedRequest.start_date
                    : `${selectedRequest.start_date} to ${selectedRequest.end_date}`}
                </span>
              </div>

              {selectedRequest.is_half_day && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Half-Day Session:</span>
                  <span className="font-semibold text-amber-800">
                    {selectedRequest.half_day_period === 'morning' ? 'Morning (9:00 AM – 1:00 PM)' : 'Afternoon (1:00 PM – 5:00 PM)'}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Duration:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {selectedRequest.total_days} day(s) {selectedRequest.is_half_day ? '(Half-Day)' : ''}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Submitted On:</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {new Date(selectedRequest.submitted_at).toLocaleString()}
                </span>
              </div>

              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Reason:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200 italic">
                  &ldquo;{selectedRequest.reason}&rdquo;
                </p>
              </div>

              {selectedRequest.attachment_name && (
                <div className="pt-1">
                  <span className="text-slate-500 block mb-1">Supporting Document:</span>
                  <div className="flex items-center justify-between p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <span className="font-medium text-indigo-900 truncate">
                      {selectedRequest.attachment_name}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Attached</span>
                  </div>
                </div>
              )}

              {/* Admin Review info */}
              {selectedRequest.reviewed_by_name && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-700">
                    Reviewed by {selectedRequest.reviewed_by_name} on{' '}
                    {selectedRequest.reviewed_at ? new Date(selectedRequest.reviewed_at).toLocaleDateString() : ''}
                  </p>
                  {selectedRequest.admin_note && (
                    <p className="text-slate-600 mt-1 italic">
                      HR Note: &ldquo;{selectedRequest.admin_note}&rdquo;
                    </p>
                  )}
                </div>
              )}

              {/* Calendar Sync & Export Box (for Approved leaves) */}
              {selectedRequest.status === 'Approved' && (
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-[#3A5D83]" />
                      <span>Calendar Integration</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                      Verified Leave
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Export to your personal or work calendar (.ics file compatible with Outlook &amp; Apple Calendar) or push directly to Google Calendar.
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        downloadIcsFile({
                          title: `Out of Office - ${selectedRequest.leave_type}`,
                          startDate: selectedRequest.start_date,
                          endDate: selectedRequest.end_date,
                          description: selectedRequest.reason,
                          isHalfDay: selectedRequest.is_half_day,
                          halfDayPeriod: selectedRequest.half_day_period,
                          employeeName: user.full_name,
                        })
                      }
                      className="px-3 py-1.5 bg-[#3A5D83] hover:bg-[#2F4D6D] text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .ICS</span>
                    </button>
                    <a
                      href={getGoogleCalendarUrl({
                        title: `Out of Office: ${selectedRequest.leave_type}`,
                        startDate: selectedRequest.start_date,
                        endDate: selectedRequest.end_date,
                        description: selectedRequest.reason,
                        isHalfDay: selectedRequest.is_half_day,
                        halfDayPeriod: selectedRequest.half_day_period,
                        employeeName: user.full_name,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Google Calendar</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        balances={balances}
      />
    </div>
  );
};
