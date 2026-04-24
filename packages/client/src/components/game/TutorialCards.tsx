import { useState, useEffect, useCallback } from 'react';
import './TutorialCards.css';

const CARDS = [
  {
    glyph: '〰',
    headline: 'TRAILS KILL',
    body: 'Every cell leaves a deadly trail behind it. Touch any trail — including your own — and you die instantly.',
  },
  {
    glyph: '◎',
    headline: 'ZONE SHRINKS',
    body: 'The safe zone closes in during every match. Get caught outside the ring and you\'re dead. Keep moving inward.',
  },
  {
    glyph: '✦',
    headline: 'LAST ONE ALIVE',
    body: '16 cells enter. One survives. Outlast everyone and the prize hits your wallet on-chain — instantly.',
  },
];

const CARD_DURATION_MS = 2800;

interface TutorialCardsProps {
  onComplete: () => void;
}

export function TutorialCards({ onComplete }: TutorialCardsProps) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  const advance = useCallback(() => {
    if (index < CARDS.length - 1) {
      setIndex(i => i + 1);
      setProgress(0);
    } else {
      setExiting(true);
      setTimeout(onComplete, 300);
    }
  }, [index, onComplete]);

  // Auto-advance progress bar
  useEffect(() => {
    setProgress(0);
    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / CARD_DURATION_MS);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        advance();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = CARDS[index];

  return (
    <div
      className={`tutorial-overlay${exiting ? ' is-exiting' : ''}`}
      onClick={advance}
      role="dialog"
      aria-modal="true"
    >
      <div className="tutorial-card">
        <div className="tutorial-card-glyph">{card.glyph}</div>
        <h2 className="tutorial-card-headline">{card.headline}</h2>
        <p className="tutorial-card-body">{card.body}</p>

        {/* Dot indicators */}
        <div className="tutorial-dots">
          {CARDS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot${i === index ? ' is-active' : i < index ? ' is-done' : ''}`}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="tutorial-progress">
          <div className="tutorial-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>

        <p className="tutorial-tap-hint">tap to continue</p>
      </div>

      <button
        className="tutorial-skip"
        onClick={e => { e.stopPropagation(); setExiting(true); setTimeout(onComplete, 300); }}
      >
        Skip
      </button>
    </div>
  );
}
