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

export function PracticeFullTutorial({ visible, onDone }: PracticeFullTutorialProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= SLIDES.length) {
          window.clearInterval(id);
          onDone();
          return prev;
        }
        return next;
      });
    }, 3000);
    return () => window.clearInterval(id);
  }, [visible, onDone]);

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
        padding: '24px 20px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          fontSize: 12,
          color: 'rgba(148,163,184,0.9)',
        }}
      >
        Practice tips
      </div>
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          borderRadius: 24,
          padding: '22px 20px 18px',
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,64,175,0.96))',
          border: '1px solid rgba(148,163,184,0.6)',
          boxShadow:
            '0 22px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(15,23,42,0.8)',
        }}
      >
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
