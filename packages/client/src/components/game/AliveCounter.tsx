/**
 * AliveCounter - Shows remaining players with dramatic styling
 * Biological/horror theme with pulsing effects
 */

import React, { memo, useMemo } from 'react';
import { useWs } from '../../WsProvider';

interface AliveCounterProps {
  /** Show/hide counter */
  show?: boolean;
  /** Mobile-optimized layout */
  isMobile?: boolean;
}

export const AliveCounter = memo(function AliveCounter({ show = true, isMobile = false }: AliveCounterProps) {
  const { state } = useWs();
  const aliveCount = state.game?.aliveCount ?? 0;
  const initialPlayers = state.initialPlayers?.length ?? 8;

  // Memoize computed values to prevent recalculation on every render
  const urgency = useMemo(() => {
    const percentage = initialPlayers > 0 ? aliveCount / initialPlayers : 1;
    if (percentage > 0.5) return 'safe';
    if (percentage > 0.25) return 'warning';
    return 'danger';
  }, [aliveCount, initialPlayers]);

  if (!show) return null;

  return (
    <div className={`alive-counter urgency-${urgency}${isMobile ? ' alive-counter-mobile' : ''}`}>
      <div className="alive-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-8 0-3.31 2.69-6 6-6s6 2.69 6 6c0 4.15-3.05 7.51-7 8-.08-.66-.14-1.32-.14-2 0-4.41 3.59-8 8-8s8 3.59 8 8c0 .68-.06 1.34-.14 2z"/>
        </svg>
      </div>
      <div className="alive-number">{aliveCount}</div>
      <div className="alive-slash">/</div>
      <div className="alive-total">{initialPlayers}</div>

      <style>{`
        .alive-counter {
          position: absolute;
          top: 12px;
          left: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 14px;
          border-radius: 20px;
          z-index: 60;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 700;
          transition: all 0.3s ease;
        }

        .alive-counter.urgency-safe {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.4);
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }

        .alive-counter.urgency-safe .alive-number,
        .alive-counter.urgency-safe .alive-total {
          color: #10b981;
          text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
        }

        .alive-counter.urgency-warning {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.4);
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
          animation: pulse-warning 2s ease-in-out infinite;
        }

        .alive-counter.urgency-warning .alive-number,
        .alive-counter.urgency-warning .alive-total {
          color: #f59e0b;
          text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
        }

        .alive-counter.urgency-danger {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.5);
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
          animation: pulse-danger 1s ease-in-out infinite;
        }

        .alive-counter.urgency-danger .alive-number,
        .alive-counter.urgency-danger .alive-total {
          color: #ffffff;
          text-shadow: 0 0 12px rgba(239, 68, 68, 0.9);
        }

        .alive-icon {
          display: flex;
          align-items: center;
          opacity: 0.9;
        }

        .alive-number {
          font-size: 20px;
          min-width: 24px;
          text-align: center;
        }

        .alive-slash {
          opacity: 0.5;
          font-size: 16px;
        }

        .alive-total {
          font-size: 14px;
          opacity: 0.6;
        }

        @keyframes pulse-warning {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes pulse-danger {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 40px rgba(239, 68, 68, 0.5);
          }
        }

        @media (max-width: 768px) {
          .alive-counter {
            top: calc(8px + env(safe-area-inset-top, 0px));
            left: calc(8px + env(safe-area-inset-left, 0px));
            padding: 6px 10px;
          }

          .alive-number {
            font-size: 16px;
            min-width: 20px;
          }

          .alive-slash {
            font-size: 12px;
          }

          .alive-total {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
});

export default AliveCounter;
