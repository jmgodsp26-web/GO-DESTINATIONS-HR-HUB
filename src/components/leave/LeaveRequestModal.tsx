import { workingDays } from '../../utils/workingDays';
import { readUpload } from '../../utils/files';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LeaveType, LeaveBalance, HalfDayPeriod, Holiday } from '../../types';
import {
  OFFICIAL_LEAVE_TYPES,
  LEAVE_TYPE_MASTER_DATA,
  getLeaveTypeConfig,
  LEAVE_TYPE_CONFIGS,
  isPaidLeaveType,
} from '../../constants/masterData';
import { api } from '../../services/api';
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  Upload,
  X,
  ArrowRight,
  Info,
  Sun,
  Sunset,
} from 'lucide-react';

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances: LeaveBalance[];
}

export const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  balances,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [leaveType, setLeaveType] = useState<LeaveType>('Vacation Leave');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<HalfDayPeriod>('morning');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [workweek, setWorkweek] = useState('Monday to Friday');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaysReady, setHolidaysReady] = useState(false);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setHolidaysReady(false);
    setHolidayError(null);
    Promise.all([api.getHolidays({is_active: true}), api.getSettings()]).then(([data, settings]) => { if (active) { setHolidays(data); setWorkweek(settings.workweek); setHolidaysReady(true); } }).catch(err => {if (active) setHolidayError(err.message || 'Could not load holidays. Close and reopen to try again.');});
    return () => {active = false;};
  }, [isOpen]);
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      setStartDate(tomorrowStr);
      setEndDate(tomorrowStr);
      setIsHalfDay(false);
      setHalfDayPeriod('morning');
      setLeaveType('Vacation Leave');
      setReason('');
      setAttachmentName('');
      setAttachmentFile(null);
      setError(null);
      setStep('form');
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  let calculatedDays = 0;
  let dateError: string | null = holidayError;
  if (holidaysReady) {
    try {
      const eligible = workingDays(startDate, isHalfDay ? startDate : endDate, holidays, user.country, user.region, workweek);
      calculatedDays = isHalfDay && eligible > 0 ? 0.5 : eligible;
      if (!calculatedDays) dateError = 'Choose a working day; weekends and applicable holidays are excluded.';
    } catch (err: any) { dateError = err.message; }
  }

  // Find balance for selected leave type (Unpaid Leave does not deduct from paid balances)
  const isPaid = isPaidLeaveType(leaveType);
  const selectedBalance = balances.find((b) => b.leave_type === leaveType);
  const remainingDays = isPaid && selectedBalance
    ? selectedBalance.allocated_days - selectedBalance.used_days
    : null;
  const projectedRemaining = isPaid && remainingDays !== null
    ? remainingDays - calculatedDays
    : null;
  const isExhausted = isPaid && projectedRemaining !== null && projectedRemaining < 0;
  const isZeroRemaining = isPaid && projectedRemaining !== null && projectedRemaining === 0;
  const isLowBalance = isPaid && projectedRemaining !== null && projectedRemaining > 0 && projectedRemaining <= 2;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 450000) {
        setAttachmentName('');
        setAttachmentFile(null);
        setError('Attachment file size must be at most 450 KB.');
        return;
      }
      setAttachmentName(file.name);
      setAttachmentFile(file);
      setError(null);
    }
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!holidaysReady || dateError) { setError(dateError || 'Please wait while holidays are loaded.'); return; }

    if (!startDate || (!isHalfDay && !endDate)) {
      setError('Please select valid leave dates.');
      return;
    }

    if (!isHalfDay && calculatedDays <= 0) {
      setError('End date must be on or after start date.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your leave request.');
      return;
    }

    // Balance check applies ONLY to paid leave types (Vacation, Sick, Emergency, Medical)
    // Unpaid Leave does NOT deduct from paid balances
    if (isPaid && remainingDays !== null) {
      if (calculatedDays > remainingDays) {
        setError(`Insufficient leave balance. You have ${remainingDays} day(s) remaining for ${leaveType}.`);
        return;
      }
    }

    setStep('confirm');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const attachmentData = attachmentFile ? await readUpload(attachmentFile) : undefined;
      const saved = await api.submitLeaveRequest({
        leave_type: leaveType,
        start_date: startDate,
        end_date: isHalfDay ? startDate : endDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : undefined,
        reason: reason.trim(),
        attachment_name: attachmentName || undefined,
        attachment_data: attachmentData,
      });

      showToast({
        type: 'success',
        title: 'Leave Request Submitted',
        message: `Your ${leaveType} application (${saved.total_days} day(s)) has been submitted to HR.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStep('form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {step === 'form' ? 'Submit Leave Request' : 'Confirm Leave Request'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {(error || dateError) && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{error || dateError}</span>
          </div>
        )}

        {/* Modal Body */}
        {step === 'form' ? (
          <form onSubmit={handleProceedToConfirm} className="p-6 space-y-4">
            {/* Leave Type */}
            <div>
              <label htmlFor="leave-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                Leave Type *
              </label>
              <select
                id="leave-type-select"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {[...LEAVE_TYPE_MASTER_DATA, LEAVE_TYPE_CONFIGS['Holiday Shift Credit']].map((lt) => {
                  const bal = balances.find((b) => b.leave_type === lt.name);
                  const rem = bal ? bal.allocated_days - bal.used_days : null;
                  return (
                    <option key={lt.id} value={lt.name}>
                      {lt.name} {!lt.is_paid ? '— Unpaid (No balance deduction)' : rem !== null ? `(${rem}d left)` : ''}
                    </option>
                  );
                })}
              </select>

              {isPaid && remainingDays !== null && (
                <p className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Current Balance: <strong className="text-slate-800">{remainingDays} day(s)</strong> remaining
                  </span>
                </p>
              )}
              {!isPaid && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/80 mt-1.5 flex items-start space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Unpaid Leave:</strong> Authorized leave without salary compensation. Submitting unpaid leave will <em>not</em> reduce your paid Vacation or Sick leave balances.
                  </span>
                </p>
              )}
            </div>

            {/* Duration Type Segmented Control: Full Day vs Half Day */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Leave Duration Type *
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsHalfDay(false)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all ${
                    !isHalfDay
                      ? 'bg-white text-[#3A5D83] font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Day(s)
                </button>
                <button
                  type="button"
                  id="select-half-day-btn"
                  onClick={() => {
                    setIsHalfDay(true);
                    setEndDate(startDate);
                  }}
                  className={`py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center space-x-1 ${
                    isHalfDay
                      ? 'bg-white text-[#3A5D83] font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Half Day (0.5 Day)</span>
                </button>
              </div>
            </div>

            {/* Half-Day Period Selector */}
            {isHalfDay && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                <label className="block text-xs font-semibold text-amber-900">
                  Select Half-Day Session *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('morning')}
                    className={`p-2.5 rounded-lg border text-left flex items-start space-x-2.5 transition-all ${
                      halfDayPeriod === 'morning'
                        ? 'bg-white border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                        : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Morning</p>
                      <p className="text-[10px] text-slate-500">9:00 AM – 1:00 PM</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHalfDayPeriod('afternoon')}
                    className={`p-2.5 rounded-lg border text-left flex items-start space-x-2.5 transition-all ${
                      halfDayPeriod === 'afternoon'
                        ? 'bg-white border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                        : 'bg-white/60 border-amber-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Sunset className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Afternoon</p>
                      <p className="text-[10px] text-slate-500">1:00 PM – 5:00 PM</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Date Pickers */}
            <div className={`grid gap-4 ${isHalfDay ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label htmlFor="start-date-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isHalfDay ? 'Leave Date *' : 'Start Date *'}
                </label>
                <input
                  type="date"
                  id="start-date-input"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (isHalfDay || (endDate && e.target.value > endDate)) {
                      setEndDate(e.target.value);
                    }
                  }}
                  required
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {!isHalfDay && (
                <div>
                  <label htmlFor="end-date-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    id="end-date-input"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Auto-calculated duration & Real-Time Balance Exhaustion Indicator */}
            {calculatedDays > 0 && (
              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isExhausted
                    ? 'bg-rose-50 border-rose-200 text-rose-950 shadow-2xs'
                    : isZeroRemaining
                    ? 'bg-amber-50/90 border-amber-200 text-amber-950 shadow-2xs'
                    : isLowBalance
                    ? 'bg-amber-50/70 border-amber-200/80 text-amber-950 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-900 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold">
                    <Clock
                      className={`w-4 h-4 ${
                        isExhausted
                          ? 'text-rose-600'
                          : isZeroRemaining || isLowBalance
                          ? 'text-amber-600'
                          : 'text-[#3A5D83]'
                      }`}
                    />
                    <span>
                      Duration:{' '}
                      <strong>
                        {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                        {isHalfDay && ` (${halfDayPeriod === 'morning' ? 'Morning 9AM–1PM' : 'Afternoon 1PM–5PM'})`}
                      </strong>
                    </span>
                  </div>
                  {isPaid && remainingDays !== null ? (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isExhausted
                          ? 'bg-rose-200 text-rose-800'
                          : isZeroRemaining
                          ? 'bg-amber-200 text-amber-900'
                          : isLowBalance
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isExhausted
                        ? 'Exceeds Balance'
                        : isZeroRemaining
                        ? 'Exhausts Quota'
                        : isLowBalance
                        ? 'Low Balance Warning'
                        : 'Sufficient Balance'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                      Unpaid Leave
                    </span>
                  )}
                </div>

                {isPaid && remainingDays !== null ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center py-2 px-1 bg-white/90 rounded-lg border border-slate-200/70 shadow-2xs">
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">Current Balance</span>
                        <span className="text-xs sm:text-sm font-bold text-slate-800 tabular-nums">
                          {remainingDays} {remainingDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div className="border-x border-slate-200">
                        <span className="text-[10px] text-slate-500 font-medium block">Deduction</span>
                        <span className="text-xs sm:text-sm font-bold text-indigo-600 tabular-nums">
                          -{calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-medium block">Projected Balance</span>
                        <span
                          className={`text-xs sm:text-sm font-bold tabular-nums ${
                            isExhausted
                              ? 'text-rose-600'
                              : isZeroRemaining
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {projectedRemaining} {projectedRemaining === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] mt-2 leading-relaxed">
                      {isExhausted && (
                        <div className="text-rose-700 font-medium flex items-start space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                          <span>
                            Requested time off exceeds your available quota by{' '}
                            <strong>{Math.abs(projectedRemaining!)} day(s)</strong>. Please reduce the date range or select Unpaid Leave.
                          </span>
                        </div>
                      )}
                      {isZeroRemaining && (
                        <div className="text-amber-900 font-medium flex items-start space-x-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            This leave application will use 100% of your remaining {leaveType} entitlement.
                          </span>
                        </div>
                      )}
                      {isLowBalance && (
                        <div className="text-amber-900 font-medium flex items-start space-x-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                          <span>
                            You will have only <strong>{projectedRemaining} day(s)</strong> remaining for {leaveType} after this request.
                          </span>
                        </div>
                      )}
                      {!isExhausted && !isZeroRemaining && !isLowBalance && (
                        <div className="text-slate-600 flex items-center space-x-1.5">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                          <span>
                            Healthy balance. You will retain <strong>{projectedRemaining} day(s)</strong> of {leaveType}.
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Unpaid leave does not deduct from your paid leave quotas and is evaluated based on departmental staffing coverage.
                  </p>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label htmlFor="leave-reason-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Leave *
              </label>
              <textarea
                id="leave-reason-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe the purpose of your leave..."
                required
                className="w-full text-sm rounded-lg border border-slate-300 p-3 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Optional Attachment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Optional Supporting Attachment (e.g. Medical certificate, note)
              </label>
              <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center hover:bg-slate-50 transition-colors relative">
                <input
                  type="file"
                  id="attachment-upload"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
                <div className="flex items-center justify-center space-x-2 text-xs text-slate-600">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>{attachmentName ? attachmentName : 'Click or drag file to attach (Max 450 KB)'}</span>
                </div>
              </div>
              {attachmentName && (
                <div className="flex items-center justify-between text-xs text-indigo-600 mt-1">
                  <span className="truncate">{attachmentName}</span>
                  <button
                    type="button"
                    onClick={() => {setAttachmentName(''); setAttachmentFile(null);}}
                    className="text-rose-500 hover:text-rose-700 font-medium ml-2"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-leave-review-btn"
                disabled={!holidaysReady || !!dateError}
                className="px-4 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D] transition-colors flex items-center space-x-1.5"
              >
                <span>Review Request</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation Step */
          <div className="p-6 space-y-5">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-900">
                You are requesting <strong className="text-base font-bold text-amber-950">{calculatedDays} day(s)</strong>
                {isHalfDay && ` (${halfDayPeriod === 'morning' ? 'Morning' : 'Afternoon'})`} of {leaveType}.
              </p>
              <p className="text-[11px] text-amber-800 mt-1">
                Please confirm the details below before submitting to HR.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Employee:</span>
                <span className="font-semibold text-slate-900">{user.full_name} ({user.employee_id})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Leave Type:</span>
                <span className="font-semibold text-slate-900">{leaveType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">{isHalfDay ? 'Date:' : 'Date Range:'}</span>
                <span className="font-semibold text-slate-900">
                  {isHalfDay ? startDate : `${startDate} to ${endDate}`}
                </span>
              </div>
              {isHalfDay && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Half-Day Session:</span>
                  <span className="font-semibold text-amber-800">
                    {halfDayPeriod === 'morning' ? 'Morning (9:00 AM – 1:00 PM)' : 'Afternoon (1:00 PM – 5:00 PM)'}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Total Duration:</span>
                <span className="font-semibold text-slate-900">{calculatedDays} day(s)</span>
              </div>
              {attachmentName && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Attachment:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[200px]">{attachmentName}</span>
                </div>
              )}
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Reason:</span>
                <p className="text-slate-800 italic bg-white p-2.5 rounded border border-slate-200">{reason}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                id="confirm-submit-leave-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold bg-[#3A5D83] text-white rounded-lg hover:bg-[#2F4D6D] transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
