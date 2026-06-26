/**
 * CAM-187 MEAS-1b — Route timing helper.
 *
 * A thin wrapper emitting RED duration metrics for catalog read handlers.
 * Emits one structured log line per call: { level, event:'route_timing', label, durationMs, status }.
 *
 * Usage (wrap the Prisma/service call only — auth/zod remain outside):
 *
 *   const campSites = await withTiming('catalog_list', () =>
 *     prisma.campSite.findMany({ ... })
 *   );
 *
 * No PII is logged. label must be a stable constant string (not a user-supplied value).
 */

export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
        const result = await fn();
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        console.log(
            JSON.stringify({
                level: 'info',
                event: 'route_timing',
                label,
                durationMs,
                status: 'ok',
            })
        );
        return result;
    } catch (err) {
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        console.log(
            JSON.stringify({
                level: 'error',
                event: 'route_timing',
                label,
                durationMs,
                status: 'error',
            })
        );
        throw err;
    }
}
