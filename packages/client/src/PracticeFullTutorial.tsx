import { useState, useCallback } from 'react';
import { GameController, Skull, WarningCircle, ArrowRight } from 'phosphor-react';

interface PracticeFullTutorialProps {
  visible?: boolean;
  onDone: () => void;
}

interface Slide {
  title: string;
  subtitle: string;
  body: string;
  tip: string;
  icon: React.ReactNode;
  animation: React.ReactNode;
  accentColor: string;
}

// ─── CSS-animated illustrations ──────────────────────────────────────────────

function SteerAnimation() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes spermCurve {
          0%   { transform: translate(10%, 60%) rotate(-30deg); }
          40%  { transform: translate(40%, 30%) rotate(10deg); }
          70%  { transform: translate(65%, 50%) rotate(40deg); }
          100% { transform: translate(85%, 25%) rotate(-10deg); }
        }
        @keyframes trailFade1 {
          0%   { opacity: 0; transform: translate(10%, 60%) scaleX(0); }
          20%  { opacity: 0.7; transform: translate(10%, 60%) scaleX(1); }
          100% { opacity: 0.2; transform: translate(10%, 60%) scaleX(1); }
        }
        @keyframes cursorMove {
          0%   { transform: translate(30%, 20%); opacity: 0; }
          10%  { opacity: 1; }
          40%  { transform: translate(55%, 45%); }
          70%  { transform: translate(75%, 20%); }
          100% { transform: translate(90%, 15%); opacity: 1; }
        }
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>

      {/* Cursor / finger indicator */}
      <div style={{
        position: 'absolute', width: 28, height: 28, borderRadius: '50%',
        border: '2px solid rgba(34,211,238,0.9)',
        background: 'rgba(34,211,238,0.15)',
        animation: 'cursorMove 3s ease-in-out infinite',
        zIndex: 3,
      }} />

      {/* Trail */}
      <div style={{
        position: 'absolute', left: '10%', top: '60%',
        width: '75%', height: 3, borderRadius: 4,
        background: 'linear-gradient(90deg, rgba(34,211,238,0.8), rgba(34,211,238,0.1))',
        transformOrigin: 'left center',
        animation: 'trailFade1 3s ease-in-out infinite',
        zIndex: 1,
      }} />

      {/* Sperm head */}
      <div style={{
        position: 'absolute', width: 18, height: 18, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #22d3ee)',
        boxShadow: '0 0 12px rgba(34,211,238,0.9)',
        animation: 'spermCurve 3s ease-in-out infinite',
        zIndex: 2,
      }} />

      {/* Label */}
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0,
        textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.8)',
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        Steer with mouse / drag
      </div>
    </div>
  );
}

function TrailAnimation() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes enemyMove {
          0%   { transform: translate(70%, 20%) rotate(160deg); }
          60%  { transform: translate(35%, 45%) rotate(200deg); }
          80%  { transform: translate(28%, 52%) rotate(200deg); opacity: 1; }
          90%  { transform: translate(28%, 52%) rotate(200deg); opacity: 0; }
          100% { transform: translate(28%, 52%) rotate(200deg); opacity: 0; }
        }
        @keyframes explosion {
          0%   { transform: translate(28%, 52%) scale(0); opacity: 0; }
          80%  { transform: translate(28%, 52%) scale(0); opacity: 0; }
          85%  { transform: translate(28%, 52%) scale(1.5); opacity: 1; }
          100% { transform: translate(28%, 52%) scale(2.5); opacity: 0; }
        }
        @keyframes playerTrail {
          0%   { opacity: 0.9; }
          100% { opacity: 0.9; }
        }
      `}</style>

      {/* Player trail (the weapon) */}
      <div style={{
        position: 'absolute', left: '5%', top: '50%',
        width: '55%', height: 4, borderRadius: 4,
        background: 'linear-gradient(90deg, rgba(34,211,238,0.1), rgba(34,211,238,0.9))',
        animation: 'playerTrail 3s linear infinite',
        zIndex: 1,
      }} />

      {/* Player (stationary, trail extends right) */}
      <div style={{
        position: 'absolute', left: '58%', top: 'calc(50% - 9px)',
        width: 18, height: 18, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #22d3ee)',
        boxShadow: '0 0 12px rgba(34,211,238,0.9)',
        zIndex: 2,
      }} />

      {/* Enemy moving into trail */}
      <div style={{
        position: 'absolute', width: 16, height: 16, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #ff00ff)',
        boxShadow: '0 0 10px rgba(255,0,255,0.9)',
        animation: 'enemyMove 3s ease-in-out infinite',
        zIndex: 2,
      }} />

      {/* Explosion */}
      <div style={{
        position: 'absolute', width: 32, height: 32, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,200,0,0.9), rgba(255,80,0,0.4), transparent)',
        marginLeft: -16, marginTop: -16,
        animation: 'explosion 3s ease-out infinite',
        zIndex: 3,
      }} />

      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0,
        textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.8)',
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        Enemy hits your trail → eliminated
      </div>
    </div>
  );
}

function ZoneAnimation() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @keyframes wallSlice {
          0%   { transform: translateX(0%); background: rgba(239,68,68,0.15); }
          30%  { transform: translateX(0%); background: rgba(239,68,68,0.5); }
          60%  { transform: translateX(18%); background: rgba(239,68,68,0.3); }
          100% { transform: translateX(18%); background: rgba(239,68,68,0.15); }
        }
        @keyframes warningFlash {
          0%, 100% { opacity: 0; }
          25%, 35%  { opacity: 1; }
        }
        @keyframes playerEvade {
          0%   { transform: translate(20%, 50%); }
          40%  { transform: translate(20%, 50%); }
          70%  { transform: translate(45%, 40%); }
          100% { transform: translate(45%, 40%); }
        }
      `}</style>

      {/* Arena border */}
      <div style={{
        position: 'absolute', inset: '10%',
        border: '2px solid rgba(34,211,238,0.4)',
        borderRadius: 8,
      }} />

      {/* Closing wall */}
      <div style={{
        position: 'absolute', left: '10%', top: '10%', bottom: '10%',
        width: '20%',
        animation: 'wallSlice 3s ease-in-out infinite',
        borderRadius: '4px 0 0 4px',
        zIndex: 1,
      }} />

      {/* Warning flash text */}
      <div style={{
        position: 'absolute', left: '10%', top: '5%',
        fontSize: 9, fontWeight: 800, color: '#ef4444',
        letterSpacing: 1, textTransform: 'uppercase',
        animation: 'warningFlash 3s ease-in-out infinite',
        zIndex: 3,
      }}>
        ⚠ ZONE CLOSING
      </div>

      {/* Player evading */}
      <div style={{
        position: 'absolute', width: 16, height: 16, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #22d3ee)',
        boxShadow: '0 0 10px rgba(34,211,238,0.9)',
        animation: 'playerEvade 3s ease-in-out infinite',
        zIndex: 2,
      }} />

      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0,
        textAlign: 'center', fontSize: 10, color: 'rgba(148,163,184,0.8)',
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        Red flash = wall moving in 1.5s
      </div>
    </div>
  );
}

