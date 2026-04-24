import { useState, useEffect, useCallback } from 'react';
import './TutorialCards.css';

const CARDS = [
  {
    num: '01',
    headline: 'TRAILS KILL',
    body: 'Every cell leaves a deadly trail behind it. Touch any trail — including your own — and you die instantly.',
  },
  {
    num: '02',
    headline: 'ZONE SHRINKS',
    body: 'The safe zone closes in during every match. Get caught outside the ring and you\'re dead. Keep moving inward.',
  },
  {
    num: '03',
    headline: 'LAST ONE ALIVE',
    body: '16 enter. One survives. Outlast everyone and the prize hits your wallet instantly.',
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
        <div className="tutorial-card-num">{card.num}</div>
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
