import { csvRow } from '../../utils/csv';
import React, { useState } from 'react';
import {
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  Search,
  UserCheck,
  Plus,
  Download,
  AlertCircle,
  ShieldCheck,
  Send,
  Briefcase,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';
import {
  HolidayStaffingCoverage,
  HolidayShiftRequest,
  LeaveRequest,
  EmployeeHolidayStatusType,
  UserProfile,
} from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface HolidayDetailModalProps {
  coverage: HolidayStaffingCoverage;
  allEmployees: (UserProfile & { is_pc?: boolean })[];
  onClose: () => void;
  onRefresh: () => void;
}

export const HolidayDetailModal: React.FC<HolidayDetailModalProps> = ({
  coverage,
  allEmployees,
  onClose,
  onRefresh,
}) => {
  const { showToast: showGlobalToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    'working' | 'leave' | 'pending' | 'roster'
  >('working');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [pcOnlyFilter, setPcOnlyFilter] = useState(false);

  // Quick Action Modals / States
  const [isAssignShiftOpen, setIsAssignShiftOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee_id: '',
    working_hours: '9:00 AM – 5:00 PM',
    status: 'Approved' as 'Approved' | 'Pending',
    admin_note: '',
  });

  const [reviewNoteModal, setReviewNoteModal] = useState<{
    isOpen: boolean;
    type: 'shift' | 'leave';
    id: string;
    action: 'Approved' | 'Rejected';
    employeeName: string;
    note: string;
  }>({
    isOpen: false,
    type: 'shift',
    id: '',
    action: 'Approved',
    employeeName: '',
    note: '',
  });

  const [conflictModal, setConflictModal] = useState<{
    isOpen: boolean;
    employeeId: string;
    employeeName: string;
  }>({
    isOpen: false,
    employeeId: '',
    employeeName: '',
  });

  const [deletingShift, setDeletingShift] = useState<{
    id: string;
    name: string;
    hours?: string;
  } | null>(null);
  const [isDeletingHolidayModalOpen, setIsDeletingHolidayModalOpen] = useState(false);
  const [isDeletingHolidayProcessing, setIsDeletingHolidayProcessing] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const {
    holiday,
    total_employees,
    working_count,
    leave_count,
    pending_leave_count,
    pending_shift_count,
    total_pending_count,
    unaccounted_count,
    pcs_working_count,
    pcs_required,
    coverage_status,
    conflicts_count,
    working_shifts,
    on_leave_records,
    pending_shifts,
    pending_leaves,
    all_employee_statuses,
  } = coverage;

  const isPcCoverageMet = pcs_working_count >= pcs_required;
  const pcsNeeded = Math.max(0, pcs_required - pcs_working_count);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ type, text });
    showGlobalToast({
      type: type === 'success' ? 'success' : 'error',
      title: type === 'success' ? 'Holiday Action' : 'Action Failed',
      message: text,
    });
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Assign shift
  const handleAssignShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.employee_id) {
      showToast('Please select an employee.', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      await api.assignHolidayShift({
        employee_id: assignForm.employee_id,
        holiday_id: holiday.id,
        working_hours: assignForm.working_hours,
        status: assignForm.status,
        admin_note: assignForm.admin_note || 'Scheduled by Administrator',
      });
      showToast(
        `Holiday shift scheduled for ${
          allEmployees.find((e) => e.id === assignForm.employee_id)?.full_name || 'employee'
        }.`
      );
      setIsAssignShiftOpen(false);
      setAssignForm({
        employee_id: '',
        working_hours: '9:00 AM – 5:00 PM',
        status: 'Approved',
        admin_note: '',
      });
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign shift.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Review Shift Request
  const handleReviewShift = async (
    shiftId: string,
    action: 'Approved' | 'Rejected',
    note?: string
  ) => {
    try {
      setIsProcessing(true);
      await api.reviewHolidayShift(shiftId, action, note);
      showToast(`Shift request ${action.toLowerCase()} successfully.`);
      setReviewNoteModal((prev) => ({ ...prev, isOpen: false }));
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to review shift request.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Review Leave Request
  const handleReviewLeave = async (
    requestId: string,
    action: 'Approved' | 'Rejected',
    note?: string
  ) => {
    try {
      setIsProcessing(true);
      await api.reviewLeaveRequest(requestId, action, note);
      showToast(`Leave request ${action.toLowerCase()} successfully.`);
      setReviewNoteModal((prev) => ({ ...prev, isOpen: false }));
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to review leave request.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Resolve Conflict
  const handleResolveConflict = async (resolution: 'keep_shift' | 'keep_leave') => {
    try {
      setIsProcessing(true);
      await api.resolveHolidayConflict(
        conflictModal.employeeId,
        holiday.date,
        resolution
      );
      showToast(
        `Conflict resolved. Kept ${
          resolution === 'keep_shift' ? 'Holiday Working Shift' : 'Leave Request'
        }.`
      );
      setConflictModal({ isOpen: false, employeeId: '', employeeName: '' });
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve conflict.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove / Delete Shift Handler
  const handleConfirmRemoveShift = async () => {
    if (!deletingShift) return;
    setIsProcessing(true);
    try {
      await api.deleteHolidayShift(deletingShift.id);
      showToast(`Holiday shift for ${deletingShift.name} has been removed.`, 'success');
      setDeletingShift(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove shift.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete Entire Holiday from Modal
  const handleConfirmDeleteHolidayFromModal = async () => {
    setIsDeletingHolidayProcessing(true);
    try {
      await api.deleteHoliday(holiday.id);
      showGlobalToast({
        type: 'info',
        title: 'Holiday Deleted',
        message: `"${holiday.name}" has been permanently removed from the holiday calendar.`,
      });
      setIsDeletingHolidayModalOpen(false);
      onClose();
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete holiday.', 'error');
    } finally {
      setIsDeletingHolidayProcessing(false);
    }
  };

  // Export Staffing Report CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Full Name',
      'Email',
      'Department',
      'Job Title',
      'Program Coordinator',
      'Holiday Status',
      'Working Hours / Leave Type',
      'Approved By',
    ];

    const rows = all_employee_statuses.map((emp) => {
      let details = emp.details || '';
      let approvedBy = '';
      if (emp.status === 'Working' && emp.shift_request) {
        details = emp.shift_request.working_hours;
        approvedBy = emp.shift_request.approved_by_name || 'Admin';
      } else if (emp.status === 'On Leave' && emp.leave_request) {
        details = `${emp.leave_request.leave_type} (${emp.leave_request.start_date} to ${emp.leave_request.end_date})`;
        approvedBy = emp.leave_request.reviewed_by_name || 'Admin';
      }

      return csvRow([emp.employee_id, emp.employee_name, emp.employee_email, emp.department, emp.job_title, emp.is_pc ? 'YES (PC)' : 'NO', emp.status_label, details, approvedBy]);
    });
    const csvContent = [csvRow([`HOLIDAY STAFFING REPORT: ${holiday.name} (${holiday.date})`]), csvRow(headers), ...rows].join('\r\n');
    const encodedUri = URL.createObjectURL(new Blob([csvContent], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Holiday_Staffing_${holiday.name.replace(/\s+/g, '_')}_${holiday.date}.csv`
    );
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(encodedUri);
    document.body.removeChild(link);
    showToast('Holiday staffing report downloaded successfully.');
  };

  // Filtered Roster
  const filteredRoster = all_employee_statuses.filter((emp) => {
    const matchesSearch =
      emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.job_title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      emp.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesDept =
      departmentFilter === 'all' || emp.department === departmentFilter;

    const matchesPc = !pcOnlyFilter || emp.is_pc;

    return matchesSearch && matchesStatus && matchesDept && matchesPc;
  });

  const departments = Array.from(
    new Set(all_employee_statuses.map((e) => e.department))
  ).filter(Boolean);

  return (
    <div
      id="holiday-detail-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div
        id="holiday-detail-modal-card"
        className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#3A5D83]/30 border border-[#3A5D83]/40 flex items-center justify-center text-white">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {holiday.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#3A5D83]/30 text-white border border-[#3A5D83]/50">
                  {new Date(holiday.date + 'T00:00:00').toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {holiday.description ||
                  'Official Company Holiday & Staff Coverage Roster'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsDeletingHolidayModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-800/60 text-rose-200 hover:text-white border border-rose-800/60 transition-colors cursor-pointer"
              title="Delete this holiday"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Delete Holiday</span>
            </button>
            <button
              id="btn-export-holiday-csv"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Report</span>
            </button>
            <button
              id="btn-assign-holiday-shift-top"
              onClick={() => setIsAssignShiftOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Shift</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action / Alert feedback message */}
        {actionMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between shrink-0 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Program Coordinator (PC) Warning Banner if needed */}
        {!isPcCoverageMet && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between text-amber-900 shrink-0">
            <div className="flex items-center space-x-2.5 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">⚠️ PC Coverage Needed:</span>{' '}
                Required:{' '}
                <strong className="font-semibold">{pcs_required} PCs</strong> •
                Approved to Work:{' '}
                <strong className="font-semibold">{pcs_working_count} PC</strong>{' '}
                — Please approve or assign{' '}
                <span className="font-bold underline">
                  {pcsNeeded} more Program Coordinator
                </span>{' '}
                to meet mandatory coverage.
              </div>
            </div>
            <button
              onClick={() => setIsAssignShiftOpen(true)}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] shadow-2xs transition-colors shrink-0 ml-3"
            >
              Assign PC Shift
            </button>
          </div>
        )}

        {/* Conflict Alert Banner if any */}
        {conflicts_count > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-rose-900 shrink-0">
            <div className="flex items-center space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Scheduling Conflict Detected:</strong>{' '}
                {conflicts_count} employee(s) have both an approved holiday shift
                and approved leave.
              </span>
            </div>
            <span className="text-[11px] font-semibold text-rose-700">
              Review in Roster
            </span>
          </div>
        )}

        {/* SECTION 4: Holiday Staffing Summary Metrics */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Holiday Staffing Summary
            </h3>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                  coverage_status === 'Good'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                Coverage: {coverage_status === 'Good' ? '✅ Good' : '⚠️ PC Coverage Needed'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Total Employees */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">Total Staff</span>
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {total_employees}
              </div>
            </div>

            {/* Approved Working */}
            <div
              onClick={() => setActiveTab('working')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'working'
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20'
                  : 'bg-white border-slate-200 hover:border-emerald-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-emerald-700 mb-1">
                <span className="text-[11px] font-semibold">🟢 Approved Working</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {working_count}
              </div>
            </div>

            {/* Approved Leave */}
            <div
              onClick={() => setActiveTab('leave')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'leave'
                  ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-400/20'
                  : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-blue-700 mb-1">
                <span className="text-[11px] font-semibold">🔵 Approved Leave</span>
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-blue-700">
                {leave_count}
              </div>
            </div>

            {/* Pending Requests */}
            <div
              onClick={() => setActiveTab('pending')}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20'
                  : 'bg-white border-slate-200 hover:border-amber-300 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-[11px] font-semibold">🟡 Pending Requests</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-amber-700">
                {total_pending_count}
                <span className="text-[11px] font-normal text-slate-500 ml-1">
                  ({pending_shift_count} shift, {pending_leave_count} leave)
                </span>
              </div>
            </div>

            {/* PCs Working */}
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-[#3A5D83] mb-1">
                <span className="text-[11px] font-semibold">👤 PCs Working</span>
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-baseline space-x-1">
                <span
                  className={`text-xl font-bold ${
                    isPcCoverageMet ? 'text-emerald-700' : 'text-[#ED9027]'
                  }`}
                >
                  {pcs_working_count}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  / {pcs_required} req
                </span>
              </div>
            </div>

            {/* Unaccounted */}
            <div
              onClick={() => {
                setActiveTab('roster');
                setStatusFilter('No Request');
              }}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs cursor-pointer hover:border-slate-300"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-medium">⚪ Unaccounted</span>
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div className="text-xl font-bold text-slate-800">
                {unaccounted_count}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex space-x-1">
            <button
              id="tab-who-is-working"
              onClick={() => setActiveTab('working')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
                activeTab === 'working'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>WHO IS WORKING</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {working_count}
              </span>
            </button>

            <button
              id="tab-who-is-on-leave"
              onClick={() => setActiveTab('leave')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
                activeTab === 'leave'
                  ? 'border-[#3A5D83] text-[#3A5D83]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>WHO IS ON LEAVE</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {leave_count}
              </span>
            </button>

            <button
              id="tab-pending-requests"
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
                activeTab === 'pending'
                  ? 'border-[#ED9027] text-[#ED9027]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>PENDING REQUESTS</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ED9027]/15 text-[#ED9027]">
                {total_pending_count}
              </span>
            </button>

            <button
              id="tab-all-employees-roster"
              onClick={() => setActiveTab('roster')}
              className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
                activeTab === 'roster'
                  ? 'border-[#3A5D83] text-[#3A5D83]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>ALL EMPLOYEES ROSTER</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {total_employees}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: WHO IS WORKING */}
          {activeTab === 'working' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Approved Holiday Working Staff ({working_count})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Employees whose Holiday Shift Request has been officially
                    approved by HR.
                  </p>
                </div>
                <button
                  onClick={() => setIsAssignShiftOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Working Employee</span>
                </button>
              </div>

              {working_shifts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-slate-200 p-8">
                  <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h5 className="text-sm font-semibold text-slate-700">
                    No Approved Holiday Shifts Yet
                  </h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Approve pending shift requests or directly schedule staff to
                    ensure proper holiday coverage.
                  </p>
                  <button
                    onClick={() => setIsAssignShiftOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Schedule Shift
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Role / PC</th>
                          <th className="py-3 px-4">Working Hours</th>
                          <th className="py-3 px-4">Approval Status</th>
                          <th className="py-3 px-4">Approved By</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {working_shifts.map((shift) => (
                          <tr
                            key={shift.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                {shift.employee_avatar && shift.employee_avatar.trim() ? (
                                  <img
                                    src={shift.employee_avatar}
                                    alt={shift.employee_name}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-[#3A5D83]/10 text-[#3A5D83] flex items-center justify-center font-bold text-xs border border-[#3A5D83]/20 shrink-0">
                                    {shift.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'EM'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900">
                                    {shift.employee_name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {shift.employee_email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {shift.employee_department}
                            </td>
                            <td className="py-3 px-4">
                              {shift.is_pc ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#3A5D83]/10 text-[#3A5D83] border border-[#3A5D83]/20">
                                  <ShieldCheck className="w-3 h-3 mr-1 text-[#3A5D83]" />
                                  PC (Coordinator)
                                </span>
                              ) : (
                                <span className="text-slate-600 font-medium">
                                  Employee
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Clock className="w-3 h-3 mr-1 text-emerald-600" />
                                {shift.working_hours}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                Approved
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {shift.approved_by_name || 'HR Manager'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingShift({
                                    id: shift.id,
                                    name: shift.employee_name,
                                    hours: shift.working_hours,
                                  })
                                }
                                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                                title="Remove Shift Assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WHO IS ON LEAVE */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Approved Staff On Leave ({leave_count})
                </h4>
                <p className="text-xs text-slate-500">
                  Employees who have an approved leave request covering {holiday.name} ({holiday.date}).
                </p>
              </div>

              {on_leave_records.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-slate-200 p-8">
                  <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h5 className="text-sm font-semibold text-slate-700">
                    No Approved Leave on this Holiday
                  </h5>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    No employee currently has an approved leave request for this date.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Leave Type</th>
                          <th className="py-3 px-4">Date Range</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {on_leave_records.map((item) => (
                          <tr
                            key={item.leave_request.id}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                {item.avatar_url && item.avatar_url.trim() ? (
                                  <img
                                    src={item.avatar_url}
                                    alt={item.employee_name}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs border border-rose-200 shrink-0">
                                    {item.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'EM'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-900">
                                    {item.employee_name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.employee_email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-800">
                              {item.department}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                                {item.leave_request.leave_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {item.leave_request.start_date ===
                              item.leave_request.end_date ? (
                                <span>{item.leave_request.start_date}</span>
                              ) : (
                                <span>
                                  {item.leave_request.start_date} to{' '}
                                  {item.leave_request.end_date} (
                                  {item.leave_request.total_days}d)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                                Approved
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PENDING REQUESTS (Separated into Shift & Leave) */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              {/* Top description */}
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Pending Staffing Requests ({total_pending_count})
                </h4>
                <p className="text-xs text-slate-500">
                  Review potential staffing changes before approving requests.
                  Pending requests do NOT count toward official coverage.
                </p>
              </div>

              {/* Sub-section 1: Pending Holiday Shift Requests */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🟡</span>
                    <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Pending Holiday Shift Requests ({pending_shifts.length})
                    </h5>
                  </div>
                  <span className="text-[11px] text-amber-800 font-medium">
                    Employee coverage shift requests
                  </span>
                </div>

                {pending_shifts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No pending holiday shift requests for this holiday.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pending_shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          {shift.employee_avatar && shift.employee_avatar.trim() ? (
                            <img
                              src={shift.employee_avatar}
                              alt={shift.employee_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200 shrink-0">
                              {shift.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'EM'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {shift.employee_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                • {shift.employee_department}
                              </span>
                              {shift.is_pc && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                  PC
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-700 mt-0.5">
                              Requested Hours:{' '}
                              <strong className="font-semibold text-slate-900">
                                {shift.working_hours}
                              </strong>
                              {shift.reason && (
                                <span className="text-slate-500 ml-1">
                                  — "{shift.reason}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleReviewShift(shift.id, 'Approved')
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Shift</span>
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleReviewShift(shift.id, 'Rejected')
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center space-x-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              setDeletingShift({
                                id: shift.id,
                                name: shift.employee_name,
                                hours: shift.working_hours,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Delete Shift Request"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-section 2: Pending Leave Requests */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🟡</span>
                    <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Pending Leave Requests ({pending_leaves.length})
                    </h5>
                  </div>
                  <span className="text-[11px] text-amber-800 font-medium">
                    Employees seeking time off during this holiday
                  </span>
                </div>

                {pending_leaves.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No pending leave requests covering this holiday date.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pending_leaves.map((item) => (
                      <div
                        key={item.leave_request.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                      >
                        <div className="flex items-start space-x-3">
                          {item.avatar_url && item.avatar_url.trim() ? (
                            <img
                              src={item.avatar_url}
                              alt={item.employee_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs border border-rose-200 shrink-0">
                              {item.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'EM'}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {item.employee_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                • {item.department}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                                {item.leave_request.leave_type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 mt-0.5">
                              Dates:{' '}
                              <strong className="font-semibold text-slate-900">
                                {item.leave_request.start_date} to{' '}
                                {item.leave_request.end_date} (
                                {item.leave_request.total_days} days)
                              </strong>
                              {item.leave_request.reason && (
                                <span className="text-slate-500 ml-1">
                                  — "{item.leave_request.reason}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleReviewLeave(
                                item.leave_request.id,
                                'Approved'
                              )
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors flex items-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Leave</span>
                          </button>
                          <button
                            disabled={isProcessing}
                            onClick={() =>
                              handleReviewLeave(
                                item.leave_request.id,
                                'Rejected'
                              )
                            }
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors flex items-center space-x-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ALL EMPLOYEES ROSTER (Matrix of Workforce Status) */}
          {activeTab === 'roster' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by employee name, email, department..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#3A5D83]"
                  />
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-hidden"
                  >
                    <option value="all">All Holiday Statuses</option>
                    <option value="Working">🟢 Working</option>
                    <option value="On Leave">⚪ On Leave</option>
                    <option value="Holiday Shift Pending">
                      🟡 Shift Pending
                    </option>
                    <option value="Leave Pending">🟡 Leave Pending</option>
                    <option value="No Request">⚪ No Request</option>
                    <option value="Conflict">⚠️ Conflict</option>
                  </select>

                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-hidden"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer pl-1">
                    <input
                      type="checkbox"
                      checked={pcOnlyFilter}
                      onChange={(e) => setPcOnlyFilter(e.target.checked)}
                      className="rounded text-[#3A5D83] focus:ring-[#3A5D83]"
                    />
                    <span>PCs Only</span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4">Department & Role</th>
                        <th className="py-3 px-4">Holiday Status</th>
                        <th className="py-3 px-4">Details</th>
                        <th className="py-3 px-4 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredRoster.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="text-center py-8 text-slate-400"
                          >
                            No employees match your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredRoster.map((emp) => {
                          const isWorking = emp.status === 'Working';
                          const isOnLeave = emp.status === 'On Leave';
                          const isPendingShift =
                            emp.status === 'Holiday Shift Pending';
                          const isPendingLeave =
                            emp.status === 'Leave Pending';
                          const isConflict = emp.status === 'Conflict';

                          return (
                            <tr
                              key={emp.employee_id}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  {emp.avatar_url && emp.avatar_url.trim() ? (
                                    <img
                                      src={emp.avatar_url}
                                      alt={emp.employee_name}
                                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-200 shrink-0">
                                      {emp.employee_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'EM'}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                                      <span>{emp.employee_name}</span>
                                      {emp.is_pc && (
                                        <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-800">
                                          PC
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {emp.employee_email}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">
                                  {emp.department}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                  {emp.job_title}
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                {isConflict ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                                    ⚠️ Conflict
                                  </span>
                                ) : isWorking ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    🟢 Working
                                  </span>
                                ) : isOnLeave ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                                    🔵 On Leave
                                  </span>
                                ) : isPendingShift ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                    🟡 Shift Pending
                                  </span>
                                ) : isPendingLeave ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                                    🟡 Leave Pending
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                    ⚪ No Request
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-slate-600 text-xs">
                                {emp.details || '—'}
                              </td>

                              <td className="py-3 px-4 text-right">
                                {isConflict ? (
                                  <button
                                    onClick={() =>
                                      setConflictModal({
                                        isOpen: true,
                                        employeeId: emp.employee_id,
                                        employeeName: emp.employee_name,
                                      })
                                    }
                                    className="px-2.5 py-1 rounded text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs"
                                  >
                                    Resolve
                                  </button>
                                ) : !isWorking && !isOnLeave ? (
                                  <button
                                    onClick={() => {
                                      setAssignForm({
                                        employee_id: emp.employee_id,
                                        working_hours: '9:00 AM – 5:00 PM',
                                        status: 'Approved',
                                        admin_note: 'Assigned via Roster',
                                      });
                                      setIsAssignShiftOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded text-xs font-semibold bg-[#3A5D83]/10 hover:bg-[#3A5D83]/20 text-[#3A5D83] border border-[#3A5D83]/30 transition-colors"
                                  >
                                    + Assign Shift
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    Configured
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 flex items-center space-x-2">
            <span>
              Updated in real-time as leave and shift requests change.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* ASSIGN HOLIDAY SHIFT MODAL */}
      {isAssignShiftOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Schedule Holiday Shift
                  </h4>
                  <p className="text-xs text-slate-500">
                    {holiday.name} ({holiday.date})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignShiftOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignShiftSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Employee *
                </label>
                <select
                  required
                  value={assignForm.employee_id}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, employee_id: e.target.value })
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="">-- Choose an employee --</option>
                  {allEmployees.map((emp) => {
                    const statusObj = all_employee_statuses.find((s) => s.employee_id === emp.id);
                    const statusLabel =
                      statusObj?.status === 'On Leave'
                        ? ' [⚠️ On Leave]'
                        : statusObj?.status === 'Leave Pending'
                        ? ' [⚠️ Leave Pending]'
                        : statusObj?.status === 'Working'
                        ? ' [🟢 Working]'
                        : '';

                    return (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.department} • {emp.job_title}
                        {emp.is_pc ? ' • PC' : ''}){statusLabel}
                      </option>
                    );
                  })}
                </select>

                {/* Shift & Leave Conflict Live Detection */}
                {(() => {
                  if (!assignForm.employee_id) return null;
                  const empStatus = all_employee_statuses.find(
                    (s) => s.employee_id === assignForm.employee_id
                  );
                  if (empStatus?.status === 'On Leave' || empStatus?.status === 'Conflict') {
                    return (
                      <div className="mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs flex items-start space-x-2 text-rose-900 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-rose-800">Shift &amp; Leave Conflict Warning</p>
                          <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                            <strong>{empStatus?.employee_name}</strong> already has an <strong>approved leave</strong> on this holiday ({holiday.date}). Scheduling a shift creates an active scheduling conflict.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  if (empStatus?.status === 'Leave Pending') {
                    return (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-start space-x-2 text-amber-900 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-800">Pending Leave Overlap Notice</p>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            <strong>{empStatus?.employee_name}</strong> has a <strong>pending leave request</strong> awaiting HR review for this date.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  if (empStatus?.status === 'Working') {
                    return (
                      <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs flex items-start space-x-2 text-blue-900 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-blue-800">
                          <strong>{empStatus?.employee_name}</strong> is already confirmed on duty for this holiday.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Working Hours *
                </label>
                <input
                  type="text"
                  required
                  value={assignForm.working_hours}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      working_hours: e.target.value,
                    })
                  }
                  placeholder="e.g. 9:00 AM – 5:00 PM"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={assignForm.status}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="Approved">
                    Approved (Official Confirmed Coverage)
                  </option>
                  <option value="Pending">Pending (Requires Review)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Admin Note / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={assignForm.admin_note}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, admin_note: e.target.value })
                  }
                  placeholder="e.g. Designated Program Coordinator for flight logistics"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignShiftOpen(false)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white shadow-xs transition-colors"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE CONFLICT MODAL */}
      {conflictModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h4 className="text-sm font-bold text-slate-900">
                Resolve Scheduling Conflict
              </h4>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              <strong>{conflictModal.employeeName}</strong> has both an{' '}
              <strong>approved Holiday Working Shift</strong> and an{' '}
              <strong>approved Leave Request</strong> for {holiday.name} (
              {holiday.date}). Which record would you like to keep active?
            </p>

            <div className="space-y-2 mb-5">
              <button
                onClick={() => handleResolveConflict('keep_shift')}
                disabled={isProcessing}
                className="w-full text-left p-3 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">
                    Keep Holiday Working Shift
                  </div>
                  <div className="text-[11px] text-emerald-700 font-normal">
                    Employee will be marked as Working; conflicting leave will
                    be cancelled.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => handleResolveConflict('keep_leave')}
                disabled={isProcessing}
                className="w-full text-left p-3 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold transition-all flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">Keep Leave Request</div>
                  <div className="text-[11px] text-blue-700 font-normal">
                    Employee will be marked On Leave; holiday shift will be
                    cancelled.
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-600" />
              </button>
            </div>

            <div className="text-right">
              <button
                onClick={() =>
                  setConflictModal({
                    isOpen: false,
                    employeeId: '',
                    employeeName: '',
                  })
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shift Confirmation Modal */}
      {deletingShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="go-surface bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">Remove Holiday Shift</h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingShift(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove the holiday working shift for{' '}
                <strong className="text-slate-900 font-semibold">{deletingShift.name}</strong> on{' '}
                <span className="font-semibold text-slate-800">{holiday.name}</span>?
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
                {deletingShift.hours && (
                  <p><strong>Scheduled Hours:</strong> {deletingShift.hours}</p>
                )}
                <p className="text-rose-600 font-medium">
                  ⚠️ This shift will be removed from holiday coverage and any accrued holiday shift credits will be reversed.
                </p>
              </div>
              <div className="flex items-center justify-end space-x-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingShift(null)}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemoveShift}
                  disabled={isProcessing}
                  className="px-3.5 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isProcessing ? 'Removing...' : 'Remove Shift'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Holiday Confirmation Modal (from inside Detail Modal) */}
      {isDeletingHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="go-surface bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center space-x-2 text-rose-700">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-sm font-bold">Delete Entire Holiday</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeletingHolidayModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900 font-semibold">{holiday.name}</strong> ({holiday.date})?
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p><strong>Country / Scope:</strong> {holiday.country || 'Company-wide'} ({holiday.scope})</p>
                <p><strong>Active Staff Assigned:</strong> {working_count} employee(s)</p>
                <p className="text-rose-600 font-medium pt-1">
                  ⚠️ This will permanently remove this holiday from the calendar, purge all associated shift coverage, and cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeletingHolidayModalOpen(false)}
                  disabled={isDeletingHolidayProcessing}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteHolidayFromModal}
                  disabled={isDeletingHolidayProcessing}
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingHolidayProcessing ? 'Deleting...' : 'Delete Holiday'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
