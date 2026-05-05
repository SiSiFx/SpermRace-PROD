/**
 * MiniMap HUD - Shows player positions, zone, and arena info
 * Biological theme with organic styling
 */

import React, { useRef, useEffect, memo } from 'react';
import { useWs } from '../../WsProvider';

interface MiniMapProps {
  /** Show/hide minimap */
  show?: boolean;
  /** World size for scaling */
  worldWidth?: number;
  worldHeight?: number;
}

interface PlayerDot {
  id: string;
  x: number;
  y: number;
  color: number;
  isAlive: boolean;
  isPlayer: boolean;
}

export const MiniMap = memo(function MiniMap({ show = true, worldWidth = 8000, worldHeight = 6000 }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useWs();

  // Extract player data from game state
  const players = React.useMemo(() => {
    const dots: PlayerDot[] = [];
    if (!state.game?.players) return dots;

    for (const player of state.game.players) {
      if (!player.isAlive) continue;
      dots.push({
        id: player.id,
        x: player.sperm.position.x,
        y: player.sperm.position.y,
        color: parseInt(player.sperm.color.replace('#', ''), 16),
        isAlive: player.isAlive,
        isPlayer: player.id === state.playerId,
      });
    }
    return dots;
  }, [state.game?.players, state.playerId]);

  // Get zone info
  const zoneInfo = React.useMemo(() => {
    const objective = state.game?.objective;
    if (!objective) return null;

    return {
      radius: objective.egg.radius,
      centerX: objective.egg.x,
      centerY: objective.egg.y,
      maxRadius: objective.egg.radius,
    };
  }, [state.game?.objective]);

  // Get alive count
  const aliveCount = state.game?.aliveCount ?? 0;

  // Render minimap with animation loop for pulse effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !show) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = 140;
    const height = 100;
    canvas.width  = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const padding = 4;
    const mapWidth = width - padding * 2;
    const mapHeight = height - padding * 2;

    let animationId: number;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height); // logical px — correct after ctx.scale(dpr)

      // Draw background
      ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
      ctx.beginPath();
      ctx.roundRect(padding, padding, mapWidth, mapHeight, 6);
      ctx.fill();

      // Time for animations
      const time = Date.now() / 1000;

      // Draw zone boundary
      if (zoneInfo) {
        const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight);
        const offsetX = padding + (mapWidth - worldWidth * scale) / 2;
        const offsetY = padding + (mapHeight - worldHeight * scale) / 2;

        // Zone circle
        const zoneRadius = zoneInfo.radius * scale;
        const zoneX = offsetX + zoneInfo.centerX * scale;
        const zoneY = offsetY + zoneInfo.centerY * scale;

        // Danger zone (outside safe area)
        ctx.fillStyle = 'rgba(255, 50, 50, 0.1)';
        ctx.beginPath();
        ctx.rect(padding, padding, mapWidth, mapHeight);
        ctx.arc(zoneX, zoneY, zoneRadius, 0, Math.PI * 2, true);
        ctx.fill();

        // Zone boundary
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(zoneX, zoneY, zoneRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Zone shrinking indicator (pulsing ring)
        const pulseRadius = zoneRadius + Math.sin(time * 3) * 3;
        ctx.strokeStyle = `rgba(255, 150, 0, ${0.3 + Math.sin(time * 5) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(zoneX, zoneY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw players
      const scale = Math.min(mapWidth / worldWidth, mapHeight / worldHeight);
      const offsetX = padding + (mapWidth - worldWidth * scale) / 2;
      const offsetY = padding + (mapHeight - worldHeight * scale) / 2;

      for (const player of players) {
        const px = offsetX + player.x * scale;
        const py = offsetY + player.y * scale;

        const color = '#' + player.color.toString(16).padStart(6, '0');

        // Player dot
        ctx.beginPath();
        if (player.isPlayer) {
          // Self indicator - larger with ring
          ctx.fillStyle = color;
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();

          // Outer ring for self with pulse
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 7 + Math.sin(time * 4) * 1, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Other players - smaller dots
          ctx.fillStyle = color;
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw alive count badge
      ctx.fillStyle = 'rgba(0, 247, 255, 0.9)';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${aliveCount}`, width / 2, 12);

      // Continue animation loop
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [show, players, zoneInfo, aliveCount, worldWidth, worldHeight]);

  if (!show) return null;

  return (
    <div className="minimap-container">
      <canvas
        ref={canvasRef}
        width={140}
        height={100}
        className="minimap-canvas"
      />
      <style>{`
        .minimap-container {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 60;
          pointer-events: none;
        }

        .minimap-canvas {
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 247, 255, 0.1);
          border: 1px solid rgba(0, 247, 255, 0.3);
          backdrop-filter: blur(4px);
        }

        @media (max-width: 768px) {
          .minimap-container {
            top: 8px;
            right: 8px;
          }

          .minimap-canvas {
            width: 100px;
            height: 70px;
          }
        }
      `}</style>
    </div>
  );
});

export default MiniMap;
