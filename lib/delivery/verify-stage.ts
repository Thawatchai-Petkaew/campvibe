// lib/delivery/verify-stage.ts — the Verify-coverage predicate for the delivery
// workflow. Kept in its own dependency-light module (imports only the runtime-safe
// roleSlug + ROLE_STAGE, never the generated Prisma client) so complete()'s guard
// logic is unit-testable without a delivery DB. Reuses ROLE_STAGE as the single
// source of truth for which roles are Verify-stage (qa-engineer, security-reviewer).
import { roleSlug } from "@/lib/delivery/roles";
import { ROLE_STAGE } from "@/lib/status-derive";
import type { DeliveryRole } from "@/prisma/delivery/generated/delivery-client";

/**
 * True if any role in the ticket's roleHistory is a Verify-stage role (QA or
 * Security). A story cannot reach Done unless this holds — role rotation through
 * Verify is enforced, not left to convention. `roleHistory` is stored as `String[]`
 * (raw DeliveryRole enum values); each is mapped to its slug then to its stage.
 */
export function hasPassedVerify(roleHistory: readonly string[]): boolean {
  return roleHistory.some((role) => ROLE_STAGE[roleSlug(role as DeliveryRole) ?? ""] === "Verify");
}
