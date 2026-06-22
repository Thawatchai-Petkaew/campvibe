/**
 * In-memory sliding-window rate limiter.
 *
 * LIMITATION — serverless / edge:
 *   Each serverless instance (Vercel function) has its own in-process Map.
 *   The counter resets on every cold start and is NOT shared across concurrent
 *   instances.  This is a best-effort baseline that protects against a single
 *   user hammering a single warm instance; it does not prevent distributed
 *   abuse across multiple instances.
 *
 *   For distributed rate limiting (shared state across all instances), use
 *   Upstash Redis or a similar edge-compatible store.  That is a cost decision
 *   deferred to the product owner — do NOT add it here without an explicit
 *   budget approval.
 */

export interface RateLimitResult {
    /** Whether the request is allowed under the current window. */
    allowed: boolean;
    /** How many requests remain in the current window. */
    remaining: number;
    /**
     * Seconds until the oldest request in the window expires.
     * Zero when `allowed` is true (no need to retry).
     */
    retryAfterSec: number;
}

export interface RateLimitOptions {
    /** Maximum number of requests permitted in the window. Default: 100. */
    limit?: number;
    /** Window length in milliseconds. Default: 15 minutes (900 000 ms). */
    windowMs?: number;
    /**
     * Inject a custom clock (milliseconds since epoch).
     * Defaults to `Date.now`.  Used by tests to avoid real timers.
     */
    now?: () => number;
}

// Module-level store: key → sorted array of request timestamps (ms).
// Exported only for testing purposes (reset between test suites).
export const _store: Map<string, number[]> = new Map();

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check whether `key` is within its rate-limit budget.
 *
 * The sliding window is maintained as a list of timestamps for the key.
 * Entries older than `windowMs` are pruned on every call, keeping memory
 * bounded to `limit` entries per key.
 *
 * @param key      - Identifies the subject being rate-limited (e.g. `wishlist:write:<userId>`).
 * @param opts     - Optional overrides for `limit`, `windowMs`, and `now`.
 * @returns        - `{ allowed, remaining, retryAfterSec }`.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions = {}): RateLimitResult {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    const now = opts.now ? opts.now() : Date.now();
    const windowStart = now - windowMs;

    // Retrieve and prune timestamps outside the current window.
    const timestamps = (_store.get(key) ?? []).filter((ts) => ts > windowStart);

    if (timestamps.length >= limit) {
        // The bucket is full.  Oldest entry determines when the window opens again.
        const oldestTs = timestamps[0]; // already sorted ascending (push-order)
        const retryAfterMs = oldestTs + windowMs - now;
        const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

        // Persist the pruned (but still-full) list back to the store.
        _store.set(key, timestamps);

        return { allowed: false, remaining: 0, retryAfterSec };
    }

    // Allow: record the current timestamp and persist.
    timestamps.push(now);
    _store.set(key, timestamps);

    return {
        allowed: true,
        remaining: limit - timestamps.length,
        retryAfterSec: 0,
    };
}
