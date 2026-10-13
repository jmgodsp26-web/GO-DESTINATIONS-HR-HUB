import React from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

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
      <div className="go-page-title-row"><h1>{title}</h1>{badge}</div>
      <p>{description}</p>
    </div>
  );
}

/** Only actionable metrics are buttons; all values come from the caller's data. */
export function StatCard({ id, label, value, unit, detail, icon: Icon, tone = 'blue', onClick, progress }: {
  id?: string;
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'green' | 'orange' | 'navy';
  onClick?: () => void;
  progress?: number;
}) {
  const content = <>
    <span className="go-stat-top"><span className="go-stat-label">{label}</span><span className="go-stat-icon"><Icon size={18} aria-hidden="true" /></span></span>
    <span className="go-stat-number"><strong>{value}</strong>{unit && <span>{unit}</span>}</span>
    <span className="go-stat-footer"><span>{detail}</span>{onClick && <ArrowUpRight size={16} aria-hidden="true" />}</span>
    {progress !== undefined && <span className="go-stat-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></span>}
  </>;
  const className = `go-stat-card go-stat-${tone}`;
  return onClick
    ? <button id={id} type="button" className={className} onClick={onClick}>{content}</button>
    : <div id={id} className={className}>{content}</div>;
}
