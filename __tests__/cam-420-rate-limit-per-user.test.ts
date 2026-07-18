/**
 * cam-420-rate-limit-per-user.test.ts — CAM-420 (ADR-013 D6, Security
 * forward-flag) `checkAssistantRateLimitForUser`, the per-user sibling of
 * CAM-270's per-IP `checkAssistantRateLimit` — same contract numbers
 * (30 requests / 15 min), a different key shape (`ai-assistant:user:<id>`).
 *
 * Coverage matrix:
 *   - normal: under the limit -> allowed
 *   - boundary: exactly at the limit -> the next call is denied
 *   - error/validation: over-limit -> denied with retryAfterSec > 0
 *   - concurrent/ordering: two different users (and the per-IP key) are
 *     isolated from each other — proves this is an ADDITIVE guard, not a
 *     shared bucket with the per-IP one.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkAssistantRateLimit,
  checkAssistantRateLimitForUser,
  AI_ASSISTANT_RATE_LIMIT,
} from '@/lib/ai/rate-limit';
import { _store } from '@/lib/rate-limit';

beforeEach(() => {
  _store.clear();
});

describe('checkAssistantRateLimitForUser — normal', () => {
  it('[unit] allows the first request for a fresh user', () => {
    const result = checkAssistantRateLimitForUser('user-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AI_ASSISTANT_RATE_LIMIT - 1);
  });
});

describe('checkAssistantRateLimitForUser — boundary (at the limit)', () => {
  it('[unit] allows exactly AI_ASSISTANT_RATE_LIMIT requests, denies the next', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      expect(checkAssistantRateLimitForUser('user-2').allowed).toBe(true);
    }
    expect(checkAssistantRateLimitForUser('user-2').allowed).toBe(false);
  });
});

describe('checkAssistantRateLimitForUser — over-limit', () => {
  it('[unit] a denied turn carries retryAfterSec > 0 (a handled result, not a throw)', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      checkAssistantRateLimitForUser('user-3');
    }
    const denied = checkAssistantRateLimitForUser('user-3');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });
});

describe('checkAssistantRateLimitForUser — isolation (concurrent/ordering)', () => {
  it('[unit] one user being over-limit never blocks a different user', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      checkAssistantRateLimitForUser('user-4');
    }
    expect(checkAssistantRateLimitForUser('user-4').allowed).toBe(false);
    expect(checkAssistantRateLimitForUser('user-5').allowed).toBe(true);
  });

  it('[unit] the per-user bucket is a DIFFERENT key than the per-IP bucket for the same string value', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      checkAssistantRateLimitForUser('203.0.113.9'); // deliberately reuse an IP-shaped string as a userId
    }
    expect(checkAssistantRateLimitForUser('203.0.113.9').allowed).toBe(false);
    // The per-IP guard for the SAME literal string is untouched (additive, not shared).
    expect(checkAssistantRateLimit('203.0.113.9').allowed).toBe(true);
  });
});
