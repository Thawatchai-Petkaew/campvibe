/**
 * CAM-406 — dev server survives client aborts during in-flight requests.
 *
 * Covers the exact-match predicate + the listener's swallow/no-rethrow
 * behavior, decoupled from real global `process` listeners (see
 * lib/observability/abort-guard.ts's `handleUncaughtException` export).
 *
 * Real process-level repro evidence (curl abort, forced-RST raw socket,
 * synthetic exact-shape uncaughtException against a running `next dev`
 * server) is documented in this story's test.md — this file asserts the
 * unit-level contract only, per code.md/qa.md.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isRequestAbortError,
  handleUncaughtException,
  registerAbortGuard,
} from '@/lib/observability/abort-guard';

describe('isRequestAbortError — exact-match predicate (BR-1)', () => {
  it('matches an Error with message "aborted" and code "ECONNRESET"', () => {
    const err = new Error('aborted') as NodeJS.ErrnoException;
    err.code = 'ECONNRESET';
    expect(isRequestAbortError(err)).toBe(true);
  });

  it('does not match when the message differs', () => {
    const err = new Error('something else') as NodeJS.ErrnoException;
    err.code = 'ECONNRESET';
    expect(isRequestAbortError(err)).toBe(false);
  });

  it('does not match when the code differs', () => {
    const err = new Error('aborted') as NodeJS.ErrnoException;
    err.code = 'ETIMEDOUT';
    expect(isRequestAbortError(err)).toBe(false);
  });

  it('does not match an Error with no code at all', () => {
    expect(isRequestAbortError(new Error('aborted'))).toBe(false);
  });

  it('does not match a non-Error value (string, object, undefined)', () => {
    expect(isRequestAbortError('aborted')).toBe(false);
    expect(isRequestAbortError({ message: 'aborted', code: 'ECONNRESET' })).toBe(false);
    expect(isRequestAbortError(undefined)).toBe(false);
  });
});

describe('handleUncaughtException — swallow-and-never-rethrow (AC-1/AC-2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs one structured warn for a matching abort error and does not throw', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = new Error('aborted') as NodeJS.ErrnoException;
    err.code = 'ECONNRESET';

    expect(() => handleUncaughtException(err)).not.toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ level: 'warn', event: 'request_aborted_by_client' });
  });

  it('does NOT rethrow and does NOT warn-log for a non-matching (real bug) error', () => {
    // Non-negotiable regression guard: an earlier draft of this guard
    // rethrew here, which (verified against a real running `next dev`
    // server) synchronously aborts Node's uncaughtException emit and
    // prevents Next.js's OWN already-installed forgiving handler from ever
    // running — turning a previously-survived real bug into a hard crash.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realBug = new Error('a genuinely different bug, unrelated to abort');

    expect(() => handleUncaughtException(realBug)).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('registerAbortGuard — idempotent registration (EC-1)', () => {
  afterEach(() => {
    process.removeListener('uncaughtException', handleUncaughtException);
  });

  it('adds exactly one process listener, and a second call is a no-op', () => {
    const before = process.listenerCount('uncaughtException');
    registerAbortGuard();
    const afterFirst = process.listenerCount('uncaughtException');
    registerAbortGuard();
    const afterSecond = process.listenerCount('uncaughtException');

    expect(afterFirst).toBe(before + 1);
    expect(afterSecond).toBe(afterFirst);
  });
});
