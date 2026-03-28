'use client';

import { memo, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { ArrowRight } from 'phosphor-react';
import {
  CLASS_STATS,
  SpermClassType,
  getAllClassTypes,
  getClassDisplayInfo,
} from '../../game/engine/components/SpermClass';
import './ClassSelection.css';

interface ClassSelectionProps {
  selectedClass: SpermClassType;
  onSelect: (classType: SpermClassType) => void;
  onConfirm: () => void;
  visible: boolean;
}

const CLASS_DESC: Record<SpermClassType, string> = {
  [SpermClassType.BALANCED]: 'Shield blocks one hit. Play patient, punish mistakes.',
  [SpermClassType.SPRINTER]: 'Dash teleports through any trail. Go fast, cut hard, escape anything.',
  [SpermClassType.TANK]: 'Overdrive triples your trail width. Fill space until no one can move.',
};

const CLASS_PLAYSTYLE: Record<SpermClassType, string> = {
  [SpermClassType.BALANCED]: 'All-Round',
  [SpermClassType.SPRINTER]: 'Aggressive',
  [SpermClassType.TANK]:     'Control',
};

const CLASS_ABILITY: Record<SpermClassType, { name: string; desc: string; key: string }> = {
  [SpermClassType.BALANCED]: { name: 'SHIELD', desc: 'survive one deadly hit', key: 'E' },
  [SpermClassType.SPRINTER]: { name: 'DASH', desc: 'teleport through trails', key: 'Q' },
  [SpermClassType.TANK]:     { name: 'OVERDRIVE', desc: 'triple trail width', key: 'R' },
};

// ─── Canvas animation helpers ────────────────────────────────────────────────

const DEMO_DURATION = 4; // seconds per loop

function ss(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number,
  color: string, alpha = 1, glowBlur = 0, glowColor = '',
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  if (glowBlur > 0) { ctx.shadowColor = glowColor || color; ctx.shadowBlur = glowBlur; }
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.restore();
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  color: string, alpha = 0.7, glowBlur = 0,
) {
  if (r <= 0.2 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  if (glowBlur > 0) { ctx.shadowColor = color; ctx.shadowBlur = glowBlur; }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color: string, alpha = 1,
) {
  if (alpha < 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 9.5px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ─── Per-class frame renderers ────────────────────────────────────────────────

/**
 * SHIELD (Balanced): player moves right with trail, enemy appears from right,
 * shield ring activates, enemy is eliminated on contact.
 */
function renderShield(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, color: string) {
  const CY = H * 0.52;
  const px = 28 + ss(0, 3.8, t) * 155;
  const shieldAmt = ss(1.2, 1.6, t) * (1 - ss(2.7, 3.1, t));

  // Trail dots
  const offsets = [-26, -48, -70, -92, -112];
  offsets.forEach((dx, i) => {
    const tx = px + dx;
    if (tx > 2) {
      drawDot(ctx, tx, CY, 5.5 - i * 0.6, color,
        0.22 + (4 - i) * 0.1,
        shieldAmt * 5,
      );
    }
  });

  // Shield ring
  if (shieldAmt > 0.01) {
    ctx.save();
    ctx.globalAlpha = shieldAmt * 0.9;
    ctx.beginPath();
    ctx.ellipse(px, CY, 27, 21, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();
  }

  // Player head
  drawHead(ctx, px, CY, 17, 12, color, 1, 4 + shieldAmt * 16,
    shieldAmt > 0.05 ? '#ffffff' : color);

  // Enemy
  const eAlpha = ss(1.5, 1.9, t) * (1 - ss(2.4, 2.8, t));
  if (eAlpha > 0.01) {
    const eX = W - 18 - ss(1.5, 2.5, t) * 115;
    drawHead(ctx, eX, CY, 11, 8, '#ef4444', eAlpha, 5, '#ef4444');
    [16, 30].forEach((dx, i) =>
      drawDot(ctx, eX + dx, CY, 3.5 - i, '#ef4444', eAlpha * (0.35 - i * 0.1)));
  }

  // Labels
  drawLabel(ctx, 'SHIELD ACTIVE', W / 2, 13, '#ffffff', shieldAmt);
  const killA = ss(2.2, 2.4, t) * (1 - ss(2.5, 2.8, t));
  drawLabel(ctx, '✕ ELIMINATED', W - 58, CY - 22, '#ef4444', killA);
}

/**
 * DASH (Sprinter): red trail wall blocks the path with a gap,
 * player blasts through at speed with motion-blur lines.
 */
function renderDash(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, color: string) {
  const CY = H * 0.52;
  const wallX = Math.round(W * 0.56);
  const wallFade = 1 - ss(3.7, 4, t);

  // Enemy trail wall (red vertical band)
  if (wallFade > 0) {
    for (let i = 0; i < 7; i++) {
      const wy = 5 + i * 11;
      if (i !== 3) { // gap at center row for player to pass
        drawDot(ctx, wallX, wy, 4.5, '#ef4444', wallFade * 0.75, 4);
        drawDot(ctx, wallX + 13, wy, 4, '#ef4444', wallFade * 0.5, 3);
      }
    }
  }

  // Player position
  const dashAt = 1.5;
  const dashEnd = 1.78;
  let px: number;
  let pAlpha = 1;

  if (t < dashAt) {
    px = 22 + ss(0, dashAt, t) * (wallX - 70);
  } else if (t < dashEnd) {
    const dp = (t - dashAt) / (dashEnd - dashAt);
    px = dp < 0.45 ? wallX - 28 : wallX + 45;
    pAlpha = dp < 0.3 ? 1 - dp * 2.5 : (dp - 0.3) / 0.7;
  } else {
    px = wallX + 45 + ss(dashEnd, 3.8, t) * 75;
  }

  // Trail (only on correct side of wall)
  if (t < dashAt) {
    [-17, -32, -47].forEach((dx, i) => {
      const tx = px + dx;
      if (tx > 2) drawDot(ctx, tx, CY, 3.5 - i * 0.5, color, 0.5 - i * 0.12);
    });
  } else if (t > dashEnd) {
    [-15, -28].forEach((dx, i) => {
      const tx = px + dx;
      if (tx > wallX + 3) drawDot(ctx, tx, CY, 3 - i * 0.5, color, 0.5 - i * 0.1);
    });
  }

  // Speed lines during dash
  if (t > 1.15 && t < dashEnd + 0.18) {
    const lA = ss(1.15, 1.38, t) * (1 - ss(dashEnd, dashEnd + 0.18, t));
    ctx.save();
    ctx.globalAlpha = lA * 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    [-14, -7, 0, 7, 14].forEach(dy => {
      ctx.beginPath();
      ctx.moveTo(px - 55, CY + dy);
      ctx.lineTo(px - 6, CY + dy);
      ctx.stroke();
    });
    ctx.restore();
  }

  drawHead(ctx, px, CY, 11, 8, color, Math.max(0, pAlpha) * wallFade, 5, color);

  const dA = ss(1.15, 1.5, t) * (1 - ss(dashEnd + 0.08, dashEnd + 0.38, t));
  drawLabel(ctx, 'DASH!', wallX - 35, 13, color, dA);
}

/**
 * OVERDRIVE (Tank): player grows from normal to massive, trail fills the lane,
 * enemy approaches from right and is blocked.
 */
function renderOverdrive(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, color: string) {
  const CY = H * 0.52;
  const grow = ss(1.2, 1.95, t);
  const headRx = 15 + grow * 15;
  const headRy = 11 + grow * 11;
  const trailR = 5 + grow * 13;
  const px = 34 + ss(0, 3.8, t) * 88;
  const fade = 1 - ss(3.75, 4, t);

  // Trail (gets massive with overdrive)
  [-22, -44, -66, -88, -110, -132].forEach((dx, i) => {
    const tx = px + dx;
    if (tx > 0) {
      const r = Math.max(2, trailR - i * 1.3);
      drawDot(ctx, tx, CY, r, color, fade * (0.68 - i * 0.08), grow * 7);
    }
  });

  // Player
  drawHead(ctx, px, CY, headRx, headRy, color, fade, 4 + grow * 18, color);

  // Label
  const lA = ss(1.2, 1.6, t) * (1 - ss(3.2, 3.7, t)) * fade;
  drawLabel(ctx, 'OVERDRIVE!', W / 2, 13, color, lA);

  // Enemy blocked
  if (t > 2.1 && t < 3.8) {
    const eA = ss(2.1, 2.5, t) * (1 - ss(3.2, 3.65, t)) * fade;
    if (eA > 0.01) {
      const eX = W - 22 - ss(2.1, 3.1, t) * 35;
      drawHead(ctx, eX, CY, 9, 7, '#ef4444', eA, 5, '#ef4444');
      const bA = ss(2.5, 2.8, t) * (1 - ss(3.0, 3.35, t)) * fade;
      drawLabel(ctx, '✕ BLOCKED', eX, CY - 22, '#ef4444', bA);
    }
  }
}

// ─── Canvas demo component ────────────────────────────────────────────────────

const AbilityDemo = memo(function AbilityDemo({
  classType,
  color,
}: {
  classType: SpermClassType;
  color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Scale backing store to device pixel ratio for crisp rendering on HiDPI/mobile
    const dpr = Math.round(window.devicePixelRatio || 1);
    const W = 300;
    const H = 80;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    let startTime = 0;
    let raf: number;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const t = ((now - startTime) / 1000) % DEMO_DURATION;
      ctx.clearRect(0, 0, W, H);

      if (classType === SpermClassType.BALANCED)      renderShield(ctx, W, H, t, color);
      else if (classType === SpermClassType.SPRINTER) renderDash(ctx, W, H, t, color);
      else                                             renderOverdrive(ctx, W, H, t, color);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [classType, color]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={80}
      className="cs-demo-canvas"
      aria-hidden="true"
    />
  );
});

// ─── Stat bar ─────────────────────────────────────────────────────────────────

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function rgbChannels(value: number): string {
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `${r} ${g} ${b}`;
}

function getCardVars(classType: SpermClassType): CSSProperties {
  const info = getClassDisplayInfo(classType);
  return {
    ['--class-color' as any]: hexColor(info.color),
    ['--class-rgb' as any]: rgbChannels(info.color),
  };
}

function normalizeStat(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
}

function getStatProfile(classType: SpermClassType) {
  const stats = CLASS_STATS[classType];
  return {
    speed: normalizeStat(stats.speedMultiplier, 0.7, 1.4),
    size:  normalizeStat(stats.sizeMultiplier,  0.7, 1.4),
  };
}

function StatBar({ label, value }: { label: string; value: number }) {
  const tag = value === 0 ? 'MIN' : value === 100 ? 'MAX' : value < 40 ? 'LOW' : value > 65 ? 'HIGH' : 'MID';
  return (
    <div className="cs-stat">
      <span className="cs-stat-label">{label}</span>
      <div className="cs-stat-track" aria-hidden="true">
        <div className="cs-stat-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="cs-stat-pct">{tag}</span>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

const ClassCard = memo(function ClassCard({
  classType,
  isSelected,
  onSelect,
}: {
  classType: SpermClassType;
  isSelected: boolean;
  onSelect: (c: SpermClassType) => void;
}) {
  const info = getClassDisplayInfo(classType);
  const color = hexColor(info.color);
  const statProfile = getStatProfile(classType);
  const cardVars = getCardVars(classType);
  const ability = CLASS_ABILITY[classType];

  return (
    <button
      type="button"
      className={`cs-card${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(classType)}
      aria-pressed={isSelected}
      style={cardVars}
    >
      {/* Name row */}
      <div className="cs-card-header">
        <span className="cs-card-icon" aria-hidden="true">{info.icon}</span>
        <span className="cs-card-name">{info.name}</span>
        <span className="cs-card-playstyle">{CLASS_PLAYSTYLE[classType]}</span>
      </div>

      {/* Animated ability demo */}
      <div className="cs-preview-wrap" aria-hidden="true">
        <AbilityDemo classType={classType} color={color} />
      </div>

      {/* One-line description */}
      <p className="cs-card-desc">{CLASS_DESC[classType]}</p>

      {/* Stats */}
      <div className="cs-stats">
        <StatBar label="Speed" value={statProfile.speed} />
        <StatBar label="Trail" value={statProfile.size}  />
      </div>

      {/* Ability pill with key */}
      <span className="cs-ability-pill">
        <strong>{ability.name}</strong> — {ability.desc}
        <kbd className="cs-ability-key">{ability.key}</kbd>
      </span>
    </button>
  );
});

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ClassSelection({ selectedClass, onSelect, onConfirm, visible }: ClassSelectionProps) {
  const allClasses = getAllClassTypes();

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') onSelect(SpermClassType.BALANCED);
      else if (e.key === '2') onSelect(SpermClassType.SPRINTER);
      else if (e.key === '3') onSelect(SpermClassType.TANK);
      else if (e.key === 'Enter' || e.key === ' ') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onConfirm, onSelect]);

  const handleSelect = useCallback((c: SpermClassType) => onSelect(c), [onSelect]);

  if (!visible) return null;

  const selectedInfo = getClassDisplayInfo(selectedClass);
  const selectedVars = getCardVars(selectedClass);

  return (
    <div className="cs-root">
      <div className="cs-shell">
        <div className="cs-header">
          <h1 className="cs-title">Choose your class</h1>
          <p className="cs-subtitle">Pick how you want to fight</p>
        </div>

        <div className="cs-cards">
          {allClasses.map((classType) => (
            <ClassCard
              key={classType}
              classType={classType}
              isSelected={selectedClass === classType}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <div className="cs-confirm-row">
          <button
            type="button"
            className="cs-confirm"
            onClick={onConfirm}
            style={selectedVars}
          >
            Play as {selectedInfo.name}
            <ArrowRight size={20} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ClassSelection;
