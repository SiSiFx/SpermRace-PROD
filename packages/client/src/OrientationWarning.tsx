import { useEffect, useState } from 'react';
import { isPortrait } from './deviceDetection';
import { DeviceMobile, ArrowClockwise } from 'phosphor-react';

export function OrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Show warning on mobile devices in LANDSCAPE mode (we want portrait!)
      const isMobileLandscape = !isPortrait() && window.innerWidth < 1024;
      setShowWarning(isMobileLandscape);
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation changes
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);

    return () => {
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="orientation-warning">
      <div className="orientation-icon">
        <DeviceMobile size={20} weight="fill" style={{ marginRight: 4 }} />
        <ArrowClockwise size={18} weight="bold" />
      </div>
      <div className="orientation-message">
        Please rotate to portrait
      </div>
      <div className="orientation-subtitle">
        This game is designed for vertical (portrait) mode
      </div>
    </div>
  );
}

export default OrientationWarning;

