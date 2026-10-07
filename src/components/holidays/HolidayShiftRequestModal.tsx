import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, Send, ShieldCheck, AlertCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Holiday, HolidayShiftRequest, LeaveRequest } from '../../types';
import { api } from '../../services/api';

interface HolidayShiftRequestModalProps {
  holidays: Holiday[];
  initialHolidayId?: string;
  onClose: () => void;
  onSuccess: (shift: HolidayShiftRequest) => void;
}

export const HolidayShiftRequestModal: React.FC<HolidayShiftRequestModalProps> = ({
  holidays,
  initialHolidayId,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [selectedHolidayId, setSelectedHolidayId] = useState(
    initialHolidayId || (holidays[0]?.id ?? '')
  );
  const [workingHours, setWorkingHours] = useState('9:00 AM – 5:00 PM');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLeaves, setUserLeaves] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    api.getLeaveRequests()
      .then((res) => setUserLeaves(res || []))
      .catch((err: any) => {
        if (!err?.message?.includes('Session expired') && !err?.message?.includes('token')) {
          console.error('Failed to load user leaves for conflict check:', err);
        }
      });
  }, []);

  const selectedHoliday = holidays.find((h) => h.id === selectedHolidayId);

  // Check if selected holiday overlaps an approved or pending leave
  const conflictingLeave = selectedHoliday
    ? userLeaves.find(
        (l) =>
          l.status === 'Approved' &&
          selectedHoliday.date >= l.start_date &&
          selectedHoliday.date <= l.end_date
      )
    : null;

  const pendingConflictingLeave = selectedHoliday && !conflictingLeave
    ? userLeaves.find(
        (l) =>
          l.status === 'Pending' &&
          selectedHoliday.date >= l.start_date &&
          selectedHoliday.date <= l.end_date
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHolidayId) {
      setError('Please choose a holiday.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const shift = await api.submitHolidayShift({
        holiday_id: selectedHolidayId,
        working_hours: workingHours,
        reason,
      });
      showToast({
        type: 'success',
        title: 'Shift Request Submitted',
        message: `Your holiday shift request for ${selectedHoliday?.name || 'the selected holiday'} has been sent to HR.`,
      });
      onSuccess(shift);
    } catch (err: any) {
      setError(err.message || 'Failed to submit holiday shift request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="holiday-shift-request-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        id="holiday-shift-request-modal-card"
        className="go-surface bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Volunteer for Holiday Shift
              </h3>
              <p className="text-xs text-slate-500">
                Submit your availability to work on an upcoming company holiday.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Select Holiday */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Holiday *
            </label>
            <select
              required
              value={selectedHolidayId}
              onChange={(e) => setSelectedHolidayId(e.target.value)}
              className="w-full text-xs bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all font-medium"
            >
              {holidays.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} — {h.date}
                </option>
              ))}
            </select>
            {selectedHoliday && (
              <p className="text-[11px] text-indigo-600 mt-1.5 font-medium flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>
                  Date:{' '}
                  {new Date(selectedHoliday.date + 'T00:00:00').toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    }
                  )}
                </span>
              </p>
            )}

            {/* Leave Conflict Warning */}
            {conflictingLeave && (
              <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <p className="font-bold text-rose-800">Scheduling Conflict Detected</p>
                  <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                    You have an <strong>approved {conflictingLeave.leave_type}</strong> spanning this date ({selectedHoliday?.date}). Volunteering for a holiday shift while on approved leave will create a scheduling conflict.
                  </p>
                </div>
              </div>
            )}

            {pendingConflictingLeave && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-800">Pending Leave Overlap</p>
                  <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                    You have a pending {pendingConflictingLeave.leave_type} request for this date currently awaiting HR review.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Working Hours */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Proposed Working Hours *
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder="e.g. 9:00 AM – 5:00 PM or 8:00 AM – 4:00 PM"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Standard company holiday shift is 8 hours (e.g. 9:00 AM – 5:00 PM).
            </p>
          </div>

          {/* Note / Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes / Volunteer Reason (Optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Available on-call, Program Coordinator coverage support..."
              className="w-full text-xs bg-slate-50/70 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden transition-all font-medium resize-none"
            />
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 space-y-1">
            <div className="font-semibold flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Holiday Shift Approval Policy</span>
            </div>
            <p className="text-indigo-800 leading-relaxed">
              Shift requests require Admin review. Once approved, you will be
              officially listed as working on this holiday and receive accrued shift credit.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#3A5D83] hover:bg-[#182E3F] text-white shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Shift Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
