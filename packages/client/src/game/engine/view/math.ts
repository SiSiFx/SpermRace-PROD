export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalize(x: number, y: number): { x: number; y: number } {
  const l = Math.hypot(x, y);
  if (l <= 1e-6) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function distanceToSegmentSquared(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (x1 + t * (x2 - x1));
  const dy = py - (y1 + t * (y2 - y1));
  return dx * dx + dy * dy;
}

export function timeToClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}
