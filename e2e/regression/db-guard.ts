/**
 * CAM-359 BR-1 (safety guard — NON-NEGOTIABLE).
 *
 * The e2e-regression suite drives real create/update/delete flows against
 * `DATABASE_URL`. The main tree's `.env` points at the STAGING database —
 * this suite must NEVER run there. Reuses the refuse-on-prod pattern from
 * `scripts/db-reset.mjs` (guard + masked URL) but scopes to "must BE
 * localhost" (allow-list) rather than "must NOT look like prod" (deny-list),
 * because an e2e run must never mutate ANY shared env, not just prod.
 *
 * Aborts (throws) before any seed/login/test runs unless
 * `new URL(DATABASE_URL).hostname` is one of localhost / 127.0.0.1 / ::1.
 * If DATABASE_URL is unset, also aborts (EC-1).
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class NonLocalDatabaseError extends Error {}

function maskConnectionString(url: string): string {
  return url.replace(/:\/\/[^@]*@/, "://***@");
}

/**
 * Throws `NonLocalDatabaseError` with a clear, dev-facing (English) message
 * naming the offending host and the fix, per AC-7. Returns void on success.
 */
export function assertLocalDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new NonLocalDatabaseError(
      [
        "",
        "✗ e2e-regression: DATABASE_URL is not set.",
        "  This suite creates/deletes REAL rows and must run against a LOCAL",
        "  Postgres only — never a shared/staging/production database.",
        "  Fix: point DATABASE_URL at a local Postgres, e.g.",
        '    DATABASE_URL="postgresql://<user>@localhost:5432/campvibe?schema=public"',
        "",
      ].join("\n")
    );
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new NonLocalDatabaseError(
      `\n✗ e2e-regression: DATABASE_URL is not a valid connection URL.\n`
    );
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    const masked = maskConnectionString(databaseUrl);
    throw new NonLocalDatabaseError(
      [
        "",
        `✗ e2e-regression: DATABASE_URL host "${hostname}" is NOT localhost.`,
        `  Offending URL (masked): ${masked}`,
        "  This suite creates/deletes REAL rows and must NEVER run against a",
        "  shared/staging/production database.",
        "  Fix: point DATABASE_URL at a local Postgres, e.g.",
        '    DATABASE_URL="postgresql://<user>@localhost:5432/campvibe?schema=public"',
        "",
      ].join("\n")
    );
  }
}

/**
 * CLI-friendly wrapper — prints the message and exits non-zero instead of
 * throwing. Used at the very top of the Playwright regression setup project
 * (`e2e/regression/global.setup.ts`) so the run aborts before any seed/login/
 * test executes (AC-7 / EC-1).
 */
export function assertLocalDatabaseOrExit(databaseUrl: string | undefined = process.env.DATABASE_URL): void {
  try {
    assertLocalDatabase(databaseUrl);
  } catch (err) {
    if (err instanceof NonLocalDatabaseError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}
