/**
 * scripts/lib/ticket-sync-mapping.mjs — pure, dependency-free mapping functions for
 * scripts/ticket-sync.mjs's `set` command (CAM-279 / T-3).
 *
 * Extracted into its own module (rather than inlined in ticket-sync.mjs) specifically so
 * vitest can unit-test the legacy-state/label -> ADR-010-verb decision table without needing
 * to import the whole CLI (which does top-level env/network work on import). Zero deps, zero
 * side effects — every function here is pure input -> output.
 *
 * ── Why these tables exist ──────────────────────────────────────────────────────────────
 * The AI-team conventions + existing habits (orchestrator prompts, docs, muscle memory) speak
 * in the OLD Linear vocabulary: `--state "In Progress"`, `--add-label awaiting-you`,
 * `--add-label released`, `--add-label blocked`, `--add-label <persona>`. The NEW self-hosted
 * ticket system (ADR-010) has no "state" + "label" pair a client can set independently — it is
 * a guarded state machine with exactly 9 verbs (create/start/raiseGate/approve/reject/complete/
 * release/cancel/reopen) plus 2 orthogonal toggles (setBlocked/archive) and a plain field editor
 * (updateFields). `scripts/ticket-sync.mjs set` accepts the OLD vocabulary and translates it to
 * the closest legal verb call here, so the team's existing habits keep working unmodified
 * while every write actually goes through the guarded machine (never a raw field poke).
 */

/** The 5 legacy Linear state names `set --state <name>` accepts (case-insensitive). */
export const LEGACY_STATES = ["Backlog", "Todo", "In Progress", "Done", "Canceled"];

/**
 * mapLegacyState — decide which /api/tickets/[id] PATCH verb (+params, excluding actor) moves
 * a ticket toward the legacy Linear state name `target`, given its CURRENT ADR-010 shape
 * `{ state, currentRole }` (currentRole may be null/undefined).
 *
 * Returns exactly one of:
 *   { ok: true, noop: true }                      — already in that state; nothing to send.
 *   { ok: true, action, params }                   — call PATCH { action, actor, ...params }.
 *   { ok: false, reason }                           — no verb's precondition could ever match
 *                                                      this current state; do NOT call the API
 *                                                      (there is nothing for it to accept) —
 *                                                      the caller prints `reason` as a local
 *                                                      400-equivalent and exits 1.
 *
 * Decision table (current state -> legacy target -> verb), straight from the ADR-010
 * transition table (docs/adr/ADR-010-self-hosted-delivery-tickets.md):
 *
 *   target "Backlog"     | from CANCELED        -> reopen()            (note required by the API)
 *                         | from BACKLOG         -> noop
 *                         | anything else        -> no verb exists (no "un-start")
 *   target "Todo"        | from BACKLOG          -> start()             (no role — queue/triage only)
 *                         | from TODO            -> noop
 *                         | anything else        -> no verb exists
 *   target "In Progress" | from BACKLOG/TODO     -> start(role?)        (role = ticket's current currentRole, if any — "keeps current")
 *                         | from AWAITING_GATE    -> approve(nextRole?)  (nextRole = current currentRole, if any)
 *                         | from IN_PROGRESS      -> noop
 *                         | anything else        -> no verb exists
 *   target "Done"        | from AWAITING_GATE    -> complete()
 *                         | from DONE            -> noop
 *                         | anything else        -> no verb exists (complete is the only DONE-entry verb)
 *   target "Canceled"    | from DONE             -> no verb exists (DONE is terminal; cancel excludes it)
 *                         | from CANCELED         -> noop
 *                         | anything else        -> cancel()
 */
