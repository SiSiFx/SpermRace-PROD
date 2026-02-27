/**
 * Mobile Performance Utilities
 * Collection of utilities for optimizing mobile performance
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook that defers non-critical updates until browser is idle
 * Helps prevent jank during animations and user interactions
 */
export function useDeferredUpdate<T>(value: T, delayMs: number = 100): T {
  const [deferredValue, setDeferredValue] = useState(value);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    // Clear any pending update
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule deferred update
    timeoutRef.current = window.setTimeout(() => {
      setDeferredValue(value);
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delayMs]);

  return deferredValue;
}

/**
 * Hook for managing intersection observer with performance optimizations
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Check if IntersectionObserver is available
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true); // Fallback: always visible
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, {
      // Performance-optimized defaults
      rootMargin: '50px',
      threshold: 0.01,
      ...options,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [elementRef, isVisible] as const;
}

/**
 * Memoization helper for expensive computations
 */
export function useMemoize<T extends (...args: any[]) => any>(
  fn: T,
  cacheSize: number = 10
): T {
  const cache = useRef<Map<string, ReturnType<T>>>(new Map());

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.current.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);

    // Implement LRU cache
    if (cache.current.size >= cacheSize) {
      const firstKey = cache.current.keys().next().value;
      cache.current.delete(firstKey);
    }

    cache.current.set(key, result);
    return result;
  }) as T;
}

/**
 * Virtual list helper for rendering large lists efficiently
 */
export interface VirtualListOptions {
  itemCount: number;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function useVirtualList(options: VirtualListOptions) {
  const { itemCount, itemHeight, containerHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(itemCount - 1, visibleEnd + overscan);

  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems: endIndex - startIndex + 1,
    startIndex,
    endIndex,
    offsetY,
    totalHeight: itemCount * itemHeight,
    handleScroll,
  };
}

/**
 * Image preloading utility
 */
export function useImagePreload(urls: string[]) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadImages = async () => {
      for (const url of urls) {
        if (loadedImages.has(url) || failedImages.has(url)) continue;

        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
          });

          if (!cancelled) {
            setLoadedImages((prev) => new Set(prev).add(url));
          }
        } catch {
          if (!cancelled) {
            setFailedImages((prev) => new Set(prev).add(url));
          }
        }
      }
    };

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [urls]);

  return { loadedImages, failedImages, isLoaded: (url: string) => loadedImages.has(url) };
}

/**
 * RAF-based animation loop for smooth 60fps updates
 */
export function useRAFLoop(callback: () => void, isActive: boolean = true) {
  const rafRef = useRef<number>();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const loop = () => {
      callbackRef.current();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive]);
}

/**
 * Memory leak prevention for async operations
 */
export function useCancellableEffect() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const wrap = useCallback(<T,>(promise: Promise<T>): Promise<T | null> => {
    return promise.then(
      (value) => (isMountedRef.current ? value : null),
      (error) => (isMountedRef.current ? Promise.reject(error) : null)
    );
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  return { wrap, isMounted };
}

/**
 * Optimized resize observer with debounce
 */
export function useOptimizedResize(
  callback: () => void,
  delay: number = 100
) {
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const handleResize = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        callback();
      }, delay);
    };

    // Use passive listener for better scroll performance
    window.addEventListener('resize', handleResize, { passive: true } as any);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [callback, delay]);
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string) {
    const start = this.marks.get(startMark);
    if (!start) return;

    const duration = performance.now() - start;
    const measures = this.measures.get(name) || [];
    measures.push(duration);
    this.measures.set(name, measures);

    // Log in development
    if (import.meta.env?.DEV) {
      // Perf logging disabled
    }
  }

  getAverage(name: string): number {
    const measures = this.measures.get(name);
    if (!measures || measures.length === 0) return 0;

    const sum = measures.reduce((a, b) => a + b, 0);
    return sum / measures.length;
  }

  getStats(name: string) {
    const measures = this.measures.get(name);
    if (!measures || measures.length === 0) return null;

    const sorted = [...measures].sort((a, b) => a - b);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: this.getAverage(name),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      count: sorted.length,
    };
  }

  reset() {
    this.marks.clear();
    this.measures.clear();
  }
}

