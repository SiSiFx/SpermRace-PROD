/**
 * SpermVisualization - Animated SVG representations of each sperm class
 * 
 * Visual designs:
 * - BALANCED: Classic form, rhythmic tail wave, cyan glow
 * - SPRINTER: Streamlined, rapid tail vibration, amber/yellow streak
 * - TANK: Thick body, powerful slow tail sweep, crimson aura
 */

import { useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { SpermClassType } from '../../game/engine/components/SpermClass';
import './SpermVisualization.css';

interface SpermVisualizationProps {
  classType: SpermClassType;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Animation configurations per class
const CLASS_CONFIG = {
  [SpermClassType.BALANCED]: {
    color: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.5)',
    headSize: 1,
    tailAmplitude: 12,
    tailFrequency: 0.08,
    speed: 1,
  },
  [SpermClassType.SPRINTER]: {
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.5)',
    headSize: 0.75,
    tailAmplitude: 8,
    tailFrequency: 0.15,
    speed: 1.8,
  },
  [SpermClassType.TANK]: {
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    headSize: 1.4,
    tailAmplitude: 18,
    tailFrequency: 0.05,
    speed: 0.7,
  },
};

const SIZE_SCALE = {
  sm: 0.6,
  md: 1,
  lg: 1.4,
  xl: 1.8,
};

/**
 * Animated sperm visualization with canvas-based tail animation
 */
export const SpermVisualization = memo(function SpermVisualization({
  classType,
  isSelected = false,
  size = 'md',
}: SpermVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const config = CLASS_CONFIG[classType];
  const scale = SIZE_SCALE[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const width = 200 * scale;
    const height = 120 * scale;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    let time = 0;

    const drawSperm = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const headRadius = 16 * config.headSize * scale;

      // Draw glow effect
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, headRadius * 3
      );
      gradient.addColorStop(0, config.glowColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw tail (sine wave)
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 3 * scale * (isSelected ? 1.2 : 1);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const tailLength = 80 * scale;
      const segments = 40;
      
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = centerX - headRadius - t * tailLength;
        const waveOffset = Math.sin(time * config.speed + t * Math.PI * 4) * 
                          config.tailAmplitude * scale * (1 - t * 0.3);
        const y = centerY + waveOffset;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Add tail glow
      ctx.shadowColor = config.color;
      ctx.shadowBlur = isSelected ? 20 : 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw head
      ctx.beginPath();
      ctx.arc(centerX, centerY, headRadius, 0, Math.PI * 2);
      
      // Head gradient
      const headGradient = ctx.createRadialGradient(
        centerX - headRadius * 0.3,
        centerY - headRadius * 0.3,
        0,
        centerX,
        centerY,
        headRadius
      );
      headGradient.addColorStop(0, '#ffffff');
      headGradient.addColorStop(0.3, config.color);
      headGradient.addColorStop(1, config.color + '80');
      
      ctx.fillStyle = headGradient;
      ctx.shadowColor = config.color;
      ctx.shadowBlur = isSelected ? 25 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw head highlight
      ctx.beginPath();
      ctx.arc(
        centerX - headRadius * 0.3,
        centerY - headRadius * 0.3,
        headRadius * 0.25,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      time += config.tailFrequency;
      animationRef.current = requestAnimationFrame(drawSperm);
    };

    drawSperm();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [classType, isSelected, scale, config]);

  return (
    <motion.div
      className={`sperm-visualization ${isSelected ? 'selected' : ''} ${classType}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <canvas
        ref={canvasRef}
        className="sperm-canvas"
        style={{ filter: isSelected ? 'drop-shadow(0 0 20px ' + config.glowColor + ')' : 'none' }}
      />
      
      {/* Selection ring */}
      {isSelected && (
        <motion.div
          className="selection-ring"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      )}

      {/* Particle effects for selected state */}
      {isSelected && (
        <>
          <motion.div
            className="particle p1"
            animate={{
              y: [-10, -40],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }}
          />
          <motion.div
            className="particle p2"
            animate={{
              y: [-10, -35],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.3,
            }}
          />
          <motion.div
            className="particle p3"
            animate={{
              y: [-10, -45],
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 0.6,
            }}
          />
        </>
      )}
    </motion.div>
  );
});

export default SpermVisualization;
