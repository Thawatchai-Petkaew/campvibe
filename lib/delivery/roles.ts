// lib/delivery/roles.ts — DeliveryRole enum <-> lib/status-derive.ts canonical role-slug
// conversion. Shared by lib/delivery/tickets.ts (event/notify context) and
// lib/delivery/status-adapter.ts (StatusIssue label/title synthesis) so the mapping is
// defined exactly once.
import type { DeliveryRole } from "@/prisma/delivery/generated/delivery-client";

/**
 * DeliveryRole enum member -> canonical status-derive slug, e.g. BACKEND_ENGINEER ->
 * "backend-engineer". Every DeliveryRole value already converts 1:1 onto a slug
 * lib/status-derive.ts's KNOWN_ROLES set recognizes (verified against ADR-010 + the enum
 * list) — no alias table needed here, unlike ROLE_ALIASES in status-derive.ts (that table
 * exists for legacy Linear short-hand slugs like "qa"/"backend", which never occur here).
 */
export function roleSlug(role: DeliveryRole | null | undefined): string | null {
  if (!role) return null;
  return role.toLowerCase().replace(/_/g, "-");
}
