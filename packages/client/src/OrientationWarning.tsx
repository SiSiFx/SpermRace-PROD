import { useEffect, useState } from 'react';
import { isPortrait } from './deviceDetection';
import { DeviceMobile, ArrowClockwise, CaretRight } from 'phosphor-react';

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
      <div className="orientation-warning-content">
        {/* Animated icon container */}
        <div className="orientation-icon-wrapper">
          <div className="orientation-icon-glow"></div>
          <div className="orientation-icon">
            <DeviceMobile size={48} weight="fill" />
            <div className="rotation-arrows">
              <ArrowClockwise size={24} weight="bold" className="rotate-arrow-1" />
              <ArrowClockwise size={24} weight="bold" className="rotate-arrow-2" />
            </div>
          </div>
        </div>

        {/* Message content */}
        <div className="orientation-text-content">
          <div className="orientation-message">
            <span className="orientation-message-line">Please rotate your device</span>
            <span className="orientation-message-line">to portrait mode</span>
          </div>

          <div className="orientation-subtitle">
            This game is optimized for vertical gameplay
          </div>

          {/* Visual indicator */}
          <div className="orientation-visual-guide">
            <div className="guide-line"></div>
            <div className="guide-text">
              <CaretRight size={16} weight="bold" />
              <span>Portrait</span>
            </div>
            <div className="guide-indicators">
              <div className="indicator active"></div>
              <div className="indicator"></div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="orientation-warning-border"></div>
        <div className="orientation-warning-scanline"></div>
      </div>
    </div>
  );
}

export default OrientationWarning;

