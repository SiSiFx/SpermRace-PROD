import type { Vec2 } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function len(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function normalize(v: Vec2): Vec2 {
  const l = len(v.x, v.y);
  if (l <= 1e-6) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}

export function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}
