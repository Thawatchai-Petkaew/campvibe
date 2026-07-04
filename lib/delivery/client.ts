// lib/delivery/client.ts — lazy singleton for the delivery-ticket Prisma client (ADR-010).
//
// STRICT BOUNDARY: this file (and everything else under lib/delivery/) is the ONLY code
// that may import the generated delivery client. It must never import the product's
// @/lib/prisma, @/lib/auth, or any product component (see __tests__/delivery-boundary.test.ts).
//
// Lazy on purpose: `prisma generate --schema prisma/delivery/schema.prisma` (npm run
// delivery:generate) needs NO live database connection — only DELIVERY_DATABASE_URL being
// set requires an actual connection, and that only happens the first time a delivery query
// runs. This keeps CI/typecheck/build green with no DELIVERY_DATABASE_URL configured
// anywhere (see ADR-010 "TICKETS_SOURCE" rollback flag — the env can be entirely absent on
// an environment and nothing breaks until someone flips TICKETS_SOURCE=db there).
import "server-only";
import { PrismaClient } from "@/prisma/delivery/generated/delivery-client";

declare global {
  var deliveryPrismaGlobal: PrismaClient | undefined;
}

function createDeliveryClient(): PrismaClient {
  if (!process.env.DELIVERY_DATABASE_URL) {
    // Thrown only when a delivery query is actually attempted — never at import/generate time.
    throw new Error(
      "DELIVERY_DATABASE_URL is not set on this environment — the delivery-ticket database " +
        "is not configured (see ADR-010 §G2 config step)."
    );
  }
  return new PrismaClient();
}

/**
 * Lazily construct (and cache) the delivery PrismaClient singleton.
 * Cached on `globalThis` in every env (not just dev): this survives Next.js dev
 * hot-reload (avoids leaking a new client + connection per save) AND lets a warm
 * serverless container reuse the same client across invocations — the same
 * reasoning as lib/prisma.ts, just always-on since this client has no dev-only
 * schema-drift clearing to do.
 */
export function getDeliveryClient(): PrismaClient {
  if (!globalThis.deliveryPrismaGlobal) {
    globalThis.deliveryPrismaGlobal = createDeliveryClient();
  }
  return globalThis.deliveryPrismaGlobal;
}

export type { PrismaClient as DeliveryPrismaClient };
