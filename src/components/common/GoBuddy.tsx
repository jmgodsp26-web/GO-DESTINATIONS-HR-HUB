import React, { useEffect, useRef, useState } from 'react';
import { launchConfetti, prefersReducedMotion } from '../../utils/confetti';

/** The GO suitcase. Purely decorative art; the wrapping control carries the accessible name. */
export function GoBuddyArt({ className = '', pupilsRef }: { className?: string; pupilsRef?: React.Ref<SVGGElement> }) {
  return (
    <svg className={`go-buddy-art ${className}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <g className="go-buddy-body">
        <rect x="44" y="10" width="32" height="26" rx="10" fill="none" stroke="#CFD7E1" strokeWidth="7" />
        <rect x="14" y="30" width="92" height="72" rx="22" fill="#ED9027" />
        <rect x="14" y="86" width="92" height="8" fill="#F1C48E" />
        <g className="go-buddy-eyes">
          <circle cx="44" cy="54" r="10" fill="#FFFFFF" />
          <circle cx="76" cy="54" r="10" fill="#FFFFFF" />
          <g className="go-buddy-pupils" ref={pupilsRef}>
            <circle cx="44" cy="54" r="5" fill="#182E3F" />
            <circle cx="76" cy="54" r="5" fill="#182E3F" />
          </g>
        </g>
        <path d="M51 71 Q60 80 69 71" fill="none" stroke="#182E3F" strokeWidth="4" strokeLinecap="round" />
        <circle cx="34" cy="106" r="7" fill="#CFD7E1" />
        <circle cx="86" cy="106" r="7" fill="#CFD7E1" />
      </g>
    </svg>
  );
}

/** Eyes follow the pointer; one shared listener, updated at most once per frame. */
function useEyeTracking(pupils: React.RefObject<SVGGElement | null>) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0, x = 0, y = 0;
    const update = () => {
      frame = 0;
      const group = pupils.current, svg = group?.ownerSVGElement;
      if (!group || !svg) return;
      const box = svg.getBoundingClientRect();
      if (!box.width) return;
      const dx = x - (box.left + box.width / 2), dy = y - (box.top + box.height * 0.45);
      const distance = Math.hypot(dx, dy) || 1, reach = Math.min(4.5, distance / 40);
      group.style.transform = `translate(${(dx / distance * reach).toFixed(2)}px, ${(dy / distance * reach).toFixed(2)}px)`;
    };
    const move = (event: PointerEvent) => { x = event.clientX; y = event.clientY; if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame); };
  }, [pupils]);
}

/** A friendly sidebar companion that rotates through short, factual messages. */
export function GoBuddy({ messages, hint = 'Tap me' }: { messages: string[]; hint?: string }) {
  const [index, setIndex] = useState(0);
  const [hop, setHop] = useState(0);
  const pupils = useRef<SVGGElement>(null);
  const artRef = useRef<HTMLSpanElement>(null);
  useEyeTracking(pupils);
  const message = messages.length ? messages[index % messages.length] : '';
  return (
    <button type="button" className="go-buddy" aria-label={`GO buddy: ${message} Show another tip.`}
      onClick={() => { setIndex(i => i + 1); setHop(h => h + 1); launchConfetti(artRef.current, 14); }}>
      <span ref={artRef} className={`go-buddy-figure${hop ? ' is-hopping' : ''}`} key={hop}><GoBuddyArt pupilsRef={pupils} /></span>
      <span className="go-buddy-copy" aria-hidden="true"><span className="go-buddy-message" key={index}>{message}</span><small>{hint}</small></span>
    </button>
  );
}
