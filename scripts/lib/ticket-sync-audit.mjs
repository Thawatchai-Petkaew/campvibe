/**
 * scripts/lib/ticket-sync-audit.mjs — pure, dependency-free audit-content checks for
 * `ticket-sync.mjs audit` (template-upgrades PR, 2026-07-04).
 *
 * Extracted into its own module (same pattern as scripts/lib/ticket-sync-mapping.mjs) so
 * vitest can unit-test the marker check without importing the whole CLI (which does
 * top-level env/network work on import) and without mutating any live ticket data.
 */

/** The spec-kit marker a story/task spec carries inline for an unresolved ambiguity —
 * `.claude/templates/story.md`'s header comment: `[NEEDS CLARIFICATION: <question>]`.
 * A spec is not build-ready while any instance remains. */
export const NEEDS_CLARIFICATION_MARKER = "[NEEDS CLARIFICATION";

/**
 * hasUnresolvedMarker — true when `text` (a story.md file's content, or the ticket
 * description fallback) still carries at least one unresolved `[NEEDS CLARIFICATION` marker.
 * A non-DONE STORY/TASK whose spec matches fails `audit`'s template-conformance check
 * (exit 11) — the same way a missing `## Story`/`## AC` heading does.
 */
export function hasUnresolvedMarker(text) {
  return typeof text === "string" && text.includes(NEEDS_CLARIFICATION_MARKER);
}

/**
 * hasStagedAtIntegrityGap — CAM-370. True when a ticket carries a `stagedAt` timestamp
 * (the durable "rode a batched dev->staging promote" marker) while its `state` is anything
 * other than DONE. The `stage` verb (lib/delivery/tickets.ts) only ever writes `stagedAt`
 * while the ticket IS DONE, so this combination can only arise from data drift outside the
 * API's own verbs (e.g. a direct DB edit, or a future legacy import) — the same "defensive,
 * not reachable via the API's own verbs" reasoning as the roleHistory integrity check in
 * `ticket-sync.mjs audit`. Accepts the minimal shape so callers don't need the full Ticket
 * type (kept a pure function, same pattern as hasUnresolvedMarker above).
 */
export function hasStagedAtIntegrityGap(ticket) {
  return Boolean(ticket && ticket.stagedAt && ticket.state !== "DONE");
}
