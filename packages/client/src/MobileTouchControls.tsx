import { useEffect, useState, useRef } from 'react';
import './mobile-controls.css';

interface TouchPosition {
  x: number;
  y: number;
}

interface MobileTouchControlsProps {
  onTouch: (x: number, y: number) => void;
  onBoost: () => void;
  canBoost: boolean;
  boostCooldownPct: number; // 0-1, where 1 = ready
}

export function MobileTouchControls({ onTouch, onBoost, canBoost, boostCooldownPct }: MobileTouchControlsProps) {
  const [joystickActive, setJoystickActive] = useState(false);
  
  // Use refs instead of state to avoid re-renders (better performance)
  const joystickStart = useRef<TouchPosition>({ x: 0, y: 0 });
  const joystickCurrent = useRef<TouchPosition>({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);
  const boostRef = useRef<HTMLButtonElement>(null);
  const stickElement = useRef<HTMLDivElement>(null);

  // Handle joystick area touch - proper multi-touch using targetTouches
  useEffect(() => {
    const joystick = joystickRef.current;
    if (!joystick) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Use targetTouches - touches currently on THIS element
      if (e.targetTouches.length === 0) return;
      
      // Only preventDefault for touches on this element
      e.preventDefault();
      
      const touch = e.targetTouches[0]; // First touch on joystick
      
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Use refs for instant updates (no re-render lag)
      joystickStart.current = { x: centerX, y: centerY };
      joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
      setJoystickActive(true);

      // Update stick position directly for instant feedback
      updateStickPosition(touch.clientX, touch.clientY, centerX, centerY);

      // Send initial direction
      onTouch(touch.clientX - centerX, touch.clientY - centerY);

      // Haptic feedback
      try { navigator.vibrate?.(10); } catch {}
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Use targetTouches for active touches on this element
      if (e.targetTouches.length === 0) return;
      
      // Only preventDefault for our element's touches
      e.preventDefault();
      
      const touch = e.targetTouches[0];
      
      // Update ref directly (no re-render)
      joystickCurrent.current = { x: touch.clientX, y: touch.clientY };
      
      // Update stick position directly for instant visual feedback
      updateStickPosition(touch.clientX, touch.clientY, joystickStart.current.x, joystickStart.current.y);

      // Send direction relative to joystick center
      const dx = touch.clientX - joystickStart.current.x;
      const dy = touch.clientY - joystickStart.current.y;
      onTouch(dx, dy);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      setJoystickActive(false);
      onTouch(0, 0); // Reset to center
    };

    joystick.addEventListener('touchstart', handleTouchStart, { passive: false });
    joystick.addEventListener('touchmove', handleTouchMove, { passive: false });
    joystick.addEventListener('touchend', handleTouchEnd, { passive: false });
    joystick.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      joystick.removeEventListener('touchstart', handleTouchStart);
      joystick.removeEventListener('touchmove', handleTouchMove);
      joystick.removeEventListener('touchend', handleTouchEnd);
      joystick.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onTouch]);

  // Direct DOM manipulation for stick position (no React re-render)
  const updateStickPosition = (touchX: number, touchY: number, centerX: number, centerY: number) => {
    if (!stickElement.current) return;
    
    const maxRadius = 25; // pixels
    let dx = touchX - centerX;
    let dy = touchY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    stickElement.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  // Handle boost button with touch events for better multi-touch support
  useEffect(() => {
    const boost = boostRef.current;
    if (!boost) return;

    const handleBoostTouch = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!canBoost) return;
      
      onBoost();
      
      // Haptic feedback
      try { navigator.vibrate?.(50); } catch {}
    };

    boost.addEventListener('touchstart', handleBoostTouch, { passive: false });
    
    return () => {
      boost.removeEventListener('touchstart', handleBoostTouch);
    };
  }, [canBoost, onBoost]);

  return (
    <>
      {/* Virtual Joystick - Left side */}
      <div
        ref={joystickRef}
        className={`mobile-joystick ${joystickActive ? 'active' : ''}`}
      >
        <div className="joystick-base">
          <div className="joystick-ring" />
        </div>
        <div
          ref={stickElement}
          className="joystick-stick"
          style={{
            transform: 'translate(0, 0)' // Direct DOM manipulation via ref
          }}
        />
        <div className="joystick-hint">STEER</div>
      </div>

      {/* Boost Button - Right side */}
      <button
        ref={boostRef}
        className={`mobile-boost-button ${canBoost ? 'ready' : 'cooldown'}`}
        disabled={!canBoost}
        style={{
          // Remove flash effect - causes big square glitch
        }}
      >
        <div className="boost-icon">⚡</div>
        <div className="boost-label">BOOST</div>
        <svg className="boost-cooldown-ring" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            className="cooldown-bg"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            className="cooldown-progress"
            style={{
              strokeDashoffset: 283 * (1 - boostCooldownPct)
            }}
          />
        </svg>
      </button>

      {/* Touch indicator hint removed - was blocking interactions */}
    </>
  );
}

export default MobileTouchControls;

