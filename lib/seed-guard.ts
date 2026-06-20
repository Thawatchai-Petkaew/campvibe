import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

/**
 * Environment context for the seed guard.
 * Injected at call-site; defaults to process.env values in production code
 * but can be overridden in unit tests without mutating process.env.
 */
export interface SeedGuardEnv {
  nodeEnv: string | undefined;
  allowDangerousSeed: string | undefined;
}

/**
 * Guard for dangerous seed/scrape endpoints.
 *
 * Rules (evaluated in order):
 * 1. Block in production unless ALLOW_DANGEROUS_SEED=1 is explicitly set —
 *    even for admins, so these can never run by accident in prod.
 * 2. Block when no authenticated session exists.
 * 3. Block when the caller is not a platform ADMIN.
 *
 * Returns a NextResponse with status 403 when the request should be blocked,
 * or null when it is allowed to proceed.
 *
 * @param session  - The NextAuth session (pass null when unauthenticated).
 * @param env      - Environment context; defaults to process.env values.
 *                   Pass an explicit object in unit tests to keep them pure.
 */
export function assertSeedAllowed(
  session: Session | null,
  env: SeedGuardEnv = {
    nodeEnv: process.env.NODE_ENV,
    allowDangerousSeed: process.env.ALLOW_DANGEROUS_SEED,
  }
): NextResponse | null {
  if (env.nodeEnv === 'production' && env.allowDangerousSeed !== '1') {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message:
          'Seed endpoints are disabled in production. ' +
          'Set ALLOW_DANGEROUS_SEED=1 to override.',
      },
      { status: 403 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Authentication required.' },
      { status: 403 }
    );
  }

  if (session.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Platform admin role required.' },
      { status: 403 }
    );
  }

  return null;
}
