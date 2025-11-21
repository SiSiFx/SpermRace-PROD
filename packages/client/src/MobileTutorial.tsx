import { useEffect, useState } from 'react';
import './mobile-tutorial.css';

interface MobileTutorialProps {
  countdown: number;
  onComplete?: () => void;
  // practice: used in Practice mode (lobby + pre-start), tournament: regular games
  context?: 'practice' | 'tournament';
}

const PRESTART_TIPS: string[] = [
  'Your trail kills on contact – even you after a short spawn grace.',
  'Stay inside the shrinking safe zone as the walls close in.',
  'Grab glowing energy orbs to refill boost and keep dashing.',
];

export function MobileTutorial({ countdown, onComplete, context = 'tournament' }: MobileTutorialProps) {
  const [dismissed, setDismissed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);

  // Only show for early players (e.g. first 5 games based on local stats)
  // and allow practice players to opt out permanently via localStorage.
  useEffect(() => {
    try {
      if (context === 'practice') {
        const optOut = localStorage.getItem('sr_practice_tips_optout');
        if (optOut === '1') {
          setEnabled(false);
          return;
        }
      }
      const stored = localStorage.getItem('spermrace_stats');
      if (!stored) return;
      const stats = JSON.parse(stored) as { totalGames?: number };
      if ((stats.totalGames ?? 0) >= 5) setEnabled(false);
    } catch {}
  }, [context]);

  useEffect(() => {
    if (countdown <= 0) {
      setDismissed(true);
      onComplete?.();
    }
  }, [countdown, onComplete]);

  // Rotate tips while countdown is active
  useEffect(() => {
    if (dismissed || !enabled || countdown <= 0) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % PRESTART_TIPS.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, [dismissed, enabled, countdown]);

  if (dismissed || !enabled || countdown <= 0) return null;

  const tip = PRESTART_TIPS[tipIndex] ?? PRESTART_TIPS[0];

  const handleOptOutPractice = () => {
    try {
      localStorage.setItem('sr_practice_tips_optout', '1');
    } catch {}
    setEnabled(false);
    setDismissed(true);
    onComplete?.();
  };

  return (
    <div className="mobile-tutorial-overlay compact">
      <div className="tutorial-reminder" style={context === 'practice' ? { pointerEvents: 'auto' } : undefined}>
        <div className="reminder-text">
          <span>{tip}</span>
        </div>
        {context === 'practice' && (
          <button
            type="button"
            onClick={handleOptOutPractice}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: 'none',
              color: 'rgba(148,163,184,0.95)',
              fontSize: 11,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Don’t show practice tips next time
          </button>
        )}
      </div>
    </div>
  );
}

export default MobileTutorial;

