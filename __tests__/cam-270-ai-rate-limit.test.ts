/**
 * CAM-270 BR-8, EC-8 — lib/ai/rate-limit.ts
 *
 * This story fixes the SHARED contract (key shape + limit/window) reused by
 * lib/rate-limit.ts's checkRateLimit; the IP-keyed enforcement POINT (extract
 * the caller's IP, return 429) is wired at the chat endpoint (CAM-271). Here
 * we assert the contract itself: 30 requests / 15 min per IP.
 *
 * Coverage matrix:
 *   - normal: under the limit → allowed
 *   - boundary: exactly at the limit → the next call is denied
 *   - error/validation: over-limit → denied with retryAfterSec > 0 (EC-8)
 *   - concurrent/ordering: two different IPs are rate-limited independently
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkAssistantRateLimit,
  AI_ASSISTANT_RATE_LIMIT,
  AI_ASSISTANT_RATE_WINDOW_MS,
} from '@/lib/ai/rate-limit';
import { _store } from '@/lib/rate-limit';

beforeEach(() => {
  _store.clear();
});

describe('checkAssistantRateLimit — normal', () => {
  it('[unit] allows the first request for a fresh IP', () => {
    const result = checkAssistantRateLimit('1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(AI_ASSISTANT_RATE_LIMIT - 1);
  });

  it('[unit] uses the documented contract numbers (30 / 15 min)', () => {
    expect(AI_ASSISTANT_RATE_LIMIT).toBe(30);
    expect(AI_ASSISTANT_RATE_WINDOW_MS).toBe(15 * 60 * 1000);
  });
});

describe('checkAssistantRateLimit — boundary (at the limit)', () => {
  it('[unit] allows exactly AI_ASSISTANT_RATE_LIMIT requests, denies the next', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      expect(checkAssistantRateLimit('5.6.7.8').allowed).toBe(true);
    }
    const overLimit = checkAssistantRateLimit('5.6.7.8');
    expect(overLimit.allowed).toBe(false);
  });
});

describe('checkAssistantRateLimit — over-limit (EC-8)', () => {
  it('[unit] a denied turn carries retryAfterSec > 0 (a handled result, not a throw)', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      checkAssistantRateLimit('9.9.9.9');
    }
    const denied = checkAssistantRateLimit('9.9.9.9');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
  });
});

describe('checkAssistantRateLimit — per-IP isolation (concurrent/ordering)', () => {
  it('[unit] one IP being over-limit never blocks a different IP', () => {
    for (let i = 0; i < AI_ASSISTANT_RATE_LIMIT; i++) {
      checkAssistantRateLimit('1.1.1.1');
    }
    expect(checkAssistantRateLimit('1.1.1.1').allowed).toBe(false);
    expect(checkAssistantRateLimit('2.2.2.2').allowed).toBe(true);
  });
});
