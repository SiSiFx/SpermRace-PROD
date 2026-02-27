/**
 * Simple utility for joining CSS class names
 * Lightweight alternative to clsx/classnames
 */

export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
