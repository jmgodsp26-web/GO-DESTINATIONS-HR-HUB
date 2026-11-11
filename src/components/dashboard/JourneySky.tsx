import React, { useId } from 'react';
import { useReducedMotion } from 'motion/react';
import { countdownLabel, formatShortDate, formatTripRange } from '../../utils/brandDisplay';

/**
 * Decorative sky for the personal banner: a flight from today to the next
 * approved time off. The same facts are written out in the banner text, so
 * the drawing is hidden from assistive technology.
 */
export function JourneySky({ today, trip }: { today: string; trip: { start: string; end: string; current: boolean } | null }) {
  const reduceMotion = useReducedMotion();
  const routeId = `go-route-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const route = 'M70 150 C 200 4, 420 8, 560 70';
  const title = trip
    ? trip.current ? `On leave until ${formatShortDate(trip.end)}` : `Next time off · ${formatTripRange(trip.start, trip.end)}`
    : 'Plan your next break';
  const detail = trip ? (trip.current ? 'Enjoy the break' : countdownLabel(today, trip.start)) : 'Request leave to set a date';
  const width = Math.max(170, Math.max(title.length * 7.4, detail.length * 6.6) + 36);
  const x = Math.min(560 - width / 2, 652 - width), cx = x + width / 2;
  return (
    <svg className="go-hero-sky" viewBox="0 0 660 204" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
      <g className="go-sky-far">
        <g className="go-sky-cloud" fill="#FFFFFF" opacity=".09"><ellipse cx="250" cy="92" rx="46" ry="15" /><ellipse cx="278" cy="82" rx="26" ry="15" /><ellipse cx="232" cy="84" rx="20" ry="11" /></g>
        <g className="go-sky-cloud is-slow" fill="#FFFFFF" opacity=".07"><ellipse cx="470" cy="176" rx="56" ry="16" /><ellipse cx="502" cy="164" rx="30" ry="16" /><ellipse cx="446" cy="168" rx="22" ry="12" /></g>
        <g className="go-sky-cloud is-slower" fill="#FFFFFF" opacity=".06"><ellipse cx="140" cy="188" rx="40" ry="12" /><ellipse cx="164" cy="180" rx="22" ry="12" /></g>
      </g>
      <g className="go-sky-mid" fill="#F1C48E">
        <path className="go-sky-star" d="M330 70l1.8 4.7 4.7 1.8-4.7 1.8-1.8 4.7-1.8-4.7-4.7-1.8 4.7-1.8z" />
        <path className="go-sky-star" style={{ animationDelay: '.9s' }} d="M628 150l1.5 3.900 3.900 1.500-3.900 1.500-1.500 3.900-1.500-3.900-3.900-1.500 3.900-1.500z" />
        <path className="go-sky-star" style={{ animationDelay: '1.6s' }} d="M190 96l1.3 3.400 3.400 1.300-3.400 1.300-1.300 3.400-1.300-3.400-3.400-1.300 3.400-1.300z" />
        <path className="go-sky-star" style={{ animationDelay: '.4s' }} d="M440 120l1.2 3.100 3.100 1.200-3.100 1.200-1.200 3.100-1.200-3.100-3.100-1.200 3.100-1.200z" />
      </g>
      <g className="go-sky-route">
        <path id={routeId} d={route} fill="none" stroke="#CFD7E1" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 10" />
        <path d={route} fill="none" stroke="#ED9027" strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={reduceMotion ? 0 : 1}>
          {!reduceMotion && <>
            <animate attributeName="stroke-dashoffset" values="1;0;0" keyTimes="0;0.72;1" calcMode="spline" keySplines=".4 0 .2 1;0 0 1 1" dur="7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.86;1" dur="7s" repeatCount="indefinite" />
          </>}
        </path>
        <g className="go-sky-origin">
          <circle cx="70" cy="150" r="6" fill="#182E3F" stroke="#CFD7E1" strokeWidth="2.5" />
          <text x="70" y="178" textAnchor="middle" className="go-sky-label">TODAY</text>
        </g>
        <circle className="go-sky-pulse" cx="560" cy="70" r="9" fill="none" stroke="#ED9027" strokeWidth="2.5" />
        <circle cx="560" cy="70" r="8" fill="#ED9027" stroke="#FFFFFF" strokeWidth="3" />
        <rect x={x} y="92" width={width} height="48" rx="18" fill="#FFFFFF" fillOpacity=".14" stroke="#FFFFFF" strokeOpacity=".3" />
        <text x={cx} y="112" textAnchor="middle" className="go-sky-label is-bright">{title}</text>
        <text x={cx} y="130" textAnchor="middle" className="go-sky-label is-detail">{detail}</text>
        {reduceMotion
          ? <path d="M-11 -8 L13 0 L-11 8 L-5 0 Z" fill="#FFFFFF" transform="translate(540 60) rotate(26)" />
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
