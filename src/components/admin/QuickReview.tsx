import React, { useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, ExternalLink, Paperclip, Users, X } from 'lucide-react';
import type { LeaveBalance, LeaveRequest } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDayCount, formatTripRange, reviewOutlook } from '../../utils/brandDisplay';
import { launchConfetti, prefersReducedMotion } from '../../utils/confetti';

const initials = (name?: string) => name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'HR';
const days = (r: LeaveRequest) => r.is_half_day ? '0.5 day' : `${r.total_days} ${r.total_days === 1 ? 'day' : 'days'}`;

/**
 * One pending request with an inline decision panel. The server applies the same
 * rules as the full review page; this only saves HR a trip for routine approvals.
 */
export function QuickReviewItem({ request, balance, approved, canReview, onOpenFull, onReviewed }: {
  request: LeaveRequest;
  balance?: LeaveBalance;
  approved: LeaveRequest[];
  canReview: boolean;
  onOpenFull: () => void;
  onReviewed: () => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stamped, setStamped] = useState(false);
  const stamp = useRef<HTMLSpanElement>(null);
  const panelId = useId(), noteId = useId();
  const outlook = reviewOutlook(request, balance, approved);
  const dept = request.employee_department || 'this department';
  const blocked = Boolean(request.schedule_changed) || !outlook.enough;

  async function approve() {
    setBusy(true); setError('');
    try {
      await api.reviewLeaveRequest(request.id, 'Approved');
      setStamped(true); setOpen(false);
      requestAnimationFrame(() => launchConfetti(stamp.current, 44));
      showToast({ type: 'success', title: 'Leave approved', message: `${request.employee_name} has been notified.` });
      window.setTimeout(onReviewed, prefersReducedMotion() ? 150 : 1300);
    } catch (e) {
      setError((e as Error).message || 'The request could not be approved. Please try again.');
      setBusy(false);
    }
  }

  async function reject(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api.reviewLeaveRequest(request.id, 'Rejected', note.trim() || undefined);
      showToast({ type: 'info', title: 'Request rejected', message: `${request.employee_name} has been notified.` });
      onReviewed();
    } catch (e) {
      setError((e as Error).message || 'The request could not be rejected. Please try again.');
      setBusy(false);
    }
  }

  return (
    <motion.li layout="position" exit={{ opacity: 0, height: 0, transition: { duration: 0.35 } }}
      className={`go-review-item${open ? ' is-open' : ''}${stamped ? ' is-approved' : ''}`}>
      <div className="go-review-line">
        {request.employee_avatar?.trim()
          ? <img src={request.employee_avatar} alt="" className="go-review-avatar" />
          : <span className="go-review-avatar" aria-hidden="true">{initials(request.employee_name)}</span>}
        <div className="go-review-copy">
          <p className="go-review-name"><strong>{request.employee_name}</strong>{request.employee_department && <small>{request.employee_department}</small>}</p>
          <div className="go-review-chips">
            <span className="go-chip is-type">{request.leave_type}</span>
            <span className="go-chip tabular-nums">{formatTripRange(request.start_date, request.end_date)}, {request.start_date.slice(0, 4)}</span>
            <span className="go-chip tabular-nums">{days(request)}</span>
          </div>
          {request.reason && <q className="go-review-reason">{request.reason}</q>}
          {request.attachment_name && <p className="go-review-attachment"><Paperclip size={13} aria-hidden="true" />Attached: {request.attachment_name}</p>}
        </div>
        <button type="button" className="go-button go-button-navy go-review-toggle" disabled={busy || stamped}
          aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(o => !o); setRejecting(false); setError(''); }}>
          Review request<ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div id={panelId} className="go-review-panel" inert={!open}>
        <div>
          <div className="go-review-panel-inner">
            <div className="go-review-facts">
              <p>
                <strong>{!outlook.paid ? 'Unpaid leave: no paid balance is deducted.'
                  : outlook.enough ? `After approval: ${outlook.after} of ${outlook.allocated ?? 0} ${request.leave_type} days left`
                    : `Not enough balance: ${formatDayCount(Math.max(0, outlook.remaining ?? 0))} of ${request.leave_type} left`}</strong>
                <small><Users size={13} aria-hidden="true" />{outlook.overlaps.length
                  ? `Also off in ${dept}: ${outlook.overlaps.join(', ')}`
                  : `No one else in ${dept} has approved leave on these dates.`}</small>
              </p>
              {request.schedule_changed && <p className="go-review-warning" role="alert"><AlertTriangle size={15} aria-hidden="true" />The working days changed after this was submitted. Open the full review to resolve it.</p>}
            </div>
            {!canReview ? <p className="go-review-note">Another administrator must review your own leave request.</p>
              : rejecting ? (
                <form className="go-review-reject" onSubmit={reject}>
                  <label htmlFor={noteId}>Reason for {request.employee_name.split(' ')[0]} (optional)</label>
                  <textarea id={noteId} rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: the team is fully booked that week." />
                  <div className="go-review-actions">
                    <button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => setRejecting(false)}>Back</button>
                    <button type="submit" className="go-button go-button-danger" disabled={busy}><X size={16} aria-hidden="true" />{busy ? 'Rejecting…' : 'Confirm rejection'}</button>
                  </div>
                </form>
              ) : (
                <div className="go-review-actions">
                  <button type="button" className="go-button go-button-quiet" onClick={onOpenFull}><ExternalLink size={15} aria-hidden="true" />Full review</button>
                  <button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => setRejecting(true)}><X size={16} aria-hidden="true" />Reject</button>
                  <button type="button" className="go-button go-button-primary" disabled={busy || blocked} onClick={approve}><Check size={16} aria-hidden="true" />{busy ? 'Approving…' : 'Approve'}</button>
                </div>
              )}
            {error && <p role="alert" className="go-field-error">{error}</p>}
          </div>
        </div>
      </div>
      <span ref={stamp} className="go-stamp" aria-hidden="true">Approved</span>
    </motion.li>
  );
}
