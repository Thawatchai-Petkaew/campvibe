import { PrismaClient } from '@prisma/client';

/**
 * CAM-187 MEAS-1b — Prisma singleton with optional query timing log.
 *
 * PRISMA_QUERY_LOG=1 enables per-query duration logging (structured JSON).
 * Off by default; set only in .env.local (dev) or Vercel staging env during
 * the MEAS-1 capture window.
 *
 * NEVER enable in production.
 * NEVER log e.params — contains query parameter values that may include PII/Financial data.
 */

const prismaClientSingleton = () => {
    const client = new PrismaClient({
        log:
            process.env.PRISMA_QUERY_LOG === '1'
                ? [{ emit: 'event', level: 'query' }]
                : [],
    });

    if (process.env.PRISMA_QUERY_LOG === '1') {
        // $on is available when emit:'event' is configured above.
        // PrismaClient typings for $on with event-emit mode require a cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as unknown as any).$on('query', (e: { duration: number; query: string }) => {
            // Extract model name from query string — safe regex, never logs e.params
            const model = e.query.match(/FROM "(\w+)"/i)?.[1] ?? 'unknown';
            console.log(
                JSON.stringify({
                    level: 'debug',
                    event: 'prisma_query',
                    durationMs: e.duration,
                    model,
                })
            );
        });
    }

    return client;
};

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

// In development, clear the global instance to force reload after schema changes
if (process.env.NODE_ENV !== 'production') {
    const prismaAny = globalThis.prismaGlobal as Record<string, unknown> | undefined;
    const hasCampSiteModel = !!prismaAny?.campSite;
    const hasTeamMemberModel = !!prismaAny?.campSiteTeamMember;

    // Clear old instance if it doesn't have newer models after schema changes
    if (!globalThis.prismaGlobal || !hasCampSiteModel || !hasTeamMemberModel) {
        globalThis.prismaGlobal = undefined;
    }
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