export function mapLegacyState(target, ticket) {
  const name = String(target ?? "").trim().toLowerCase();
  const state = ticket?.state;
  const role = ticket?.currentRole || undefined;

  switch (name) {
    case "backlog":
      if (state === "BACKLOG") return { ok: true, noop: true };
      if (state === "CANCELED") return { ok: true, action: "reopen" }; // caller must supply --note (API requires it)
      return {
        ok: false,
        reason: `no verb moves a ${state} ticket back to Backlog (only reopen: CANCELED->BACKLOG)`,
      };

    case "todo":
      if (state === "TODO") return { ok: true, noop: true };
      if (state === "BACKLOG") return { ok: true, action: "start", params: {} };
      return { ok: false, reason: `no verb moves a ${state} ticket to Todo (only start(): BACKLOG->TODO)` };

    case "in progress":
      if (state === "IN_PROGRESS") return { ok: true, noop: true };
      if (state === "BACKLOG" || state === "TODO") {
        return { ok: true, action: "start", params: role ? { role } : {} };
      }
      if (state === "AWAITING_GATE") {
        return { ok: true, action: "approve", params: role ? { nextRole: role } : {} };
      }
      return { ok: false, reason: `no verb moves a ${state} ticket to In Progress` };

    case "done":
      if (state === "DONE") return { ok: true, noop: true };
      if (state === "AWAITING_GATE") return { ok: true, action: "complete" };
      return { ok: false, reason: `no verb moves a ${state} ticket to Done (only complete(): AWAITING_GATE->DONE)` };

    case "canceled":
    case "cancelled":
      if (state === "CANCELED") return { ok: true, noop: true };
      if (state === "DONE") return { ok: false, reason: "cannot cancel a DONE ticket (terminal state)" };
      return { ok: true, action: "cancel" };

    default:
      return {
        ok: false,
        reason: `unknown legacy state "${target}". Use one of: ${LEGACY_STATES.join(", ")}`,
      };
  }
}

/** The 4 Persona values `set --add-label <persona>` recognizes (lower-cased). */
export const PERSONA_LABELS = ["host", "camper", "admin", "platform"];

/**
 * mapLegacyLabel — decide the verb for one legacy `--add-label`/`--remove-label` call.
 *
 * Returns exactly one of:
 *   { ok: true, action, params }  — call PATCH { action, actor, ...params }.
 *   { ok: true, warn }            — recognized-but-inert legacy label; no API call, no-op, exit 0.
 *
 * Mapping (direction is `"add"` or `"remove"`):
 *   awaiting-you  add    -> raiseGate               (IN_PROGRESS -> AWAITING_GATE)
 *   awaiting-you  remove -> approve                 (AWAITING_GATE -> IN_PROGRESS; "you approved")
 *   released      add    -> release                 (stamps releasedAt; DONE -> DONE)
 *   released      remove -> warn (releasedAt is a one-way stamp, no verb clears it)
 *   on-staging    add    -> stage                    (CAM-370: stamps stagedAt; DONE -> DONE;
 *                                                      re-stampable — no "already staged" guard;
 *                                                      a silent no-op server-side when the ticket
 *                                                      isn't DONE yet, see lib/delivery/tickets.ts)
 *   on-staging    remove -> warn (stagedAt has no remove-verb, same shape as released)
 *   blocked       add    -> setBlocked(true)
 *   blocked       remove -> setBlocked(false)
 *   <persona>     add    -> updateFields({ persona: PERSONA })
 *   <persona>     remove -> updateFields({ persona: null })
 *   anything else        -> warn "labels are columns now" (no-op, exit 0)
 */
export function mapLegacyLabel(name, direction) {
  const n = String(name ?? "").trim().toLowerCase();

  if (n === "awaiting-you") {
    return direction === "add" ? { ok: true, action: "raiseGate" } : { ok: true, action: "approve" };
  }
  if (n === "released") {
    if (direction === "add") return { ok: true, action: "release" };
    return { ok: true, warn: `label "released" has no remove-verb (releasedAt is a one-way stamp) — no-op` };
  }
  if (n === "on-staging") {
    if (direction === "add") return { ok: true, action: "stage" };
    return { ok: true, warn: `label "on-staging" has no remove-verb (stagedAt is a re-stampable marker, not reversible) — no-op` };
  }
  if (n === "blocked") {
    return { ok: true, action: "setBlocked", params: { blocked: direction === "add" } };
  }
  if (PERSONA_LABELS.includes(n)) {
    return {
      ok: true,
      action: "updateFields",
      params: { persona: direction === "add" ? n.toUpperCase() : null },
    };
  }
  return { ok: true, warn: `label "${name}" — labels are columns now (no-op)` };
}

/** Actions whose zod schema accepts an optional/required `note` field (lib/delivery/validations.ts). */
export const ACTIONS_ACCEPTING_NOTE = new Set(["raiseGate", "reject", "cancel", "reopen", "handoff", "setBlocked"]);
