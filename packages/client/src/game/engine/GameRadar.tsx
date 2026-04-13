/**
 * GameRadar — live minimap reading directly from ECS EntityManager
 * Shows all alive players as colored dots with velocity arrows, zone ring, self as pulsing ring
 */

import { useEffect, useRef, memo } from 'react';
import type { Game } from './Game';
import { ComponentNames } from './components';
import type { Position } from './components/Position';
import type { Velocity } from './components/Velocity';
import type { Health } from './components/Health';
import { hasSpawnProtection } from './components/Health';
import type { Player } from './components/Player';
import { ARENA_CONFIG } from './config/GameConstants';

interface GameRadarProps {
  game: Game;
  playerMask: number;
  worldWidth?: number;
  worldHeight?: number;
}

const W = 148;
const H = 148;
const PAD = 8;

function hexColor(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export const GameRadar = memo(function GameRadar({ game, playerMask, worldWidth = ARENA_CONFIG.DESKTOP_WIDTH, worldHeight = ARENA_CONFIG.DESKTOP_HEIGHT }: GameRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;

    function draw() {
      if (!ctx || !canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== W * dpr) {
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = 'rgba(4, 8, 16, 0.90)';
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 10);
      ctx.fill();

      ctx.strokeStyle = 'rgba(103, 232, 249, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 10);
      ctx.stroke();

      const mapW = W - PAD * 2;
      const mapH = H - PAD * 2;
      const scale = Math.min(mapW / worldWidth, mapH / worldHeight);
      const offX = PAD + (mapW - worldWidth * scale) / 2;
      const offY = PAD + (mapH - worldHeight * scale) / 2;

      const toScreen = (wx: number, wy: number) => ({
        x: offX + wx * scale,
        y: offY + wy * scale,
      });

      const now = Date.now();
      const time = now / 1000;

      // Arena field
      ctx.fillStyle = 'rgba(8, 14, 26, 0.96)';
      ctx.beginPath();
      ctx.roundRect(PAD, PAD, mapW, mapH, 6);
      ctx.fill();

      // Zone circle
      const zoneInfo = game.getZoneInfo();
      if (zoneInfo && zoneInfo.radius > 0) {
        const { x: zx, y: zy } = toScreen(zoneInfo.center.x, zoneInfo.center.y);
        const zr = zoneInfo.radius * scale;

        // Outside danger fill
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(PAD, PAD, mapW, mapH, 6);
        ctx.arc(zx, zy, zr, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(255,50,50,0.10)';
        ctx.fill();
        ctx.restore();

        // Zone ring — pulses faster when shrinking
        const pulseFq = zoneInfo.state === 'shrinking' ? 8 : 3;
        const pulseAlpha = 0.45 + Math.sin(time * pulseFq) * 0.2;
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(248,113,113,${pulseAlpha})`;
        ctx.lineWidth = zoneInfo.state === 'shrinking' ? 2 : 1.2;
        ctx.stroke();
      }

      // Players
      const em = game.getEngine().getEntityManager();
      const entities = em.queryByMask(playerMask);

      for (const entity of entities) {
        const pos    = entity.getComponent<Position>(ComponentNames.POSITION);
        const vel    = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
        const health = entity.getComponent<Health>(ComponentNames.HEALTH);
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);

        if (!pos || !health || !player) continue;
        if (!health.isAlive) continue;

        const { x: sx, y: sy } = toScreen(pos.x, pos.y);
        const color = hexColor(player.color);
        const isLocal = player.isLocal;
        const protected_ = hasSpawnProtection(health);

        if (isLocal) {
          // Self — bright white dot + pulsing ring
          const ringR = 7 + Math.sin(time * 5) * 0.8;
          ctx.beginPath();
          ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = protected_
            ? `rgba(74,222,128,${0.5 + Math.sin(time * 8) * 0.3})`
            : 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          // Facing arrow
          if (vel && Number.isFinite(vel.angle)) {
            const arrowLen = 10;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(vel.angle) * arrowLen, sy + Math.sin(vel.angle) * arrowLen);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        } else {
          // Enemy — colored dot + velocity arrow
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Velocity arrow
          if (vel && Number.isFinite(vel.angle)) {
            const speed = vel.speed ?? 0;
            const arrowLen = Math.min(12, 4 + speed * 0.018);
            const ax = sx + Math.cos(vel.angle) * arrowLen;
            const ay = sy + Math.sin(vel.angle) * arrowLen;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ax, ay);
            ctx.strokeStyle = `${color}99`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Arrowhead
            const headLen = 3;
            const headAngle = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              ax - headLen * Math.cos(vel.angle - headAngle),
              ay - headLen * Math.sin(vel.angle - headAngle)
            );
            ctx.moveTo(ax, ay);
            ctx.lineTo(
              ax - headLen * Math.cos(vel.angle + headAngle),
              ay - headLen * Math.sin(vel.angle + headAngle)
            );
            ctx.strokeStyle = `${color}bb`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [game, worldWidth, worldHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        width: 'clamp(120px, 14vw, 148px)',
        height: 'auto',
        aspectRatio: '1',
        borderRadius: 10,
        zIndex: 60,
        pointerEvents: 'none',
        boxShadow: '0 8px 24px rgba(2, 6, 23, 0.5)',
      }}
    />
  );
});
