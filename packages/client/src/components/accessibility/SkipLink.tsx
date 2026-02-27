/**
 * SkipLink.tsx
 * Accessibility component for skip-to-content links
 * Allows keyboard users to skip navigation and jump directly to main content
 */

import { forwardRef } from 'react';

export interface SkipLinkProps {
  /** Target element ID to skip to */
  targetId: string;
  /** Link text */
  children: string;
  className?: string;
}

/**
 * Skip link component - hidden until focused
 * Press Tab to see the link, then Enter to jump to content
 */
export const SkipLink = forwardRef<HTMLAnchorElement, SkipLinkProps>(
  ({ targetId, children, className = '' }, ref) => {
    return (
      <a
        ref={ref}
        href={`#${targetId}`}
        className={`skip-link ${className}`.trim()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            const target = document.getElementById(targetId);
            if (target) {
              e.preventDefault();
              target.focus();
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }}
      >
        {children}
      </a>
    );
  }
);

SkipLink.displayName = 'SkipLink';

export default SkipLink;
