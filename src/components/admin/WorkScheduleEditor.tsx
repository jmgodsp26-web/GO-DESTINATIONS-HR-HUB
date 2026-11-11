import React, { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../common/Dialog';
import { api } from '../../services/api';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useToast } from '../../context/ToastContext';
import { WEEKDAYS, companyWorkingDays, scheduleLabel, validateWorkSchedule } from '../../utils/workSchedule';
import type { WorkScheduleRules, WorkScheduleView } from '../../types/workSchedule';
import type { UserProfile } from '../../types';

export function WorkScheduleEditor({ employee, onClose, onSaved }: {
  employee: UserProfile; onClose: () => void; onSaved?: () => void;
}) {
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState<WorkScheduleView | null>(null);
  const [rules, setRules] = useState<WorkScheduleRules>({ regular_days: null, exceptions: [] });
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const [date, setDate] = useState(''), [working, setWorking] = useState(true);
  const original: WorkScheduleRules = loaded?.schedule || { regular_days: null, exceptions: [] };
  const dirty = Boolean(loaded && (JSON.stringify({ regular_days: original.regular_days, exceptions: original.exceptions }) !== JSON.stringify(rules) || reason || date));
  const canClose = useUnsavedChanges(dirty, busy);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.getWorkSchedule(employee.id).then(view => {
      if (!active) return;
      setLoaded(view);
      setRules({ regular_days: view.schedule?.regular_days ?? null, exceptions: view.schedule?.exceptions || [] });
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee.id, retry]);

  function addDate() {
    try {
      const next = validateWorkSchedule({ ...rules, exceptions: [...rules.exceptions, { date, working }] });
      setRules(next); setDate(''); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!loaded) return;
    setError('');
    if (date) { setError('Click Add date to include your selected date, or clear it before saving.'); return; }
    setBusy(true);
    try {
      const saved = await api.updateWorkSchedule(employee.id, { ...validateWorkSchedule(rules), reason,
        expected_revision: loaded.schedule?.revision || null, expected_workweek: loaded.company_workweek });
      showToast({ type: 'success', title: 'Work schedule saved', message: saved.pending_requests_affected
        ? `${employee.full_name}: ${saved.pending_requests_affected} pending request(s) need to be cancelled and resubmitted. Approved leave and balances are unchanged.`
        : `${employee.full_name}'s working days are updated. Approved leave and balances are unchanged.` });
      onSaved?.(); onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <Dialog title={`Work schedule — ${employee.full_name}`} onClose={() => { if (canClose()) onClose(); }} busy={busy}>
    <form onSubmit={save}>
      <div className="go-dialog-body space-y-6">
        <p className="text-sm text-slate-600">Set the days this employee works so leave is counted correctly, including weekend shifts.</p>
        {error && <div role="alert" className="go-live-audience border-rose-300 text-rose-800">{error}</div>}
        {loading && <p role="status">Loading work schedule…</p>}
        {!loading && !loaded && <button type="button" className="go-button go-button-secondary" onClick={() => setRetry(n => n + 1)}>Retry</button>}
        {loaded && <fieldset disabled={busy || loading} className="space-y-6 min-w-0">
          <section className="space-y-3" aria-labelledby="regular-days-title">
            <h3 id="regular-days-title" className="font-bold">Regular working days</h3>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={rules.regular_days === null}
                onChange={e => setRules({ ...rules, regular_days: e.target.checked ? null : companyWorkingDays(loaded.company_workweek).sort((a, b) => a - b) })} />
              <span>Use company schedule <strong>({loaded.company_workweek})</strong></span>
            </label>
            {rules.regular_days !== null && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAYS.map(({ day, label }) => <label key={day} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input type="checkbox" checked={rules.regular_days!.includes(day)} onChange={e => setRules({ ...rules,
                  regular_days: (e.target.checked ? [...rules.regular_days!, day] : rules.regular_days!.filter(d => d !== day)).sort((a, b) => a - b) })} />{label}
              </label>)}
            </div>}
            <p className="text-sm text-slate-500">For occasional weekend shifts, keep the usual schedule and add the specific dates below.</p>
          </section>
          <section className="space-y-3" aria-labelledby="date-changes-title">
            <h3 id="date-changes-title" className="font-bold flex items-center gap-2"><CalendarDays size={18} />Date changes</h3>
            <p className="text-sm text-slate-600">Mark the weekend shift as <strong>Working day</strong> and the replacement weekday as <strong>Day off</strong>.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="go-workflow-label">Date<input type="date" className="go-filter-input" value={date} onChange={e => setDate(e.target.value)} /></label>
              <label className="go-workflow-label">Schedule<select className="go-filter-input" value={working ? 'working' : 'off'} onChange={e => setWorking(e.target.value === 'working')}><option value="working">Working day</option><option value="off">Day off</option></select></label>
            </div>
            <button type="button" className="go-button go-button-secondary" onClick={addDate} disabled={!date}><Plus size={16} />Add date</button>
            {rules.exceptions.length ? <ul className="space-y-2 max-h-64 overflow-y-auto" aria-label="Saved date changes to apply">
              {rules.exceptions.map(entry => <li key={entry.date} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl p-3">
                <div><strong className="text-sm">{new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(entry.date + 'T00:00:00Z'))}</strong><p className="text-sm text-slate-600">{entry.working ? 'Working day' : 'Day off'}</p></div>
                <button type="button" className="go-button go-button-secondary" aria-label={`Remove date change for ${entry.date}`} onClick={() => setRules({ ...rules, exceptions: rules.exceptions.filter(e => e.date !== entry.date) })}><Trash2 size={16} /></button>
              </li>)}
            </ul> : <p className="text-sm text-slate-500">No date changes added.</p>}
          </section>
          <div className="go-live-audience space-y-2">
            <p><strong>Regular schedule:</strong> {scheduleLabel(rules, loaded.company_workweek) || 'Select working days'}</p>
            <p><strong>Holiday calendar:</strong> {loaded.holiday_calendar.country}. Applicable public holidays remain excluded from leave.</p>
            <p>Saving will not change leave balances. Changes that affect approved leave are blocked. Affected pending requests must be cancelled and resubmitted.</p>
          </div>
          <label className="go-workflow-label">Reason for this change<textarea required maxLength={500} rows={2} className="go-filter-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="For example: Weekend coverage and replacement day off" /></label>
        </fieldset>}
      </div>
      <footer className="flex flex-wrap justify-end gap-3"><button type="button" className="go-button go-button-secondary" disabled={busy} onClick={() => { if (canClose()) onClose(); }}>Cancel</button><button type="submit" className="go-button go-button-primary" disabled={!loaded || loading || busy || !dirty}>{busy ? 'Saving…' : 'Save work schedule'}</button></footer>
    </form>
  </Dialog>;
}
