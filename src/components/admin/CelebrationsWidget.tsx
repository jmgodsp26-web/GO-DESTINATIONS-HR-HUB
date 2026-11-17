import React, { useState, useMemo } from 'react';
import { UserProfile, LeaveBalance } from '../../types';
import { goAnniversaryLabel } from '../../utils/celebrations';
import { Cake, Award, Mail, Gift, PartyPopper, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { DateTile } from '../common/WorkspaceUI';
import { formatDateRange } from '../../utils/brandDisplay';
import { launchConfetti } from '../../utils/confetti';

export interface CelebrationsWidgetProps {
  employees: (UserProfile & { leave_balances?: LeaveBalance[] })[];
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

export type CelebrationType = 'birthday' | 'anniversary';

export interface CelebrationItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string;
  employeeAvatar: string;
  employeeJobTitle: string;
  type: CelebrationType;
  rawDate?: string; // Hire date only; birthday cards never include a birth year.
  nextOccurrenceDate: Date;
  nextOccurrenceStr: string; // "Aug 26"
  daysUntil: number; // 0 = today, 1 = tomorrow, etc.
  yearsCount?: number; // Completed service years for work anniversaries only.
  milestoneTitle: string;
}

export const CelebrationsWidget: React.FC<CelebrationsWidgetProps> = ({
  employees,
  onNavigateTab,
  className = '',
}) => {
  const [filterType, setFilterType] = useState<'all' | 'birthday' | 'anniversary'>('all');
  const [daysRange, setDaysRange] = useState<number>(30); // 30, 60, 90, 365
  const [wishedEmployees, setWishedEmployees] = useState<Record<string, boolean>>({});

  // Compute upcoming celebration items
  const celebrations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    const items: CelebrationItem[] = [];

    employees.forEach((emp) => {
      // 1. Check Birthday
      const dobStr = emp.date_of_birth || emp.birthday;
      if (dobStr && dobStr.includes('-')) {
        const parts = dobStr.split('-');
        if (parts.length >= 3) {
          const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          const birthDay = parseInt(parts[2], 10);

          if (!isNaN(birthMonth) && !isNaN(birthDay)) {
            // Next occurrence this year
            let nextDob = new Date(currentYear, birthMonth, birthDay);
            nextDob.setHours(0, 0, 0, 0);

            // If it already passed this year, the next one is next year
            if (nextDob.getTime() < today.getTime()) {
              nextDob = new Date(currentYear + 1, birthMonth, birthDay);
            }

            const diffTime = nextDob.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));

            items.push({
              id: `${emp.id}-birthday`,
              employeeId: emp.id,
              employeeName: emp.full_name,
              employeeEmail: emp.email,
              employeeDepartment: emp.department,
              employeeAvatar: emp.avatar_url || '',
              employeeJobTitle: emp.job_title,
              type: 'birthday',
              nextOccurrenceDate: nextDob,
              nextOccurrenceStr: nextDob.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
              daysUntil,
              milestoneTitle: daysUntil === 0 ? 'Birthday today!' : 'Upcoming birthday',
            });
          }
        }
      }

      // 2. Check Work Anniversary
      const hireStr = emp.hire_date || emp.date_joined;
      if (hireStr && hireStr.includes('-')) {
        const parts = hireStr.split('-');
        if (parts.length >= 3) {
          const hireYear = parseInt(parts[0], 10);
          const hireMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          const hireDay = parseInt(parts[2], 10);

          if (!isNaN(hireMonth) && !isNaN(hireDay) && !isNaN(hireYear)) {
            let nextHire = new Date(currentYear, hireMonth, hireDay);
            nextHire.setHours(0, 0, 0, 0);

            if (nextHire.getTime() < today.getTime()) {
              nextHire = new Date(currentYear + 1, hireMonth, hireDay);
            }

            const diffTime = nextHire.getTime() - today.getTime();
            const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
            const completedYears = nextHire.getFullYear() - hireYear;

            // Only show anniversaries of at least 1 year (or future 1st anniversary)
            if (completedYears > 0) {
              items.push({
                id: `${emp.id}-anniversary`,
                employeeId: emp.id,
                employeeName: emp.full_name,
                employeeEmail: emp.email,
                employeeDepartment: emp.department,
                employeeAvatar: emp.avatar_url || '',
                employeeJobTitle: emp.job_title,
                type: 'anniversary',
                rawDate: hireStr,
                nextOccurrenceDate: nextHire,
                nextOccurrenceStr: nextHire.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
                daysUntil,
                yearsCount: completedYears,
                milestoneTitle: daysUntil === 0 ? `Happy ${goAnniversaryLabel(completedYears)}!` : `Upcoming ${goAnniversaryLabel(completedYears)}`,
              });
            }
          }
        }
      }
    });

    // Sort chronologically by days until next occurrence
    return items.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [employees]);

  // Filtered by type and days range
  const filteredCelebrations = useMemo(() => {
    return celebrations.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      return item.daysUntil <= daysRange;
    });
  }, [celebrations, filterType, daysRange]);

  // Today's celebrations
  const todayCelebrations = useMemo(() => {
    return celebrations.filter((item) => item.daysUntil === 0);
  }, [celebrations]);

  // Monthly stats
  const thisMonthStats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const birthdaysThisMonth = celebrations.filter(
      (c) =>
        c.type === 'birthday' &&
        c.nextOccurrenceDate.getMonth() === currentMonth &&
        c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;

    const anniversariesThisMonth = celebrations.filter(
      (c) =>
        c.type === 'anniversary' &&
        c.nextOccurrenceDate.getMonth() === currentMonth &&
        c.nextOccurrenceDate.getFullYear() === currentYear
    ).length;

    return { birthdaysThisMonth, anniversariesThisMonth };
  }, [celebrations]);

  const handleSendWish = (item: CelebrationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setWishedEmployees((prev) => ({ ...prev, [item.id]: true }));

    const subject =
      item.type === 'birthday'
        ? `Happy Birthday, ${item.employeeName.split(' ')[0]}! 🎂🎉`
        : `Happy ${goAnniversaryLabel(item.yearsCount)}, ${item.employeeName.split(' ')[0]}! 🏆🎖️`;

    const body =
      item.type === 'birthday'
        ? `Hi ${item.employeeName.split(' ')[0]},\n\nYour GO team wishes you a wonderful birthday! Thank you for everything you contribute to our team.\n\nBest regards,\nHR Team`
        : `Hi ${item.employeeName.split(' ')[0]},\n\nHappy ${goAnniversaryLabel(item.yearsCount)}! Thank you for your continued dedication, leadership, and impact on our team.\n\nBest regards,\nHR Team`;

    window.location.href = `mailto:${encodeURIComponent(item.employeeEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'GO';
  const localIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const countdown = (days: number) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`);
  const wish = (item: CelebrationItem, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!wishedEmployees[item.id]) launchConfetti(e.currentTarget, 26);
    handleSendWish(item, e);
  };

  return (
    <section id="admin-celebrations-widget" className={`go-card go-milestones ${className}`} aria-labelledby="admin-milestones-title">
      <header className="go-card-head">
        <span className="go-card-bubble is-orange"><PartyPopper size={20} aria-hidden="true" /></span>
        <div className="go-card-title">
          <h2 id="admin-milestones-title">Team milestones {todayCelebrations.length > 0 && <span className="go-chip is-pending">{todayCelebrations.length} today</span>}</h2>
          <p>Upcoming birthdays and work anniversaries from employee profiles.</p>
        </div>
        <div className="go-card-actions go-milestone-month" aria-label="This month">
          <span className="go-chip"><Cake className="w-3.5 h-3.5" aria-hidden="true" />{thisMonthStats.birthdaysThisMonth} {thisMonthStats.birthdaysThisMonth === 1 ? 'birthday' : 'birthdays'} this month</span>
          <span className="go-chip is-type"><Award className="w-3.5 h-3.5" aria-hidden="true" />{thisMonthStats.anniversariesThisMonth} {thisMonthStats.anniversariesThisMonth === 1 ? 'anniversary' : 'anniversaries'} this month</span>
        </div>
      </header>

      <div className="go-card-body">
        {todayCelebrations.length > 0 && (
          <div className="go-milestone-today" aria-label="Celebrating today">
            {todayCelebrations.map((item) => (
              <article key={item.id} className="go-milestone-spotlight">
                <span className="go-milestone-avatar">
                  {item.employeeAvatar && item.employeeAvatar.trim()
                    ? <img src={item.employeeAvatar} alt="" />
                    : initials(item.employeeName)}
                  <i aria-hidden="true">{item.type === 'birthday' ? <Cake size={12} /> : <Award size={12} />}</i>
                </span>
                <span className="go-milestone-copy">
                  <strong>{item.employeeName}</strong>
                  <span>{item.milestoneTitle}</span>
                  <small>{[item.employeeDepartment, item.employeeJobTitle].filter(Boolean).join(' · ')}</small>
                </span>
                <button
                  type="button"
                  id={`wish-btn-${item.id}`}
                  onClick={(e) => wish(item, e)}
                  className={`go-button go-button-sm ${wishedEmployees[item.id] ? 'go-button-secondary is-done' : 'go-button-navy'}`}
                >
                  {wishedEmployees[item.id] ? <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />Wished</> : <><Gift className="w-3.5 h-3.5" aria-hidden="true" />Send wishes</>}
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="go-milestone-controls">
          <div className="go-segmented is-small" role="group" aria-label="Milestone type">
            <button type="button" onClick={() => setFilterType('all')} aria-pressed={filterType === 'all'}>
              All ({celebrations.length})
            </button>
            <button type="button" onClick={() => setFilterType('birthday')} aria-pressed={filterType === 'birthday'}>
              <Cake className="w-3 h-3" aria-hidden="true" />
              <span>Birthdays ({celebrations.filter((c) => c.type === 'birthday').length})</span>
            </button>
            <button type="button" onClick={() => setFilterType('anniversary')} aria-pressed={filterType === 'anniversary'}>
              <Award className="w-3 h-3" aria-hidden="true" />
              <span>Anniversaries ({celebrations.filter((c) => c.type === 'anniversary').length})</span>
            </button>
          </div>
          <label className="go-milestone-range">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Show</span>
            <select value={daysRange} onChange={(e) => setDaysRange(parseInt(e.target.value, 10))}>
              <option value={14}>Next 14 days</option>
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
              <option value={365}>Full year</option>
            </select>
          </label>
        </div>

        {filteredCelebrations.length === 0 ? (
          <div className="go-card-empty">
            <Cake className="w-7 h-7" aria-hidden="true" />
            <p><strong>No celebrations in this window</strong>No birthdays or work anniversaries match this filter in the next {daysRange} days.</p>
          </div>
        ) : (
          <ul className="go-row-list go-milestone-list">
            {filteredCelebrations.map((item) => (
              <li key={item.id} className={`go-row${item.daysUntil === 0 ? ' is-today' : ''}`}>
                <DateTile date={localIso(item.nextOccurrenceDate)} />
                <span className="go-row-copy">
                  <strong>
                    {item.employeeName}
                    <span className={`go-chip ${item.type === 'birthday' ? '' : 'is-type'}`}>{item.type === 'birthday' ? 'Birthday' : 'Work anniversary'}</span>
                  </strong>
                  <small>
                    {item.milestoneTitle}
                    {item.type === 'birthday' ? ` · ${item.nextOccurrenceStr}` : item.rawDate ? ` · Joined ${formatDateRange(item.rawDate, item.rawDate)}` : ''}
                    {item.employeeDepartment ? ` · ${item.employeeDepartment}` : ''}
                  </small>
                </span>
                <span className={`go-pill ${item.daysUntil === 0 ? 'is-pending' : item.daysUntil <= 7 ? 'is-approved' : 'is-cancelled'}`}>{countdown(item.daysUntil)}</span>
                <button
                  type="button"
                  className={`go-icon-button${wishedEmployees[item.id] ? ' is-done' : ''}`}
                  onClick={(e) => wish(item, e)}
                  aria-label={wishedEmployees[item.id] ? `Wishes sent to ${item.employeeName}` : `Send wishes to ${item.employeeName}`}
                  title={`Send celebration wish to ${item.employeeName}`}
                >
                  {wishedEmployees[item.id] ? <CheckCircle2 size={16} aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {onNavigateTab && (
          <footer className="go-milestone-foot">
            <span>Dates come from employee profiles.</span>
            <button type="button" className="go-button go-button-quiet" onClick={() => onNavigateTab('employees')}>
              Manage employee records <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </footer>
        )}
      </div>
    </section>
  );
};
