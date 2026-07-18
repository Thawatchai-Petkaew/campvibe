/**
 * CAM-406 — Next.js instrumentation hook (runs once per server start, before
 * any request). Registers the narrow client-abort `uncaughtException` guard
 * (`lib/observability/abort-guard.ts`) so a client disconnecting mid-request
 * no longer crashes the whole `next dev` process. See that file for the full
 * defect writeup and the exact-match filter.
 *
 * `NEXT_RUNTIME === 'nodejs'` guard: the Edge runtime has no `process.on` —
 * this hook also runs once for the Edge instrumentation entry, so skip there.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { registerAbortGuard } = await import('@/lib/observability/abort-guard');
  registerAbortGuard();
}
