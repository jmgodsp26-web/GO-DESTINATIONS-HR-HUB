import React from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { RING_CIRCUMFERENCE, ringOffset, titleWords } from '../../utils/brandDisplay';
import { useCountUp } from '../../hooks/useCountUp';
import { tiltHandlers } from '../../hooks/useTilt';

/** Consistent page hierarchy without coupling presentation to navigation. */
export function PageHeading({ title, description, eyebrow, badge }: {
  title: string;
  description: string;
  eyebrow: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="go-page-heading">
      <span className="go-page-eyebrow">{eyebrow}</span>
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