/**
 * FPS counter for monitoring render performance
 */
export function useFPS() {
  const [fps, setFps] = useState(60);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>();

  useEffect(() => {
    const frame = () => {
      frameRef.current++;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        setFps(Math.round((frameRef.current * 1000) / delta));
        frameRef.current = 0;
        lastTimeRef.current = now;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return fps;
}

/**
 * Memory usage monitoring (where available)
 */
export function useMemoryUsage() {
  const [memory, setMemory] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    if ('memory' in performance) {
      const updateMemory = () => {
        const mem = (performance as any).memory;
        setMemory({
          usedJSHeapSize: mem.usedJSHeapSize,
          totalJSHeapSize: mem.totalJSHeapSize,
          jsHeapSizeLimit: mem.jsHeapSizeLimit,
        });
      };

      const interval = setInterval(updateMemory, 5000);
      updateMemory();

      return () => clearInterval(interval);
    }
  }, []);

  return memory;
}

/**
 * Optimized list rendering with key management
 */
export function createOptimizedListKey(item: any, index: number) {
  // Use item.id if available, otherwise fall back to index
  return item?.id ?? item?.key ?? `item-${index}`;
}

/**
 * Web Worker helper for offloading heavy computations
 */
export function useWebWorker<T, R>(
  workerFn: (data: T) => R,
  dependencies: any[] = []
) {
  const [result, setResult] = useState<R | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const execute = useCallback(async (data: T): Promise<R> => {
    setIsProcessing(true);
    setError(null);

    try {
      // Create inline worker
      const blob = new Blob([
        `self.onmessage = (e) => { postMessage((${workerFn.toString()})(e.data)); }`
      ], { type: 'application/javascript' });

      const worker = new Worker(URL.createObjectURL(blob));

      return new Promise<R>((resolve, reject) => {
        worker.onmessage = (e) => {
          setResult(e.data);
          resolve(e.data);
          worker.terminate();
          setIsProcessing(false);
        };

        worker.onerror = (err) => {
          const error = new Error(err.message);
          setError(error);
          reject(error);
          worker.terminate();
          setIsProcessing(false);
        };

        worker.postMessage(data);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Worker error');
      setError(error);
      setIsProcessing(false);
      throw error;
    }
  }, [workerFn, ...dependencies]);

  return { execute, result, error, isProcessing };
}

/**
 * Optimized scroll handler with passive listeners
 */
export function usePassiveScroll(
  onScroll: (event: Event) => void,
  element?: HTMLElement | Window
) {
  const callbackRef = useRef(onScroll);

  useEffect(() => {
    callbackRef.current = onScroll;
  }, [onScroll]);

  useEffect(() => {
    const target = element || window;
    const handler = (e: Event) => callbackRef.current(e);

    target.addEventListener('scroll', handler, { passive: true } as any);

    return () => {
      target.removeEventListener('scroll', handler);
    };
  }, [element]);
}

/**
 * Throttle utility for high-frequency events
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): T {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;

  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = fn(...args);
      setTimeout(() => (inThrottle = false), limit);
    }
    return lastResult;
  }) as T;
}

/**
 * Check if device is low-end
 */
export function isLowEndDevice(): boolean {
  // Check for low memory
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    const memMB = mem.jsHeapSizeLimit / (1024 * 1024);
    if (memMB < 500) return true;
  }

  // Check for slow CPU (heuristic)
  const cores = navigator.hardwareConcurrency || 2;
  if (cores <= 2) return true;

  return false;
}

/**
 * Disable animations on low-end devices
 */
export function useReducedAnimations() {
  const [reduce, setReduce] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || isLowEndDevice()
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = () => setReduce(mediaQuery.matches || isLowEndDevice());

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return reduce;
}

export default {
  useDeferredUpdate,
  useIntersectionObserver,
  useMemoize,
  useVirtualList,
  useImagePreload,
  useRAFLoop,
  useCancellableEffect,
  useOptimizedResize,
  PerformanceMonitor,
  useFPS,
  useMemoryUsage,
  createOptimizedListKey,
  useWebWorker,
  usePassiveScroll,
  throttle,
  isLowEndDevice,
  useReducedAnimations,
};
