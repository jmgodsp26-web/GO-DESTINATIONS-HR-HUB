import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Briefcase, CalendarCheck, CalendarOff, HeartPulse, Plane, Siren, Stethoscope, Sun, type LucideIcon } from 'lucide-react';
import { RING_CIRCUMFERENCE, balanceCardFigures, ringOffset, ticketParts, titleWords } from '../../utils/brandDisplay';
import type { LeaveBalance } from '../../types';
import { useCountUp } from '../../hooks/useCountUp';
import { tiltHandlers } from '../../hooks/useTilt';
import { prefersReducedMotion } from '../../utils/confetti';

/** Consistent page hierarchy without coupling presentation to navigation. */
export function PageHeading({ title, description, eyebrow, badge, icon: Icon }: {
  title: string;
  description: string;
  eyebrow: string;
  badge?: React.ReactNode;
  /** Optional icon shown in the eyebrow pill instead of the dot. */
  icon?: LucideIcon;
}) {
  return (
    <div className="go-page-heading">
      <span className={`go-page-eyebrow${Icon ? ' has-icon' : ''}`}>{Icon && <Icon size={14} aria-hidden="true" />}{eyebrow}</span>
      <div className="go-page-title-row">
        <h1>
          <span className="sr-only">{title}</span>
          <span className="go-title-words" aria-hidden="true">
            {titleWords(title).map(({ word, accent }, index) => (
              <React.Fragment key={index}>
                {index > 0 && ' '}
                <span className={`go-title-word${accent ? ' is-accent' : ''}`} style={{ '--w': index } as React.CSSProperties}>{word}</span>
              </React.Fragment>
            ))}
          </span>
        </h1>
        {badge}
      </div>
      <p>{description}</p>
    </div>
  );
}

/** A small sun that sits beside a greeting. Decorative only. */
export function SunMark() {
  return (
    <svg className="go-sun-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g className="go-sun-rays" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5 32 32M8 32l3.5-3.5M28.5 11.5 32 8" />
      </g>
      <circle cx="20" cy="20" r="8" fill="currentColor" />
    </svg>
  );
}

/** A crescent moon with two stars for evening greetings. Decorative only. */
export function MoonMark() {
  return (
    <svg className="go-sun-mark go-moon-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path className="go-moon-body" d="M27.500 24.800A12 12 0 0 1 15.200 8.500a12.500 12.500 0 1 0 12.300 16.300z" fill="currentColor" />
      <path className="go-moon-star" d="M30 6l1.200 3.300 3.300 1.200-3.300 1.200L30 15l-1.200-3.300-3.300-1.200 3.300-1.200z" fill="currentColor" />
      <path className="go-moon-star is-late" d="M22.500 15.500l.800 2.200 2.200.800-2.200.800-.800 2.200-.800-2.200-2.200-.800 2.200-.800z" fill="currentColor" />
    </svg>
  );
}

/** Numbers count up from zero; text values (such as "0/2" or "—") are shown as given. */
function StatValue({ value }: { value: React.ReactNode }) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const shown = useCountUp(numeric);
  if (numeric === null) return <strong>{value}</strong>;
  return <strong><span aria-hidden="true">{shown}</span><span className="sr-only">{numeric}</span></strong>;
}

