/**
 * PremiumMinimap - Dark Casino Style Minimap
 * Compact minimap with zone and player visualization
 */

import { memo, useRef, useEffect } from 'react';
import './PremiumMinimap.css';

interface PremiumMinimapProps {
  /** Zone percentage (0-100) */
  zonePercent?: number;
  /** Player positions (normalized 0-1) */
  players?: Array<{
    id: string;
    x: number;
    y: number;
    color: number;
    isPlayer: boolean;
    isAlive: boolean;
  }>;
  /** Zone center (normalized 0-1) */
  zoneCenter?: { x: number; y: number };
  /** Additional class name */
  className?: string;
}

export const PremiumMinimap = memo(function PremiumMinimap({
  zonePercent = 100,
  players = [],
  zoneCenter = { x: 0.5, y: 0.5 },
  className = '',
}: PremiumMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 120;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = (i / 4) * size;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Draw zone
    const zoneRadius = (zonePercent / 100) * (size / 2);
    const zoneCenterX = zoneCenter.x * size;
    const zoneCenterY = zoneCenter.y * size;

    // Zone glow
    const gradient = ctx.createRadialGradient(
      zoneCenterX, zoneCenterY, zoneRadius * 0.8,
      zoneCenterX, zoneCenterY, zoneRadius
    );
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(zoneCenterX, zoneCenterY, zoneRadius, 0, Math.PI * 2);
    ctx.fill();

    // Zone border
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zoneCenterX, zoneCenterY, zoneRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw players
    players.forEach(player => {
      if (!player.isAlive) return;

      const x = player.x * size;
      const y = player.y * size;
      const radius = player.isPlayer ? 5 : 3;

      // Player dot
      const color = `#${player.color.toString(16).padStart(6, '0')}`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Player glow
      if (player.isPlayer) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
  }, [zonePercent, zoneCenter, players]);

  return (
    <div className={`premium-minimap ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="premium-minimap-canvas"
      />
      <div className="premium-minimap-border" />
    </div>
  );
});

PremiumMinimap.displayName = 'PremiumMinimap';
