/**
 * Kill Streak Announcement
 * Displays kill streak announcements (Double Kill, Triple Kill, etc.)
 * Shows in center of screen with animation
 */

import { useEffect, useState, useCallback } from 'react';
import type { CombatEvent } from '../../game/engine/systems/CombatFeedbackSystem';

/**
 * Kill streak tier configuration
 */
interface StreakTier {
  name: string;
  color: string;
  scale: number;
}

const STREAK_TIERS: Record<number, StreakTier> = {
  2: { name: 'DOUBLE KILL!', color: '#22d3ee', scale: 1.0 },
  3: { name: 'TRIPLE KILL!', color: '#00ff88', scale: 1.1 },
  5: { name: 'MEGA KILL!', color: '#ff6b6b', scale: 1.2 },
  7: { name: 'ULTRA KILL!', color: '#ff00ff', scale: 1.3 },
  10: { name: 'GODLIKE!', color: '#ffd700', scale: 1.5 },
};

/**
 * Props
 */
export interface KillStreakAnnouncementProps {
  /** Combat events from CombatFeedbackSystem */
  events: CombatEvent[];

  /** Called when animation completes */
  onAnnouncementComplete?: (event: CombatEvent) => void;
}

/**
 * Announcement state
 */
interface Announcement {
  id: string;
  event: CombatEvent;
  tier: StreakTier;
  visible: boolean;
}

/**
 * Kill Streak Announcement component
 * Displays kill streak announcements with animations
 */
export function KillStreakAnnouncement({
  events,
  onAnnouncementComplete,
}: KillStreakAnnouncementProps) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  // Process new events
  useEffect(() => {
    const streakEvents = events.filter(e => e.type === 'kill_streak');
    if (streakEvents.length === 0) return;

    const latestEvent = streakEvents[streakEvents.length - 1];
    const streak = latestEvent.streak ?? 0;

    // Find matching tier
    const tier = Object.entries(STREAK_TIERS)
      .filter(([minKills]) => streak >= parseInt(minKills))
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))[0]?.[1];

    if (!tier) return;

    // Show announcement
    const id = `${latestEvent.timestamp}-${latestEvent.killerId}`;
    setAnnouncement({
      id,
      event: latestEvent,
      tier,
      visible: true,
    });

    // Auto-hide after 2 seconds
    const timeout = setTimeout(() => {
      setAnnouncement(null);
      onAnnouncementComplete?.(latestEvent);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [events, onAnnouncementComplete]);

  if (!announcement || !announcement.visible) return null;

  const { tier } = announcement;

  return (
    <div
      className="kill-streak-announcement"
      style={{
        position: 'fixed',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        textAlign: 'center',
        animation: 'killStreakIn 0.3s ease-out, killStreakOut 0.3s ease-in 1.7s forwards',
      }}
    >
      {/* Main text */}
      <div
        style={{
          fontSize: `${48 * tier.scale}px`,
          fontWeight: 900,
          color: tier.color,
          textShadow: `
            0 0 20px ${tier.color},
            0 0 40px ${tier.color},
            0 4px 8px rgba(0,0,0,0.8)
          `,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          animation: 'killStreakPulse 0.5s ease-in-out infinite alternate',
        }}
      >
        {tier.name}
      </div>

      {/* Killer name */}
      <div
        style={{
          marginTop: '10px',
          fontSize: '18px',
          fontWeight: 600,
          color: '#fff',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          opacity: 0.9,
        }}
      >
        {announcement.event.killerName}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes killStreakIn {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @keyframes killStreakOut {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.2);
          }
        }

        @keyframes killStreakPulse {
          0% {
            transform: scale(1);
          }
          100% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}

export default KillStreakAnnouncement;
