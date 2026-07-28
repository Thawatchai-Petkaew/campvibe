/**
 * scripts/lib/ticket-sync-mode-proof.mjs — pure decision logic for CAM-602: does a
 * `GET /api/tickets?mode=<mode>` response actually PROVE the server applied that mode, or
 * must the caller refuse to interpret it as "did apply"?
 *
 * Extracted into its own module (same pattern as scripts/lib/ticket-sync-audit.mjs and
 * scripts/lib/ticket-sync-mapping.mjs) so vitest can unit-test the decision without
 * importing the whole CLI (which does top-level env/network work on import) and without
 * spinning up a real HTTP server.
 *
 * The shape of the bug this guards (CAM-595's own rollout defect, recorded on CAM-602): an
 * older server that predates the `mode` query param entirely simply never reads it off the
 * URL at all, so `listTicketsQuerySchema` never even sees the key — the general, unfiltered
 * ticket list still comes back with HTTP 200. The CLI, having correctly stopped filtering
 * client-side (trusting the server was the whole point of CAM-595), cannot tell "the server
 * honoured mode=gate and found nothing" from "the server ignored mode=gate and handed back
 * everything" UNLESS the response itself carries proof. `appliedMode`
 * (lib/delivery/tickets.ts's listTickets + app/api/tickets/route.ts) is that proof: it
 * echoes the mode the server actually used to build its Prisma `where` clause, or `null` for
 * a genuine general (no-mode) read. An older server's response simply has no such field at
 * all (`undefined`) — indistinguishable, from the client's point of view, from a buggy NEW
 * server that silently fell back to the general read; either way, the client must refuse to
 * interpret rather than guess. A wrong count is worse than no count, because a wrong count
 * gets acted on.
 */

/**
 * checkModeApplied — pure decision: does `data` (the parsed JSON body of a
 * `GET /api/tickets?mode=<mode>` response) prove the server actually applied `mode`?
 *
 * @param {unknown} data - parsed response body (or null/undefined on an empty/missing body)
 * @param {"gate"|"audit"} mode - the mode this call requested
 * @returns {{ ok: boolean, appliedMode: unknown }}
 *   ok=true  -> data.appliedMode === mode; the caller may trust data.tickets as that set.
 *   ok=false -> the proof is missing, `null`, or names a different mode; the caller MUST
 *               refuse to report a count and instead say plainly that it cannot tell.
 */
export function checkModeApplied(data, mode) {
  const appliedMode = data && typeof data === "object" ? data.appliedMode : undefined;
  return { ok: appliedMode === mode, appliedMode };
}
