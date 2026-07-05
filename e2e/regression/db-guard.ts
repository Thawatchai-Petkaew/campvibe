/**
 * CAM-359 BR-1 (safety guard — NON-NEGOTIABLE).
 *
 * The e2e-regression suite drives real create/update/delete flows against
 * `DATABASE_URL`. The main tree's `.env` points at the STAGING database —
 * this suite must NEVER run there. Reuses the refuse-on-prod pattern from
 * `scripts/db-reset.mjs` (a guard that aborts loudly) but scopes to "must BE
 * localhost" (allow-list) rather than "must NOT look like prod" (deny-list),
 * because an e2e run must never mutate ANY shared env, not just prod. Unlike
 * `db-reset.mjs`'s "mask everything before `@`" approach, the abort message
 * here never echoes the connection string at all (see `describeUrlShape`) —
 * a query-string secret (`?api_key=...`) would otherwise leak straight past
 * a userinfo-only mask, into both the console and the Playwright report.
 *
 * Aborts (throws) before any seed/login/test runs unless
 * `new URL(DATABASE_URL).hostname` is one of localhost / 127.0.0.1 / ::1.
 * If DATABASE_URL is unset, also aborts (EC-1).
 */

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class NonLocalDatabaseError extends Error {}

/**
 * `new URL(...).hostname` returns an IPv6 host WITH its surrounding brackets
 * (e.g. `[::1]`), but the allow-list above stores the bare form (`::1`) per
 * the spec's allow list — strip them before comparing/displaying.
 */
function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * The abort message must NEVER echo the full connection string — a query
 * string can carry a secret (`?api_key=...`, `?password=...`) that a naive
 * "mask everything before @" transform does not touch. Print the hostname
 * (already the whole point of the message) plus a short scheme hint at
 * most — never the path/query/credentials.
 */
function describeUrlShape(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    const scheme = parsed.protocol.replace(/:$/, "");
    return `${scheme}://${stripBrackets(parsed.hostname)}`;
  } catch {
    return "(unparseable)";
  }
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
    hostname = stripBrackets(new URL(databaseUrl).hostname);
  } catch {
    throw new NonLocalDatabaseError(
      `\n✗ e2e-regression: DATABASE_URL is not a valid connection URL.\n`
    );
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new NonLocalDatabaseError(
      [
        "",
        `✗ e2e-regression: DATABASE_URL host "${hostname}" is NOT localhost.`,
        // Hostname only (+ scheme) — never the credentials/path/query, which
        // can carry a secret (?api_key=..., ?password=...) a naive "mask
        // before @" transform would leak straight into this console message
        // and the Playwright report artifact.
        `  Offending host: ${describeUrlShape(databaseUrl)}`,
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
