/**
 * cn.ts
 * Utility function for merging Tailwind CSS classes
 * Lightweight alternative to clsx + twMerge
 */

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes
    .filter(Boolean)
    .join(' ')
    .replace(/(\S+)\s+\1/g, '$1') // Remove duplicates
    .trim();
}
