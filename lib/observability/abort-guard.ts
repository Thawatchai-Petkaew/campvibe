/**
 * CAM-406 — narrow uncaughtException guard for client-mid-request aborts.
 *
 * Reported defect (localhost `next dev` only — Vercel is per-request isolated
 * and unaffected): a client disconnecting mid-request (browser tab/panel
 * closed, curl timeout) while an in-flight request is still running (e.g. the
 * ~3-5s `/api/ai/chat` call) can surface, asynchronously and after the
 * response has already been logged, as a raw `Error: aborted` with
 * `code: 'ECONNRESET'` thrown outside any promise chain Next.js/Node
 * controls, ending in `next dev` terminating.
 *
 * IMPORTANT — verified finding (real running-server repro, see test.md):
 * Next.js 16.2.9 already installs its OWN forgiving `uncaughtException`/
 * `unhandledRejection` listener (`next/dist/.../process-error-handlers.js`)
 * that logs and does NOT call `process.exit` — by design, so one bad
 * request never kills the whole dev server. A listener registered here that
 * RETHROWS for the "not our class" branch throws synchronously inside
 * `process.emit('uncaughtException', ...)`, which aborts that emit
 * immediately and PREVENTS Next's own later-registered forgiving listener
 * from ever running — turning a previously-survived real bug into a hard
 * crash. Verified directly: with an earlier rethrow-based draft of this
 * guard, an unrelated synthetic error (unrelated to abort) crashed the
 * server; Next's default (no guard at all) survives the same error.
 *
 * So this guard must NEVER rethrow for the non-matching branch — it only
 * adds a clear, low-noise, structured WARN log for the known client-abort
 * class; every other error is left completely untouched (no return value
 * changes anything for Node — simply not throwing lets Node continue
 * invoking any other registered listener, i.e. Next's own).
 *
 * `isRequestAbortError` is the exact, narrow predicate: it matches ONLY this
 * one error shape (message === 'aborted' AND code === 'ECONNRESET').
 */
export function isRequestAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return err.message === 'aborted' && code === 'ECONNRESET';
}

/**
 * The listener logic itself, decoupled from `process.on` registration so it
 * is directly unit-testable (call it with a mock error + assert on
 * `console.warn`) without touching real global process listeners.
 */
export function handleUncaughtException(err: unknown): void {
  if (isRequestAbortError(err)) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'request_aborted_by_client',
        message: 'client disconnected mid-request; request abandoned, process survived',
      })
    );
  }
  // Not our narrow class (or already handled above): do nothing here.
  // Deliberately no rethrow — see file header.
}

/**
 * Registers the guard exactly once per process. Safe to call multiple
 * times — a second call is a no-op (`registered` guard), covering React
 * Strict Mode / hot-reload re-invocation in dev.
 */
let registered = false;

export function registerAbortGuard(): void {
  if (registered) return;
  registered = true;
  process.on('uncaughtException', handleUncaughtException);
}
