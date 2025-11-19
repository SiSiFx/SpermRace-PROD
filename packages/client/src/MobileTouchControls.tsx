import { useEffect, useState, useRef, memo } from 'react';
import './mobile-controls.css';

interface TouchPosition {
  x: number;
  y: number;
}

interface MobileTouchControlsProps {
  onTouch: (x: number, y: number) => void;
  onBoost: () => void;
  canBoost: boolean;
  boostCooldownPct: number;
}

export const MobileTouchControls = memo(function MobileTouchControls({ onTouch, onBoost, canBoost, boostCooldownPct }: MobileTouchControlsProps) {
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  
  const joystickStart = useRef<TouchPosition>({ x: 0, y: 0 });
  const joystickCurrent = useRef<TouchPosition>({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const boostRef = useRef<HTMLButtonElement>(null);
  const stickElement = useRef<HTMLDivElement>(null);
  const boostTouchId = useRef<number | null>(null);

  // Dynamic joystick recentering logic
  const updateStickPosition = (touchX: number, touchY: number, centerX: number, centerY: number) => {
    if (!stickElement.current) return;
    
    const maxRadius = 50; // Increased radius for better precision
    let dx = touchX - centerX;
    let dy = touchY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    stickElement.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  useEffect(() => {
    const touchArea = touchAreaRef.current;
    if (!touchArea) return;

    const handleTouchStart = (e: TouchEvent) => {
      // If we already have an active joystick, ignore new touches in this area
      // unless we want to allow "re-grabbing" which can be complex. 
      // For simple robust controls, one joystick touch at a time.
      if (joystickTouchId.current !== null) return;

      e.preventDefault();
      
      // Find a touch that isn't the boost button touch
      let joystickTouch: Touch | null = null;
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // If this touch is on the left side of screen OR we haven't assigned a boost touch yet
        if (t.identifier !== boostTouchId.current) {
           joystickTouch = t;
           break;
        }
      }

      if (!joystickTouch) return;

      joystickTouchId.current = joystickTouch.identifier;
      const centerX = joystickTouch.clientX;
      const centerY = joystickTouch.clientY;

      setJoystickPosition({ x: centerX, y: centerY });
      joystickStart.current = { x: centerX, y: centerY };
      joystickCurrent.current = { x: joystickTouch.clientX, y: joystickTouch.clientY };
      setJoystickActive(true);

      // Instant feedback
      try { navigator.vibrate?.(5); } catch {}
      onTouch(0, 0);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current === null) return;

      // Find the active joystick touch by ID
      let currentTouch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          currentTouch = e.changedTouches[i];
          break;
        }
      }

      if (!currentTouch) return;

      joystickCurrent.current = { x: currentTouch.clientX, y: currentTouch.clientY };
      updateStickPosition(currentTouch.clientX, currentTouch.clientY, joystickStart.current.x, joystickStart.current.y);

      const dx = currentTouch.clientX - joystickStart.current.x;
      const dy = currentTouch.clientY - joystickStart.current.y;
      onTouch(dx, dy);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (joystickTouchId.current === null) return;

      // Check if our joystick touch ended
      let joystickEnded = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joystickTouchId.current) {
          joystickEnded = true;
          break;
        }
      }

      if (joystickEnded) {
        setJoystickActive(false);
        joystickTouchId.current = null;
        onTouch(0, 0);
      }
    };

    touchArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchArea.addEventListener('touchend', handleTouchEnd, { passive: false });
    touchArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      touchArea.removeEventListener('touchstart', handleTouchStart);
      touchArea.removeEventListener('touchmove', handleTouchMove);
      touchArea.removeEventListener('touchend', handleTouchEnd);
      touchArea.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onTouch]);

  useEffect(() => {
    const boost = boostRef.current;
    if (!boost) return;

    const handleBoostStart = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      boostTouchId.current = t.identifier;
      
      if (canBoost) {
        onBoost();
        // Stronger haptic for boost
        try { navigator.vibrate?.([15]); } catch {} 
        
        // Visual press effect
        boost.style.transform = 'scale(0.92)';
      }
    };

    const handleBoostEnd = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      boostTouchId.current = null;
      boost.style.transform = 'scale(1)';
    };

    boost.addEventListener('touchstart', handleBoostStart, { passive: false });
    boost.addEventListener('touchend', handleBoostEnd, { passive: false });
    boost.addEventListener('touchcancel', handleBoostEnd, { passive: false });
    
    return () => {
      boost.removeEventListener('touchstart', handleBoostStart);
      boost.removeEventListener('touchend', handleBoostEnd);
      boost.removeEventListener('touchcancel', handleBoostEnd);
    };
  }, [canBoost, onBoost]);

  return (
    <>
      <div
        ref={touchAreaRef}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '60%',
          height: '100%',
          zIndex: 10,
          pointerEvents: 'auto',
          touchAction: 'none'
        }}
      />

      {joystickActive && (
        <div
          className="mobile-joystick active"
          style={{
            position: 'fixed',
            left: `${joystickPosition.x}px`,
            top: `${joystickPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 15
          }}
        >
          <div className="joystick-base">
            <div className="joystick-ring" />
          </div>
          <div
            ref={stickElement}
            className="joystick-stick"
            style={{ transform: 'translate(0, 0)' }}
          />
        </div>
      )}

      <button
        ref={boostRef}
        className={`mobile-boost-button ${canBoost ? 'ready' : 'cooldown'}`}
        disabled={!canBoost}
      >
        <div className="boost-icon">⚡</div>
        <div className="boost-label">BOOST</div>
        <svg className="boost-cooldown-ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" className="cooldown-bg" />
          <circle
            cx="50"
            cy="50"
            r="45"
            className="cooldown-progress"
            style={{ strokeDashoffset: 283 * (1 - boostCooldownPct) }}
          />
        </svg>
      </button>
    </>
  );
});
