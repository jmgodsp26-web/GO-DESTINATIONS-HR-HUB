import React, { useId } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatShortDate, formatTripRange } from '../../utils/brandDisplay';

/**
 * Decorative sky for the personal banner: a flight from today to the next
 * approved time off. The same facts are written out in the banner text, so
 * the drawing is hidden from assistive technology.
 */
export function JourneySky({ today, trip }: { today: string; trip: { start: string; end: string; current: boolean } | null }) {
  const reduceMotion = useReducedMotion();
  const routeId = `go-route-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const route = 'M70 150 C 170 40, 370 164, 560 70';
  const destination = trip
    ? trip.current ? `On leave until ${formatShortDate(trip.end)}` : `Next time off · ${formatTripRange(trip.start, trip.end)}`
    : 'Plan your next break';
  const origin = formatShortDate(today).toUpperCase();
  const labelWidth = Math.max(150, destination.length * 7.4 + 34);
  return (
    <svg className="go-hero-sky" viewBox="0 0 660 204" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
      <g className="go-sky-cloud" fill="#FFFFFF" opacity=".09"><ellipse cx="250" cy="42" rx="46" ry="15" /><ellipse cx="278" cy="32" rx="26" ry="15" /><ellipse cx="232" cy="34" rx="20" ry="11" /></g>
      <g className="go-sky-cloud is-slow" fill="#FFFFFF" opacity=".07"><ellipse cx="470" cy="170" rx="56" ry="16" /><ellipse cx="502" cy="158" rx="30" ry="16" /><ellipse cx="446" cy="162" rx="22" ry="12" /></g>
      <g className="go-sky-cloud is-slower" fill="#FFFFFF" opacity=".06"><ellipse cx="140" cy="188" rx="40" ry="12" /><ellipse cx="164" cy="180" rx="22" ry="12" /></g>
      <g fill="#F1C48E">
        <path className="go-sky-star" d="M340 26l1.8 4.7 4.7 1.8-4.7 1.8-1.8 4.7-1.8-4.7-4.7-1.8 4.7-1.8z" />
        <path className="go-sky-star" style={{ animationDelay: '.9s' }} d="M620 132l1.5 3.9 3.9 1.5-3.9 1.5-1.5 3.9-1.5-3.9-3.9-1.5 3.9-1.5z" />
        <path className="go-sky-star" style={{ animationDelay: '1.6s' }} d="M190 96l1.3 3.4 3.4 1.3-3.4 1.3-1.3 3.4-1.3-3.4-3.4-1.3 3.4-1.3z" />
        <path className="go-sky-star" style={{ animationDelay: '.4s' }} d="M430 22l1.2 3.1 3.1 1.2-3.1 1.2-1.2 3.1-1.2-3.1-3.1-1.2 3.1-1.2z" />
      </g>
      <g className="go-sky-route">
      <path id={routeId} d={route} fill="none" stroke="#CFD7E1" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 10" />
      <path d={route} fill="none" stroke="#ED9027" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={reduceMotion ? 0 : 1}>
        {!reduceMotion && <>
          <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.72;1" calcMode="spline" keySplines=".4 0 .2 1;0 0 1 1" dur="7s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.86;1" dur="7s" repeatCount="indefinite" />
        </>}
      </path>
      <circle cx="70" cy="150" r="6" fill="#182E3F" stroke="#CFD7E1" strokeWidth="2.5" />
      <text x="70" y="178" textAnchor="middle" className="go-sky-label">{origin}</text>
      <circle className="go-sky-pulse" cx="560" cy="70" r="9" fill="none" stroke="#ED9027" strokeWidth="2.5" />
      <circle cx="560" cy="70" r="8" fill="#ED9027" stroke="#FFFFFF" strokeWidth="3" />
      <rect x={Math.min(560 - labelWidth / 2, 652 - labelWidth)} y="94" width={labelWidth} height="30" rx="15" fill="#FFFFFF" fillOpacity=".16" stroke="#FFFFFF" strokeOpacity=".3" />
      <text x={Math.min(560, 652 - labelWidth / 2)} y="114" textAnchor="middle" className="go-sky-label is-bright">{destination}</text>
      {reduceMotion
        ? <path d="M-11 -8 L13 0 L-11 8 L-5 0 Z" fill="#FFFFFF" transform="translate(546 76) rotate(-28)" />
        : <g>
          <path d="M-11 -8 L13 0 L-11 8 L-5 0 Z" fill="#FFFFFF" />
          <path d="M-5 0 L13 0" stroke="#ED9027" strokeWidth="1.5" />
          <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" calcMode="spline" keyTimes="0;0.72;1" keyPoints="0;1;1" keySplines=".4 0 .2 1;0 0 1 1">
            <mpath href={`#${routeId}`} />
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.86;1" dur="7s" repeatCount="indefinite" />
        </g>}
      </g>
    </svg>
  );
}
