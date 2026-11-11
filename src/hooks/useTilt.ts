import type React from 'react';
import { prefersReducedMotion } from '../utils/confetti';

/** Pointer handlers for a gentle 3D tilt and light glare. Styling lives in the `.go-tilt` CSS. */
export function tiltHandlers(strength = 7): Pick<React.HTMLAttributes<HTMLElement>, 'onPointerMove' | 'onPointerLeave'> {
  return {
    onPointerMove(event) {
      if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
      const element = event.currentTarget, box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
      element.style.setProperty('--tilt-x', `${((0.5 - y) * strength).toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${((x - 0.5) * strength).toFixed(2)}deg`);
      element.style.setProperty('--glare-x', `${Math.round(x * 100)}%`);
      element.style.setProperty('--glare-y', `${Math.round(y * 100)}%`);
    },
    onPointerLeave(event) {
      const style = event.currentTarget.style;
      style.setProperty('--tilt-x', '0deg');
      style.setProperty('--tilt-y', '0deg');
    },
  };
}
