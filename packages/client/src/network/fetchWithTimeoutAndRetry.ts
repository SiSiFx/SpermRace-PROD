/**
 * Network Utilities with Timeout, Retry, and Error Handling
 *
 * Provides centralized fetch wrapper with:
 * - AbortController for timeout support
 * - Exponential backoff retry logic
 * - Comprehensive error handling
 * - Request deduplication
 * - Network status monitoring
 */

/**
 * Fetch options with timeout
 */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Whether to retry on 4xx errors (default: false) */
  retryOnClientError?: boolean;
  /** Request key for deduplication (optional) */
  dedupeKey?: string;
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Fetch result with metadata
 */
export interface FetchResult<T = any> {
  /** Response data (parsed JSON if possible) */
  data: T;
  /** HTTP status code */
  status: number;
  /** Number of retry attempts */
  attempts: number;
  /** Whether request was from cache (deduplication) */
  fromCache?: boolean;
}

/**
 * Network error types
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends NetworkError {
  constructor(timeout: number, originalError?: Error) {
    super(`Request timed out after ${timeout}ms`, 'TIMEOUT', undefined, originalError);
    this.name = 'TimeoutError';
  }
}

/**
 * Abort error
 */
export class AbortError extends NetworkError {
  constructor(originalError?: Error) {
    super('Request was aborted', 'ABORT', undefined, originalError);
    this.name = 'AbortError';
  }
}

/**
 * Pending request cache for deduplication
 */
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Clear expired pending requests (cleanup)
 */
setInterval(() => {
  // Note: This is a simple cleanup - in production, you might want
  // to track request timestamps and only clear old ones
  if (pendingRequests.size > 100) {
    pendingRequests.clear();
  }
}, 60000); // Clean up every minute

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number, baseDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter: +/- 25% random variation
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown, status?: number, retryOnClientError = false): boolean {
  // Don't retry if it was an abort
  if (error instanceof AbortError || error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  // Retry on network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Retry on specific HTTP status codes
  if (status) {
    // 5xx errors are always retryable
    if (status >= 500 && status < 600) {
      return true;
    }
    // 408 Request Timeout, 429 Too Many Requests
    if (status === 408 || status === 429) {
      return true;
    }
    // 4xx errors only if retryOnClientError is true
    if (status >= 400 && status < 500 && retryOnClientError) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch with timeout and retry logic
 *
 * @example
 * ```ts
 * // Basic usage
 * const result = await fetchWithRetry('/api/data');
 *
 * // With custom timeout and retries
 * const result = await fetchWithRetry('/api/data', {
 *   timeout: 5000,
 *   maxRetries: 5,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 *
 * // With retry callback
 * const result = await fetchWithRetry('/api/data', {
 *   onRetry: (attempt, error) => {
 *     console.log(`Retry attempt ${attempt}:`, error.message);
 *   }
 * });
 * ```
 */
export async function fetchWithRetry<T = any>(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = 10000,
    maxRetries = 3,
    retryDelay = 1000,
    retryOnClientError = false,
    dedupeKey,
    onRetry,
    ...fetchOptions
  } = options;

  // Check for deduplication
  if (dedupeKey) {
    const pending = pendingRequests.get(dedupeKey);
    if (pending) {
      return { data: await pending, status: 0, attempts: 0, fromCache: true };
    }
  }

  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++;

    // Create abort controller for timeout (outside try to be accessible in catch)
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);

      // Combine signal options
      let signal = controller.signal;
      if (fetchOptions.signal) {
        // If a signal is already provided, chain them
        const originalSignal = fetchOptions.signal;
        const chainedController = new AbortController();

        // Abort both if either is aborted
        originalSignal.addEventListener('abort', () => chainedController.abort());
        controller.signal.addEventListener('abort', () => chainedController.abort());

        signal = chainedController.signal;
      }

      // Execute fetch
      const response = await fetch(input, {
        ...fetchOptions,
        signal,
      });

      clearTimeout(timeoutId);

      // Check for HTTP errors
      if (!response.ok) {
        const error = new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status
        );

        // Check if we should retry
        if (attempt < maxRetries && isRetryableError(error, response.status, retryOnClientError)) {
          lastError = error;
          const delay = getRetryDelay(attempt, retryDelay);
          onRetry?.(attempt + 1, error);
          await sleep(delay);
          continue;
        }

        throw error;
      }

      // Parse response
      const contentType = response.headers.get('content-type');
      let data: T;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as T;
      }

      return {
        data,
        status: response.status,
        attempts,
      };

    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      lastError = error as Error;

      // Determine error type
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new TimeoutError(timeout, error as Error);
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new AbortError(error as Error);
      }

      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(lastError, undefined, retryOnClientError)) {
        const delay = getRetryDelay(attempt, retryDelay);
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
        continue;
      }

      throw lastError;
    }
  }

  // If we've exhausted retries, throw the last error
  throw lastError || new NetworkError('Max retries exceeded', 'MAX_RETRIES_EXCEEDED');
}

