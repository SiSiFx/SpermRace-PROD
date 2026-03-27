/**
 * GameRadar — live minimap reading directly from ECS EntityManager
 * Shows all alive players as colored dots, self as pulsing ring
 */

import { useEffect, useRef, memo } from 'react';
import type { Game } from './Game';
import { ComponentNames } from './components';
import type { Position } from './components/Position';
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

const W = 210;
const H = 154;
const PAD = 10;

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

      // Background shell
      ctx.fillStyle = 'rgba(5, 10, 18, 0.88)';
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 14);
      ctx.fill();

      ctx.strokeStyle = 'rgba(103, 232, 249, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 14);
      ctx.stroke();

      const mapW = W - PAD * 2;
      const mapH = H - PAD * 2;
      const scaleX = mapW / worldWidth;
      const scaleY = mapH / worldHeight;
      const scale = Math.min(scaleX, scaleY);
      const offX = PAD + (mapW - worldWidth * scale) / 2;
      const offY = PAD + (mapH - worldHeight * scale) / 2;

      const toScreen = (wx: number, wy: number) => ({
        x: offX + wx * scale,
        y: offY + wy * scale,
      });

      const now = Date.now();
      const time = now / 1000;

      // Arena field
      ctx.fillStyle = 'rgba(11, 18, 32, 0.94)';
      ctx.beginPath();
      ctx.roundRect(PAD, PAD, mapW, mapH, 10);
      ctx.fill();

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(PAD, PAD, mapW, mapH, 10);
      ctx.stroke();

      const midX = PAD + mapW / 2;
      const midY = PAD + mapH / 2;
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
      ctx.beginPath();
      ctx.moveTo(midX, PAD + 8);
      ctx.lineTo(midX, H - PAD - 8);
      ctx.moveTo(PAD + 8, midY);
      ctx.lineTo(W - PAD - 8, midY);
      ctx.stroke();

      // Zone circle from getZoneInfo()
      const zoneInfo = game.getZoneInfo();
      if (zoneInfo && zoneInfo.radius > 0) {
        const { x: zx, y: zy } = toScreen(zoneInfo.center.x, zoneInfo.center.y);
        const zr = zoneInfo.radius * scale;

        // Outside danger fill
        ctx.save();
        ctx.beginPath();
        ctx.rect(PAD, PAD, mapW, mapH);
        ctx.arc(zx, zy, zr, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(255,60,60,0.08)';
        ctx.fill();
        ctx.restore();

        // Zone ring
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(248,113,113,${0.48 + Math.sin(time * 4) * 0.22})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Players
      const em = game.getEngine().getEntityManager();
      const entities = em.queryByMask(playerMask);

      for (const entity of entities) {
        const pos    = entity.getComponent<Position>(ComponentNames.POSITION);
        const health = entity.getComponent<Health>(ComponentNames.HEALTH);
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);

        if (!pos || !health || !player) continue;
        if (!health.isAlive) continue;

        const { x: sx, y: sy } = toScreen(pos.x, pos.y);
        const color = hexColor(player.color);
        const isLocal = player.isLocal;
        const protected_ = hasSpawnProtection(health);

        if (isLocal) {
          // Self — pulsing ring
          ctx.beginPath();
          ctx.arc(sx, sy, 4 + Math.sin(time * 5) * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(sx, sy, 8 + Math.sin(time * 4) * 1.2, 0, Math.PI * 2);
          ctx.strokeStyle = protected_ ? `rgba(100,220,100,${0.5 + Math.sin(time * 8) * 0.3})` : 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Enemy contact
          ctx.beginPath();
          ctx.arc(sx, sy, 3.25, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
          ctx.strokeStyle = `${color}55`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // HUD label
      ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(224, 242, 254, 0.78)';
      ctx.fillText('CONTACT RADAR', PAD + 2, H - PAD + 1);

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
        width: 'clamp(156px, 19vw, 210px)',
        height: 'auto',
        borderRadius: 14,
        zIndex: 60,
        pointerEvents: 'none',
        boxShadow: '0 14px 32px rgba(2, 6, 23, 0.42)',
      }}
    />
  );
});
