/**
 * PremiumModal - Casino-style modal overlay
 * Dark blur backdrop, glass content, smooth animations
 */

import { forwardRef, HTMLAttributes, ReactNode, useEffect } from 'react';
import { classNames } from '../../../utils/classNames';

export interface PremiumModalProps extends HTMLAttributes<HTMLDivElement> {
  /** Modal open state */
  isOpen: boolean;
  /** On close callback */
  onClose?: () => void;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on escape key */
  closeOnEscape?: boolean;
  /** Show close button */
  showCloseButton?: boolean;
  /** Footer content */
  footer?: ReactNode;
}

export const PremiumModal = forwardRef<HTMLDivElement, PremiumModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      size = 'md',
      closeOnBackdrop = true,
      closeOnEscape = true,
      showCloseButton = true,
      footer,
      children,
      className,
      style,
      ...props
    },
    ref
  ) => {
    // Handle escape key
    useEffect(() => {
      if (!isOpen || !closeOnEscape) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onClose) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, closeOnEscape, onClose]);

    // Lock body scroll when open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    if (!isOpen) return null;

    const sizeStyles: Record<string, { maxWidth: string; width: string }> = {
      sm: { maxWidth: '400px', width: '90%' },
      md: { maxWidth: '500px', width: '90%' },
      lg: { maxWidth: '700px', width: '90%' },
      xl: { maxWidth: '900px', width: '90%' },
      full: { maxWidth: '95vw', width: '95vw' },
    };

    const backdropStyle: React.CSSProperties = {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 9999,
      animation: 'modalFadeIn 0.2s ease-out',
    };

    const modalStyle: React.CSSProperties = {
      position: 'relative',
      background: 'rgba(10, 14, 23, 0.95)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6)',
      maxHeight: '90vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      animation: 'modalScaleIn 0.2s ease-out',
      ...sizeStyles[size],
      ...style,
    };

    const headerStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 24px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    };

    const titleStyle: React.CSSProperties = {
      margin: 0,
      fontSize: '18px',
      fontWeight: 700,
      color: '#ffffff',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    };

    const closeButtonStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      padding: 0,
      background: 'transparent',
      border: 'none',
      borderRadius: '6px',
      color: '#9ca3af',
      cursor: 'pointer',
      fontSize: '20px',
      transition: 'all 0.2s ease-out',
    };

    const contentStyle: React.CSSProperties = {
      flex: 1,
      padding: '24px',
      overflowY: 'auto',
    };

    const footerStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '16px 24px',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && closeOnBackdrop && onClose) {
        onClose();
      }
    };

    return (
      <div
        style={backdropStyle}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        <div
          ref={ref}
          className={classNames('premium-modal', `premium-modal-${size}`, className)}
          style={modalStyle}
          {...props}
        >
          {(title || showCloseButton) && (
            <div style={headerStyle}>
              {title && <h2 id="modal-title" style={titleStyle}>{title}</h2>}
              {showCloseButton && (
                <button
                  style={closeButtonStyle}
                  onClick={onClose}
                  aria-label="Close modal"
                  className="premium-modal-close"
                >
                  &times;
                </button>
              )}
            </div>
          )}
          <div style={contentStyle}>{children}</div>
          {footer && <div style={footerStyle}>{footer}</div>}
        </div>
      </div>
    );
  }
);

PremiumModal.displayName = 'PremiumModal';
