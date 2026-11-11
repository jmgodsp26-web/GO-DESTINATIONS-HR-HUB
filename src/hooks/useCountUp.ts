import { useEffect, useRef, useState } from 'react';
import { countUpValue } from '../utils/brandDisplay';
import { prefersReducedMotion } from '../utils/confetti';

/** Animates a number toward its latest value. Non-numbers and reduced-motion users get the value immediately. */
export function useCountUp(target: number | null, duration = 900): number | null {
  const animate = target !== null && !prefersReducedMotion();
  const [shown, setShown] = useState<number | null>(animate ? 0 : target);
  const current = useRef<number | null>(shown);
  useEffect(() => {
    if (target === null || !Number.isFinite(target) || prefersReducedMotion()) { current.current = target; setShown(target); return; }
    const from = current.current ?? 0;
    if (from === target) { setShown(target); return; }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const value = countUpValue(target, (now - started) / duration, from);
      current.current = value; setShown(value);
      if (value !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}
