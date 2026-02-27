/**
 * ButtonEnhanced.tsx
 * Premium button component with enhanced states and animations
 * Improves upon the existing Button component with:
 * - Better loading states
 * - Enhanced hover/active animations
 * - Ripple effects
 * - Focus management
 * - Accessibility improvements
 */

import { forwardRef, useState, useRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useThemeClasses } from '../../theme/theme-context';

/**
 * Button variants with enhanced styling
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

/**
 * Button sizes with touch-friendly dimensions
 */
export type ButtonSize = "sm" | "md" | "lg" | "xl";

/**
 * Enhanced Button props
 */
export interface EnhancedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
  /** Enable ripple effect on click */
  ripple?: boolean;
  /** Show success state momentarily */
  showSuccess?: boolean;
  successDuration?: number;
}

/**
 * Size styles mapping with minimum touch targets
 */
const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm min-h-[40px]", // iOS minimum touch target
  md: "px-5 py-2.5 text-base min-h-[44px]", // Recommended touch target
  lg: "px-6 py-3 text-lg min-h-[48px]",
  xl: "px-8 py-4 text-xl min-h-[52px]",
};

/**
 * Enhanced Button Component
 *
 * @example
 * ```tsx
 * <EnhancedButton
 *   variant="primary"
 *   loading={isLoading}
 *   loadingText="Processing..."
 *   leftIcon={<SaveIcon />}
 * >
 *   Save Changes
 * </EnhancedButton>
 * ```
 */
export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      ripple = true,
      showSuccess = false,
      successDuration = 2000,
      disabled,
      className = "",
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const { theme } = useThemeClasses();
    const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
    const [isSuccess, setIsSuccess] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const rippleIdRef = useRef(0);

    // Combine refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(buttonRef.current);
      } else if (ref) {
        ref.current = buttonRef.current;
      }
    }, [ref]);

    // Handle success state
    useEffect(() => {
      if (showSuccess) {
        setIsSuccess(true);
        const timer = setTimeout(() => setIsSuccess(false), successDuration);
        return () => clearTimeout(timer);
      }
    }, [showSuccess, successDuration]);

    // Create ripple effect
    const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!ripple || !buttonRef.current) return;

      const button = buttonRef.current;
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const id = rippleIdRef.current++;
      setRipples((prev) => [...prev, { id, x, y }]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading || isSuccess) return;
      createRipple(event);
      onClick?.(event);
    };

    const baseStyles =
      "relative inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 overflow-hidden disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]";

    const variantStyles: Record<ButtonVariant, string> = {
      primary: theme === "dark"
        ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-400 hover:to-cyan-500 focus:ring-cyan-500 shadow-lg shadow-cyan-500/25 border border-transparent"
        : "bg-gradient-to-r from-cyan-600 to-cyan-700 text-white hover:from-cyan-500 hover:to-cyan-600 focus:ring-cyan-500 shadow-lg shadow-cyan-500/25 border border-transparent",
      secondary: theme === "dark"
        ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-400 hover:to-purple-500 focus:ring-purple-500 shadow-lg shadow-purple-500/25 border border-transparent"
        : "bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600 focus:ring-purple-500 shadow-lg shadow-purple-500/25 border border-transparent",
      ghost: theme === "dark"
        ? "bg-transparent text-gray-300 hover:bg-gray-800 focus:ring-gray-500 border border-gray-700"
        : "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border border-gray-300",
      danger: theme === "dark"
        ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 focus:ring-red-500 shadow-lg shadow-red-500/25 border border-transparent"
        : "bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 focus:ring-red-500 shadow-lg shadow-red-500/25 border border-transparent",
      success: theme === "dark"
        ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 focus:ring-emerald-500 shadow-lg shadow-emerald-500/25 border border-transparent"
        : "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-500 hover:to-emerald-600 focus:ring-emerald-500 shadow-lg shadow-emerald-500/25 border border-transparent",
    };

    // Success state overrides
    const successStyles = isSuccess
      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25"
      : "";

    const widthStyles = fullWidth ? "w-full" : "";

    const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${successStyles} ${className}`.trim();

    return (
      <button
        ref={buttonRef}
        disabled={disabled || loading || isSuccess}
        className={classes}
        onClick={handleClick}
        {...props}
      >
        {/* Ripple effects */}
        {ripple && (
          <span className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
            {ripples.map((r) => (
              <span
                key={r.id}
                className="absolute w-4 h-4 rounded-full bg-white/30 animate-ping"
                style={{
                  left: r.x,
                  top: r.y,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
          </span>
        )}

        {/* Loading spinner */}
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Success checkmark */}
        {isSuccess && (
          <svg
            className="w-4 h-4 animate-check-pop"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}

        {/* Left icon */}
        {leftIcon && !loading && !isSuccess && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Content */}
        <span className="relative z-10">
          {loading && loadingText ? loadingText : isSuccess ? "Success!" : children}
        </span>

        {/* Right icon */}
        {rightIcon && !loading && !isSuccess && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

EnhancedButton.displayName = "EnhancedButton";

/**
 * Button Group
 * For grouping related buttons
 */
export interface ButtonGroupProps {
  children: ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function ButtonGroup({
  children,
  orientation = "horizontal",
  className = "",
}: ButtonGroupProps) {
  return (
    <div
      className={`flex ${orientation === "vertical" ? "flex-col" : "flex-row"} gap-2 ${className}`}
      role="group"
    >
      {children}
    </div>
  );
}

export default EnhancedButton;
