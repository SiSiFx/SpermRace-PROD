import { useEffect, useState } from 'react';
import './mobile-tutorial.css';

interface MobileTutorialProps {
  countdown: number;
  onComplete?: () => void;
}

export function MobileTutorial({ countdown, onComplete }: MobileTutorialProps) {
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    // Auto-dismiss when countdown reaches 0
    if (countdown <= 0) {
      setDismissed(true);
      onComplete?.();
    }
  }, [countdown, onComplete]);

  // Always show tutorial during countdown (simple version)
  if (dismissed || countdown <= 0) return null;

  return (
    <div className="mobile-tutorial-overlay compact">
      {/* Just countdown - super minimal */}
      <div className="tutorial-countdown">
        <div className="countdown-number">{countdown}</div>
        <div className="countdown-ready">Get Ready!</div>
      </div>
    </div>
  );
}

export default MobileTutorial;

