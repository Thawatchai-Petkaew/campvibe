/**
 * cam-422-cron-auth.test.ts — CAM-422 (ADR-013 S8) `lib/cron-auth.ts`
 * `isCronRequestAuthorized` — the shared-secret guard for `app/api/cron/*`.
 *
 * Test matrix: unset secret (default-deny) · missing header · wrong scheme ·
 * wrong secret · mismatched length (constant-time path) · correct secret.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

// lib/cron-auth.ts declares `import "server-only"` (a Next.js-only shim not
// resolvable under vitest's node environment) — stub it, matching every
// other test file in this repo that imports a server-only module
// (e.g. cam-275-status-approve-chain.test.ts).
vi.mock('server-only', () => ({}));

import { isCronRequestAuthorized } from '@/lib/cron-auth';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

function reqWithAuth(header?: string): Request {
  const headers = new Headers();
  if (header !== undefined) headers.set('authorization', header);
  return new Request('https://example.test/api/cron/ai-chat-retention', { headers });
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  }
});

describe('isCronRequestAuthorized', () => {
  it('returns false when CRON_SECRET is unset (default-deny, never falls open)', () => {
    delete process.env.CRON_SECRET;
    expect(isCronRequestAuthorized(reqWithAuth('Bearer anything'))).toBe(false);
  });

  it('returns false when the Authorization header is missing', () => {
    process.env.CRON_SECRET = 'topsecret123';
    expect(isCronRequestAuthorized(reqWithAuth())).toBe(false);
  });

  it('returns false for the wrong secret (same length)', () => {
    process.env.CRON_SECRET = 'topsecret123';
    expect(isCronRequestAuthorized(reqWithAuth('Bearer wrongsecret1'))).toBe(false);
  });

  it('returns false for a secret of a different length (constant-time path)', () => {
    process.env.CRON_SECRET = 'topsecret123';
    expect(isCronRequestAuthorized(reqWithAuth('Bearer short'))).toBe(false);
  });

  it('returns false when the scheme is missing ("Bearer " prefix absent)', () => {
    process.env.CRON_SECRET = 'topsecret123';
    expect(isCronRequestAuthorized(reqWithAuth('topsecret123'))).toBe(false);
  });

  it('returns true for the exact expected header', () => {
    process.env.CRON_SECRET = 'topsecret123';
    expect(isCronRequestAuthorized(reqWithAuth('Bearer topsecret123'))).toBe(true);
  });
});
