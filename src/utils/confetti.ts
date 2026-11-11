/** A short confetti burst in GO colors. Draws on one temporary canvas and removes it when done. */
const COLORS = ['#ED9027', '#F1C48E', '#182E3F', '#3A5D83', '#CFD7E1', '#F8DEC1'];

interface Piece { x: number; y: number; vx: number; vy: number; size: number; color: string; angle: number; spin: number; age: number; shape: number }

let canvas: HTMLCanvasElement | null = null;
let pieces: Piece[] = [];
let frame = 0;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureCanvas(): CanvasRenderingContext2D | null {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'go-confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
  }
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(innerWidth * ratio) || canvas.height !== Math.round(innerHeight * ratio)) {
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
  }
  const context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function draw() {
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;
  context.clearRect(0, 0, innerWidth, innerHeight);
  pieces = pieces.filter(p => p.age < 110 && p.y < innerHeight + 40);
  for (const p of pieces) {
    p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.angle += p.spin; p.age++;
    context.save();
    context.globalAlpha = Math.max(0, 1 - p.age / 110);
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    context.fillStyle = p.color;
    if (p.shape === 0) context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else if (p.shape === 1) { context.beginPath(); context.arc(0, 0, p.size / 2.4, 0, Math.PI * 2); context.fill(); }
    else { context.beginPath(); context.moveTo(0, -p.size / 2); context.lineTo(p.size / 2, p.size / 2); context.lineTo(-p.size / 2, p.size / 2); context.closePath(); context.fill(); }
    context.restore();
  }
  if (pieces.length) frame = requestAnimationFrame(draw);
  else { frame = 0; canvas.remove(); canvas = null; }
}

/** Bursts from a viewport point, or from the centre of an element. Does nothing for reduced-motion users. */
export function launchConfetti(origin: { x: number; y: number } | Element | null | undefined, count = 36): void {
  if (typeof window === 'undefined' || prefersReducedMotion() || !origin) return;
  let x: number, y: number;
  if (origin instanceof Element) {
    const box = origin.getBoundingClientRect();
    x = box.left + box.width / 2; y = box.top + box.height / 2;
  } else { x = origin.x; y = origin.y; }
  if (!ensureCanvas()) return;
  for (let i = 0; i < count; i++) {
    pieces.push({ x, y, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, size: Math.random() * 7 + 5,
      color: COLORS[i % COLORS.length], angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.45, age: 0, shape: i % 3 });
  }
  if (!frame) frame = requestAnimationFrame(draw);
}
