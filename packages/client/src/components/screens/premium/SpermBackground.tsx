import { useEffect, useRef } from 'react';

const COUNT = 24;
const SPEED_MIN = 220;
const SPEED_MAX = 400;
const TURN_RATE = 2.2;
const STEER_INTERVAL: [number, number] = [0.35, 1.3];
const TRAIL_LIFETIME = 3200;
const TRAIL_SPACING = 6;
const TRAIL_MAX_W = 2;
const TRAIL_MIN_W = 0.5;
const HEAD_RX = 6;
const HEAD_RY = 3.8;
const SELF_IGNORE_MS = 300;
const COLLISION_R = HEAD_RX + 3;

interface TrailPt { x: number; y: number; ts: number; }
interface Sperm {
  x: number; y: number;
  angle: number; target: number;
  speed: number; steerTimer: number;
  trail: TrailPt[]; dist: number;
  alive: boolean; alpha: number; respawnAt: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function spawn(W: number, H: number): Sperm {
  const angle = rand(0, Math.PI * 2);
  return {
    x: rand(W * 0.05, W * 0.95),
    y: rand(H * 0.05, H * 0.95),
    angle, target: angle,
    speed: rand(SPEED_MIN, SPEED_MAX),
    steerTimer: rand(...STEER_INTERVAL),
    trail: [], dist: 0,
    alive: true, alpha: 1, respawnAt: 0,
  };
}

export function SpermBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const entities: Sperm[] = Array.from({ length: COUNT }, () => spawn(W, H));
    let animId = 0, lastTime = 0;

    function update(dt: number, now: number) {
      for (const s of entities) {
        if (!s.alive) {
          s.alpha = Math.max(0, s.alpha - dt * 3.5);
          if (s.alpha <= 0 && now >= s.respawnAt) Object.assign(s, spawn(W, H));
          continue;
        }

        s.steerTimer -= dt;
        if (s.steerTimer <= 0) {
          s.target = s.angle + rand(-Math.PI * 0.8, Math.PI * 0.8);
          s.steerTimer = rand(...STEER_INTERVAL);
        }

        // Wall avoidance
        const m = 55;
        if (s.x < m)         s.target = rand(-0.4, 0.4);
        else if (s.x > W - m) s.target = Math.PI + rand(-0.4, 0.4);
        if (s.y < m)         s.target = Math.PI * 0.5 + rand(-0.4, 0.4);
        else if (s.y > H - m) s.target = -Math.PI * 0.5 + rand(-0.4, 0.4);

        let diff = s.target - s.angle;
        while (diff > Math.PI)  diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.angle += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);

        const mx = Math.cos(s.angle) * s.speed * dt;
        const my = Math.sin(s.angle) * s.speed * dt;
        s.x = Math.max(0, Math.min(W, s.x + mx));
        s.y = Math.max(0, Math.min(H, s.y + my));

        s.dist += Math.hypot(mx, my);
        if (s.dist >= TRAIL_SPACING) {
          s.trail.push({ x: s.x, y: s.y, ts: now });
          s.dist = 0;
        }
        while (s.trail.length > 0 && now - s.trail[0].ts > TRAIL_LIFETIME) s.trail.shift();

        // Collision
        for (const other of entities) {
          if (!other.alive) continue;
          for (const pt of other.trail) {
            if (other === s && now - pt.ts < SELF_IGNORE_MS) continue;
            const dx = s.x - pt.x, dy = s.y - pt.y;
            if (dx * dx + dy * dy < COLLISION_R * COLLISION_R) {
              s.alive = false;
              s.respawnAt = now + rand(500, 1400);
              break;
            }
          }
          if (!s.alive) break;
        }
      }
    }

    function draw(now: number) {
      if (!canvas) return;
      ctx.clearRect(0, 0, W, H);

      for (const s of entities) {
        const base = s.alpha * 0.11;
        if (base <= 0.005) continue;

        // Trail
        if (s.trail.length >= 2) {
          const n = s.trail.length;
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          for (let i = 1; i < n; i++) {
            const prev = s.trail[i - 1];
            const cur  = s.trail[i];
            const t    = i / (n - 1);
            const lw   = TRAIL_MIN_W + (TRAIL_MAX_W - TRAIL_MIN_W) * t;
            const age  = now - cur.ts;
            const fade = age > TRAIL_LIFETIME * 0.78
              ? 1 - (age - TRAIL_LIFETIME * 0.78) / (TRAIL_LIFETIME * 0.22)
              : 1;
            ctx.strokeStyle = `rgba(255,255,255,${base * fade})`;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(cur.x, cur.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Head
        if (s.alpha > 0.05) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(s.angle);
          ctx.beginPath();
          ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${Math.min(1, base * 4.5)})`;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    function loop(time: number) {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      update(dt, time);
      draw(time);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame((t) => { lastTime = t; animId = requestAnimationFrame(loop); });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
