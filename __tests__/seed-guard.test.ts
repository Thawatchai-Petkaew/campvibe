/**
 * Unit tests for lib/seed-guard.ts
 *
 * assertSeedAllowed accepts an explicit SeedGuardEnv object so every test is
 * a pure function call — no process.env mutation, no Next.js bootstrap needed.
 */

import { describe, it, expect } from 'vitest';
import type { Session } from 'next-auth';
import { assertSeedAllowed } from '../lib/seed-guard';
import type { SeedGuardEnv } from '../lib/seed-guard';

// ---------------------------------------------------------------------------
// Env fixtures
// ---------------------------------------------------------------------------

const DEV_ENV: SeedGuardEnv = { nodeEnv: 'development', allowDangerousSeed: undefined };
const TEST_ENV: SeedGuardEnv = { nodeEnv: 'test', allowDangerousSeed: undefined };
const PROD_ENV_NO_FLAG: SeedGuardEnv = { nodeEnv: 'production', allowDangerousSeed: undefined };
const PROD_ENV_WRONG_FLAG: SeedGuardEnv = { nodeEnv: 'production', allowDangerousSeed: 'true' };
const PROD_ENV_WITH_FLAG: SeedGuardEnv = { nodeEnv: 'production', allowDangerousSeed: '1' };

// ---------------------------------------------------------------------------
// Session fixtures
// ---------------------------------------------------------------------------

function makeAdminSession(): Session {
  return {
    user: { id: 'user-1', role: 'ADMIN', email: 'admin@campvibe.com', name: 'Admin', image: null },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };
}

function makeOperatorSession(): Session {
  return {
    user: { id: 'user-2', role: 'OPERATOR', email: 'op@campvibe.com', name: 'Op', image: null },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };
}

function makeCamperSession(): Session {
  return {
    user: { id: 'user-3', role: 'CAMPER', email: 'camper@campvibe.com', name: 'Camper', image: null },
    expires: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('assertSeedAllowed', () => {
  describe('production guard (evaluated before auth, cannot be bypassed by admins)', () => {
    it('returns 403 in production when ALLOW_DANGEROUS_SEED is not set', () => {
      const result = assertSeedAllowed(makeAdminSession(), PROD_ENV_NO_FLAG);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('returns 403 in production when ALLOW_DANGEROUS_SEED is "true" (not exactly "1")', () => {
      const result = assertSeedAllowed(makeAdminSession(), PROD_ENV_WRONG_FLAG);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('production block fires even for an ADMIN when flag is absent', () => {
      const result = assertSeedAllowed(makeAdminSession(), PROD_ENV_NO_FLAG);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe('authentication guard (non-production)', () => {
    it('returns 403 when session is null (unauthenticated)', () => {
      const result = assertSeedAllowed(null, TEST_ENV);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('returns 403 when session is null in development', () => {
      const result = assertSeedAllowed(null, DEV_ENV);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe('authorization guard (role check, non-production)', () => {
    it('returns 403 when caller role is OPERATOR', () => {
      const result = assertSeedAllowed(makeOperatorSession(), TEST_ENV);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('returns 403 when caller role is CAMPER', () => {
      const result = assertSeedAllowed(makeCamperSession(), TEST_ENV);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe('allowed path', () => {
    it('returns null (allowed) for an ADMIN caller in a test environment', () => {
      const result = assertSeedAllowed(makeAdminSession(), TEST_ENV);

      expect(result).toBeNull();
    });

    it('returns null (allowed) for an ADMIN caller in development', () => {
      const result = assertSeedAllowed(makeAdminSession(), DEV_ENV);

      expect(result).toBeNull();
    });

    it('returns null (allowed) for an ADMIN in production WITH ALLOW_DANGEROUS_SEED=1', () => {
      const result = assertSeedAllowed(makeAdminSession(), PROD_ENV_WITH_FLAG);

      expect(result).toBeNull();
    });
  });

  describe('non-admin is still blocked in production even with ALLOW_DANGEROUS_SEED=1', () => {
    it('blocks OPERATOR in production even with the flag', () => {
      const result = assertSeedAllowed(makeOperatorSession(), PROD_ENV_WITH_FLAG);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    it('blocks unauthenticated caller in production even with the flag', () => {
      const result = assertSeedAllowed(null, PROD_ENV_WITH_FLAG);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });
  });

  describe('response body for blocked requests', () => {
    it('production block response contains error and message fields', async () => {
      const result = assertSeedAllowed(makeAdminSession(), PROD_ENV_NO_FLAG);
      const body = await result!.json();

      expect(body.error).toBe('Forbidden');
      expect(typeof body.message).toBe('string');
      expect(body.message.length).toBeGreaterThan(0);
    });

    it('unauthenticated block response contains error and message fields', async () => {
      const result = assertSeedAllowed(null, TEST_ENV);
      const body = await result!.json();

      expect(body.error).toBe('Forbidden');
      expect(typeof body.message).toBe('string');
      expect(body.message.length).toBeGreaterThan(0);
    });

    it('role block response contains error and message fields', async () => {
      const result = assertSeedAllowed(makeOperatorSession(), TEST_ENV);
      const body = await result!.json();

      expect(body.error).toBe('Forbidden');
      expect(typeof body.message).toBe('string');
      expect(body.message.length).toBeGreaterThan(0);
    });
  });
});
