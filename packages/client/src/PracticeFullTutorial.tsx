import { useEffect, useState } from 'react';

interface PracticeFullTutorialProps {
  visible: boolean;
  onDone: () => void;
}

interface Slide {
  title: string;
  body: string;
  icon: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Drag to steer',
    body: 'Use your thumb to glide along the canal. Tiny adjustments keep you alive.',
    icon: '🕹️',
  },
  {
    title: 'Your trail kills',
    body: 'Leave a deadly wake – touch any trail (even yours after a short grace) and you die.',
    icon: '💀',
  },
  {
    title: 'Zone keeps shrinking',
    body: 'Stay inside the glowing safe zone as slices close in and push everyone together.',
    icon: '🧬',
  },
];

// Show tutorial for ~7 seconds total: 2s + 2s + 3s across the three slides
const SLIDE_DURATIONS_MS: number[] = [2000, 2000, 3000];
const TUTORIAL_SECONDS = 7;

export function PracticeFullTutorial({ visible, onDone }: PracticeFullTutorialProps) {
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(TUTORIAL_SECONDS);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    let currentIndex = 0;
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const duration = SLIDE_DURATIONS_MS[currentIndex] ?? 3000;
      timeoutId = window.setTimeout(() => {
        if (currentIndex >= SLIDES.length - 1) {
          onDone();
          return;
        }
        currentIndex += 1;
        setIndex(currentIndex);
        scheduleNext();
      }, duration);
    };

    scheduleNext();

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [visible, onDone]);

  // Simple countdown overlay for the 7s tutorial window
  useEffect(() => {
    if (!visible) return;
    setSecondsLeft(TUTORIAL_SECONDS);
    const startAt = Date.now();
    const id = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startAt) / 1000);
      const remain = Math.max(0, TUTORIAL_SECONDS - elapsedSec);
      setSecondsLeft(remain);
      if (remain <= 0) {
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const slide = SLIDES[index] ?? SLIDES[0];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 55%), rgba(15,23,42,0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          color: 'rgba(148,163,184,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85 }}>Practice tutorial</div>
        <div
          style={{
            marginTop: 6,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.96)',
            boxShadow: '0 0 0 1px rgba(148,163,184,0.6), 0 8px 20px rgba(15,23,42,0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Race starts in</span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: '#e5e7eb',
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {secondsLeft}s
          </span>
        </div>
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          height: '80vh',
          maxHeight: 560,
          borderRadius: 28,
          padding: '24px 22px 22px',
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.96))',
          border: '1px solid rgba(148,163,184,0.6)',
          boxShadow:
            '0 22px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(15,23,42,0.8)',
        }}
      >
        <div
          style={{
            width: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            marginBottom: 20,
            background:
              'radial-gradient(circle at top, rgba(15,23,42,0.9), rgba(15,23,42,1))',
            border: '1px solid rgba(51,65,85,0.9)',
            position: 'relative',
            paddingTop: '60%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(148,163,184,0.95)',
              fontSize: 12,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Gameplay screenshot placeholder
          </div>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background:
              'radial-gradient(circle at 30% 20%, rgba(248,250,252,0.9), transparent 55%), radial-gradient(circle at 70% 80%, rgba(56,189,248,0.8), transparent 55%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            fontSize: 30,
          }}
        >
          {slide.icon}
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#e5e7eb',
            marginBottom: 8,
          }}
        >
          {slide.title}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'rgba(203,213,225,0.96)',
            marginBottom: 16,
          }}
        >
          {slide.body}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === index ? 18 : 6,
                  height: 6,
                  borderRadius: 999,
                  background:
                    i === index
                      ? 'linear-gradient(90deg,#22d3ee,#38bdf8)'
                      : 'rgba(148,163,184,0.6)',
                  transition: 'all 160ms ease-out',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onDone();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 12,
              color: 'rgba(148,163,184,0.96)',
              textDecoration: 'underline',
            }}
          >
            Skip
          </button>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'rgba(148,163,184,0.85)',
          }}
        >
          This tutorial only appears in Practice. Tournament games are unaffected.
        </div>
      </div>
    </div>
  );
}

export default PracticeFullTutorial;