/** Only actionable metrics are buttons; all values come from the caller's data. */
export function StatCard({ id, label, value, unit, detail, icon: Icon, tone = 'blue', onClick, progress, ring }: {
  id?: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'orange' | 'navy';
  onClick?: () => void;
  progress?: number;
  /** Optional 0–1 ring, for example remaining days of an allowance. */
  ring?: number | null;
}) {
  const content = <>
    <span className="go-stat-top"><span className="go-stat-label">{label}</span><span className="go-stat-icon"><Icon size={18} aria-hidden="true" /></span></span>
    <span className="go-stat-body">
      <span className="go-stat-number"><StatValue value={value} />{unit && <span>{unit}</span>}</span>
      {ring !== undefined && (
        <svg className="go-stat-ring" viewBox="0 0 68 68" aria-hidden="true" focusable="false">
          <circle className="go-stat-ring-track" cx="34" cy="34" r="28" />
          {ring !== null && ring > 0 && <circle className="go-stat-ring-bar" cx="34" cy="34" r="28" strokeDasharray={RING_CIRCUMFERENCE.toFixed(3)} strokeDashoffset={ringOffset(ring)} />}
        </svg>
      )}
    </span>
    <span className="go-stat-footer"><span>{detail}</span>{onClick && <ArrowUpRight size={16} aria-hidden="true" />}</span>
    {progress !== undefined && <span className="go-stat-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></span>}
  </>;
  const className = `go-stat-card go-stat-${tone} go-tilt${ring !== undefined ? ' has-ring' : ''}`;
  return onClick
    ? <button id={id} type="button" className={className} onClick={onClick} {...tiltHandlers()}>{content}</button>
    : <div id={id} className={className} {...tiltHandlers()}>{content}</div>;
}

/** A leave allowance at a glance: remaining days, a ring for the share left, and one line of context. */
export function BalanceCard({ label, icon: Icon, remaining, unit, caption, fraction, inverse = false, onClick }: {
  label: string;
  icon: LucideIcon;
  /** Remaining days, or null when no allowance exists. */
  remaining: number | null;
  unit: string;
  caption: string;
  /** Share of the allowance still available, 0–1. */
  fraction: number;
  inverse?: boolean;
  onClick?: () => void;
}) {
  const shown = useCountUp(remaining);
  const gradient = `go-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const content = <>
    <span className="go-balance-label"><Icon size={18} aria-hidden="true" />{label}</span>
    <span className="go-balance-figure">
      <strong>{remaining === null ? '—' : <><span aria-hidden="true">{shown}</span><span className="sr-only">{remaining}</span></>}</strong>
      <small>{unit}</small>
    </span>
    <svg className="go-balance-ring" viewBox="0 0 68 68" aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F2A548" /><stop offset="1" stopColor="#ED9027" /></linearGradient></defs>
      <circle className="go-balance-ring-track" cx="34" cy="34" r="28" />
      {fraction > 0 && <circle className="go-balance-ring-bar" cx="34" cy="34" r="28" stroke={`url(#${gradient})`} strokeDasharray={RING_CIRCUMFERENCE.toFixed(3)} strokeDashoffset={ringOffset(fraction)} />}
    </svg>
    <span className="go-balance-caption">{caption}</span>
  </>;
  const className = `go-balance-card go-tilt${inverse ? ' is-inverse' : ''}`;
  return onClick
    ? <button type="button" className={className} onClick={onClick} {...tiltHandlers()}>{content}</button>
    : <div className={className} {...tiltHandlers()}>{content}</div>;
}

const LEAVE_ICONS: Record<string, LucideIcon> = {
  'Vacation Leave': Plane, 'Sick Leave': HeartPulse, 'Emergency Leave': Siren, 'Medical Leave': Stethoscope,
  'Unpaid Leave': CalendarOff, 'Holiday Shift Credit': Sun,
};

/** Every leave balance as a ring card, the same cards the dashboard uses. */
export function LeaveBalanceGrid({ balances, onOpen }: { balances: LeaveBalance[]; onOpen?: (balance: LeaveBalance) => void }) {
  return (
    <div className="go-balance-grid">
      {balances.map(balance => (
        <BalanceCard key={balance.id} label={balance.leave_type} icon={LEAVE_ICONS[balance.leave_type] || (balance.leave_type.includes('Leave') ? Briefcase : CalendarCheck)}
          {...balanceCardFigures(balance)} onClick={onOpen ? () => onOpen(balance) : undefined} />
      ))}
    </div>
  );
}

/** A dashboard card with an icon bubble, a title and optional actions. */
export function SectionCard({ icon: Icon, tone = 'orange', title, description, actions, children, className = '', label }: {
  icon: LucideIcon;
  tone?: 'orange' | 'blue';
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={`go-card ${className}`} aria-label={label}>
      <header className="go-card-head">
        <span className={`go-card-bubble is-${tone}`}><Icon size={20} aria-hidden="true" /></span>
        <div className="go-card-title"><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {actions && <div className="go-card-actions">{actions}</div>}
      </header>
      <div className="go-card-body">{children}</div>
    </section>
  );
}

/** A small calendar tile for a stored date. Decorative: the date is also written in the row text. */
export function DateTile({ date }: { date: string }) {
  const { month, day } = ticketParts(date);
  return <span className="go-date-tile" aria-hidden="true"><small>{month}</small><b>{day}</b></span>;
}

const STATUS_CLASS: Record<string, string> = { Pending: 'is-pending', Approved: 'is-approved', Rejected: 'is-rejected', Cancelled: 'is-cancelled' };
export function StatusPill({ status }: { status: string }) {
  return <span className={`go-pill ${STATUS_CLASS[status] || 'is-cancelled'}`}>{status}</span>;
}

/**
 * Sections below the first screen glide in when scrolled to. Anything already
 * in view, reduced-motion users and browsers without IntersectionObserver get
 * the content immediately, so nothing can stay hidden.
 */
export function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'waiting' | 'shown'>('idle');
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.94) return;
    setState('waiting');
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setState('shown'); observer.disconnect(); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`${className}${state === 'waiting' ? ' go-reveal' : state === 'shown' ? ' go-reveal is-revealed' : ''}`}>{children}</div>;
}