// ─── Slide definitions ────────────────────────────────────────────────────────

const SLIDES: Slide[] = [
  {
    title: 'STEER TO SURVIVE',
    subtitle: 'Movement',
    body: 'Your cell moves forward automatically — you cannot stop. Move your mouse (PC) or drag the left side of the screen (mobile) to steer. The cell follows your aim.',
    tip: 'Keep turning to avoid your own trail.',
    icon: <GameController size={26} weight="fill" />,
    animation: <SteerAnimation />,
    accentColor: '#22d3ee',
  },
  {
    title: 'YOUR TRAIL IS A WEAPON',
    subtitle: 'Combat',
    body: 'You leave a glowing trail behind you. Any enemy that touches your trail is instantly eliminated. But your own trail is deadly too — after 2 seconds it will kill you.',
    tip: 'Cut off enemies. Keep turning to avoid your own wake.',
    icon: <Skull size={26} weight="fill" />,
    animation: <TrailAnimation />,
    accentColor: '#f472b6',
  },
  {
    title: 'THE ZONE IS SHRINKING',
    subtitle: 'Zone',
    body: 'Every few seconds, one wall of the arena closes in. A red flash warns you 1.5 seconds before it moves. Stay inside — outside the zone you will be eliminated.',
    tip: 'Watch the arena edges. Move toward the center when you see red.',
    icon: <WarningCircle size={26} weight="fill" />,
    animation: <ZoneAnimation />,
    accentColor: '#fb923c',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PracticeFullTutorial({ visible = true, onDone }: PracticeFullTutorialProps) {
  const [index, setIndex] = useState(0);

  const handleNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      onDone();
    }
  }, [index, onDone]);

  const handleSkip = useCallback(() => {
    onDone();
  }, [onDone]);

  if (!visible) return null;

  const slide = SLIDES[index] ?? SLIDES[0];
  const isLast = index === SLIDES.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'rgba(9,9,11,0.97)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Skip button — top right */}
      <button
        type="button"
        onClick={handleSkip}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'transparent',
          border: 'none',
          fontSize: 12,
          color: 'rgba(148,163,184,0.7)',
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: '4px 8px',
          letterSpacing: 0.5,
        }}
      >
        Skip tutorial
      </button>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          borderRadius: 24,
          overflow: 'hidden',
          background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(9,9,11,0.98))',
          border: `1px solid ${slide.accentColor}44`,
          boxShadow: `0 0 40px ${slide.accentColor}22, 0 24px 60px rgba(0,0,0,0.8)`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Animation area */}
        <div
          style={{
            width: '100%',
            height: 160,
            background: 'rgba(0,0,0,0.4)',
            borderBottom: `1px solid ${slide.accentColor}33`,
            position: 'relative',
          }}
        >
          {slide.animation}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 22px 22px' }}>
          {/* Icon + subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `${slide.accentColor}22`,
              border: `1px solid ${slide.accentColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: slide.accentColor,
              flexShrink: 0,
            }}>
              {slide.icon}
            </div>
            <div>
              <div style={{ fontSize: 10, color: slide.accentColor, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>
                {slide.subtitle}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', letterSpacing: 0.3 }}>
                {slide.title}
              </div>
            </div>
          </div>

          {/* Body */}
          <p style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'rgba(203,213,225,0.9)',
            margin: '0 0 12px 0',
          }}>
            {slide.body}
          </p>

          {/* Tip */}
          <div style={{
            background: `${slide.accentColor}11`,
            border: `1px solid ${slide.accentColor}33`,
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12,
            color: slide.accentColor,
            marginBottom: 18,
            lineHeight: 1.5,
          }}>
            <span style={{ fontWeight: 700 }}>Tip: </span>{slide.tip}
          </div>

          {/* Progress dots + Next button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 6 }}>
              {SLIDES.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === index ? 20 : 7,
                    height: 7,
                    borderRadius: 999,
                    background: i === index ? slide.accentColor : 'rgba(148,163,184,0.35)',
                    transition: 'all 200ms ease-out',
                  }}
                />
              ))}
            </div>

            {/* Next / Start button */}
            <button
              type="button"
              onClick={handleNext}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                background: slide.accentColor,
                color: '#09090b',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: 0.5,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {isLast ? 'Start Practice' : 'Next'}
              {!isLast && <ArrowRight size={14} weight="bold" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticeFullTutorial;