/**
 * Deduplicated fetch - prevents multiple concurrent requests for the same resource
 *
 * @example
 * ```ts
 * // Multiple components can safely call this simultaneously
 * // Only one actual request will be made
 * const data = await deduplicatedFetch('/api/config', { key: 'config' });
 * ```
 */
export async function deduplicatedFetch<T = any>(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions & { key: string } = {} as any
): Promise<T> {
  const { key, ...fetchOptions } = options;

  if (!key) {
    throw new Error('deduplicatedFetch requires a unique "key" option');
  }

  // Check if request is already pending
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Create new request promise
  const promise = fetchWithRetry<T>(input, fetchOptions)
    .then(result => result.data)
    .finally(() => {
      // Remove from cache after completion
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Network status monitoring
 */
export interface NetworkStatus {
  /** Whether the browser thinks we're online */
  online: boolean;
  /** Measured latency to server (ms) or null if unknown */
  latency: number | null;
  /** Whether we've detected recent network issues */
  degraded: boolean;
}

class NetworkMonitor {
  private status: NetworkStatus = {
    online: navigator.onLine,
    latency: null,
    degraded: false,
  };
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private healthCheckUrl: string;
  private healthCheckInterval: number | null = null;

  constructor(healthCheckUrl = '/api/health') {
    this.healthCheckUrl = healthCheckUrl;

    // Listen for online/offline events
    window.addEventListener('online', () => this.updateStatus({ online: true }));
    window.addEventListener('offline', () => this.updateStatus({ online: false, degraded: true }));
  }

  /**
   * Subscribe to network status changes
   */
  subscribe(callback: (status: NetworkStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.status);

    // Return unsubscribe function
    return () => this.listeners.delete(callback);
  }

  /**
   * Get current status
   */
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(updates: Partial<NetworkStatus>): void {
    this.status = { ...this.status, ...updates };
    this.listeners.forEach(cb => cb(this.status));
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs = 30000): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = window.setInterval(async () => {
      const start = performance.now();
      try {
        await fetch(this.healthCheckUrl, {
          method: 'HEAD',
          cache: 'no-cache',
        });
        const latency = performance.now() - start;
        this.updateStatus({
          online: true,
          latency,
          degraded: latency > 1000,
        });
      } catch {
        this.updateStatus({
          online: false,
          degraded: true,
        });
      }
    }, intervalMs);

    // Run initial check
    this.runHealthCheck();
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Run a single health check
   */
  async runHealthCheck(): Promise<void> {
    const start = performance.now();
    try {
      await fetch(this.healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-cache',
      });
      const latency = performance.now() - start;
      this.updateStatus({
        online: true,
        latency,
        degraded: latency > 1000,
      });
    } catch {
      this.updateStatus({
        online: false,
        degraded: true,
      });
    }
  }

  /**
   * Measure latency to a specific URL
   */
  async measureLatency(url: string): Promise<number | null> {
    const start = performance.now();
    try {
      await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache',
      });
      return performance.now() - start;
    } catch {
      return null;
    }
  }
}

// Global network monitor instance
let globalMonitor: NetworkMonitor | null = null;

/**
 * Get the global network monitor
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!globalMonitor) {
    globalMonitor = new NetworkMonitor('/api/health');
  }
  return globalMonitor;
}

/**
 * Hook-like function to use network status in React components
 */
export function useNetworkStatus(): NetworkStatus {
  const monitor = getNetworkMonitor();
  return monitor.getStatus();
}

/**
 * POST with automatic JSON serialization
 */
export async function postJSON<T = any>(
  input: RequestInfo | URL,
  data: any,
  options: FetchWithTimeoutOptions = {}
): Promise<FetchResult<T>> {
  return fetchWithRetry<T>(input, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
}

/**
 * GET with automatic error handling
 */
export async function getJSON<T = any>(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<FetchResult<T>> {
  return fetchWithRetry<T>(input, {
    ...options,
    method: 'GET',
    headers: options.headers,
  });
}

/**
 * Batch multiple requests in parallel
 */
export async function batchFetch<T = any>(
  requests: Array<{ input: RequestInfo | URL; options?: FetchWithTimeoutOptions }>
): Promise<FetchResult<T>[]> {
  return Promise.all(
    requests.map(({ input, options }) => fetchWithRetry<T>(input, options))
  );
}
