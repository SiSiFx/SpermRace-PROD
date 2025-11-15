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
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const boostRef = useRef<HTMLButtonElement>(null);
  const stickElement = useRef<HTMLDivElement>(null);

  const updateStickPosition = (touchX: number, touchY: number, centerX: number, centerY: number) => {
    if (!stickElement.current) return;
    
    const maxRadius = 40;
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
      if (e.targetTouches.length === 0) return;
      e.preventDefault();
      
      const touch = e.targetTouches[0];
      const centerX = touch.clientX;
      const centerY = touch.clientY;

      setJoystickPosition({ x: centerX, y: centerY });
      joystickStart.current = { x: centerX, y: centerY };
      joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
      setJoystickActive(true);

      onTouch(0, 0);
      try { navigator.vibrate?.(10); } catch {}
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.targetTouches.length === 0) return;
      e.preventDefault();
      
      const touch = e.targetTouches[0];
      joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
      updateStickPosition(touch.clientX, touch.clientY, joystickStart.current.x, joystickStart.current.y);

      const dx = touch.clientX - joystickStart.current.x;
      const dy = touch.clientY - joystickStart.current.y;
      onTouch(dx, dy);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      setJoystickActive(false);
      onTouch(0, 0);
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

    const handleBoostTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canBoost) return;
      onBoost();
      try { navigator.vibrate?.(50); } catch {}
    };

    boost.addEventListener('touchstart', handleBoostTouch, { passive: false });
    return () => boost.removeEventListener('touchstart', handleBoostTouch);
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
