import { useEffect, useState } from 'react';
import './mobile-tutorial.css';

interface MobileTutorialProps {
  countdown: number;
  onComplete?: () => void;
}

const PRESTART_TIPS: string[] = [
  'Your trail kills on contact – even you after a short spawn grace.',
  'Stay inside the shrinking safe zone as the walls close in.',
  'Grab glowing energy orbs to refill boost and keep dashing.',
];

export function MobileTutorial({ countdown, onComplete }: MobileTutorialProps) {
  const [dismissed, setDismissed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);

  // Only show for early players (e.g. first 5 games based on local stats)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (!stored) return;
      const stats = JSON.parse(stored) as { totalGames?: number };
      if ((stats.totalGames ?? 0) >= 5) setEnabled(false);
    } catch {}
  }, []);

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

  return (
    <div className="mobile-tutorial-overlay compact">
      <div className="tutorial-reminder">
        <div className="reminder-text">
          <span style={{ marginRight: 6 }}>🧬</span>
          <span>{tip}</span>
        </div>
      </div>
    </div>
  );
}

export default MobileTutorial;

