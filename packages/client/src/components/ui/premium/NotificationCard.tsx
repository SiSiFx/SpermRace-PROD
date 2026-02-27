/**
 * NotificationCard - Premium notification card matching KillFeed style
 * Slide-in animation, glass morphism, icon support
 */

import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { classNames } from '../../../utils/classNames';

export interface NotificationCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Notification type */
  type?: 'elimination' | 'achievement' | 'info' | 'warning' | 'success';
  /** Notification message */
  message: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Optional secondary text */
  subtext?: string;
  /** Animation delay in ms */
  animationDelay?: number;
  /** Auto-dismiss after ms (0 = no dismiss) */
  dismissAfter?: number;
  /** On dismiss callback */
  onDismiss?: () => void;
}

export const NotificationCard = forwardRef<HTMLDivElement, NotificationCardProps>(
  (
    {
      type = 'info',
      message,
      icon,
      subtext,
      animationDelay = 0,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const typeStyles: Record<string, { borderColor: string; accentColor: string }> = {
      elimination: {
        borderColor: 'rgba(220, 38, 38, 0.5)',
        accentColor: '#dc2626',
      },
      achievement: {
        borderColor: 'rgba(245, 158, 11, 0.5)',
        accentColor: '#f59e0b',
      },
      info: {
        borderColor: 'rgba(59, 130, 246, 0.5)',
        accentColor: '#3b82f6',
      },
      warning: {
        borderColor: 'rgba(245, 158, 11, 0.5)',
        accentColor: '#f59e0b',
      },
      success: {
        borderColor: 'rgba(16, 185, 129, 0.5)',
        accentColor: '#10b981',
      },
    };

    const { borderColor, accentColor } = typeStyles[type];

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      background: 'rgba(0, 0, 0, 0.85)',
      border: `2px solid ${borderColor}`,
      borderRadius: '4px',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      animation: `notificationSlide 0.3s ease-out ${animationDelay}ms both`,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      ...style,
    };

    const iconStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: accentColor,
      flexShrink: 0,
    };

    const messageStyle: React.CSSProperties = {
      fontSize: '13px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#ffffff',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    };

    const subtextStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: 600,
      color: accentColor,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    };

    return (
      <div
        ref={ref}
        className={classNames('notification-card', `notification-card-${type}`, className)}
        style={containerStyle}
        role="alert"
        {...props}
      >
        {icon && <div style={iconStyle}>{icon}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <span style={messageStyle}>{message}</span>
          {subtext && <span style={subtextStyle}>{subtext}</span>}
        </div>
      </div>
    );
  }
);

NotificationCard.displayName = 'NotificationCard';
