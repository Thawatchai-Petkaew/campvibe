// lib/delivery/tickets.ts — the ONE service module every ticket mutation goes through
// (ADR-010 "single mutation path, no webhook"). Every verb: (1) checks the ADR-010
// transition-table precondition, (2) writes the Ticket row + appends a TicketEvent inside
// one $transaction, (3) bumps DeliveryPulse, (4) fires the matching Telegram notification
// (buildEventMessage — same event keys/copy as the legacy Linear webhook) and, for
// `approve`, the GitHub repository_dispatch that continues the orchestrator.
//
// Notify/dispatch failures are logged structurally and NEVER fail the mutation (same
// no-throw policy as the existing /api/status/* routes — CAM-275).
//
// actor: free-text string (G2-locked — no FK to a User table; see ADR-010 open
// trade-off #3). This delivery-ops surface has no NextAuth session to bind identity to —
// its only authz gate is the shared STATUS_TOKEN (lib/status-auth.ts), the same trust
// model already used by every existing /api/status/* mutation route. `actor` therefore
// comes from the request body (validated by lib/delivery/validations.ts), not a session.
import "server-only";
import {
  PrismaClient,
  Prisma,
  type Ticket,
  type TicketComment,
  type TicketState,
  type TicketType,
  type DeliveryRole,
  type Persona,
} from "@/prisma/delivery/generated/delivery-client";
import { getDeliveryClient } from "@/lib/delivery/client";
import { bumpDeliveryPulse } from "@/lib/delivery/pulse";
import { roleSlug } from "@/lib/delivery/roles";
import { hasPassedVerify } from "@/lib/delivery/verify-stage";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { TICKET_ID_RE, TICKET_LIST_TAKE_CAP, type AgentModelTier } from "@/lib/delivery/validations";
import { buildEventMessage, statusMapUrl, type EventCtx, type EventKind } from "@/lib/notify-messages";
import { sendTelegram } from "@/lib/notify";
import { fireRepositoryDispatch } from "@/lib/github-dispatch";
import { stageRank, ROLE_STAGE } from "@/lib/status-derive";

type Tx = Prisma.TransactionClient;

// ── Input shapes ──────────────────────────────────────────────────────────────────────

export interface CreateTicketInput {
  title: string;
  type: TicketType;
  description?: string;
  epicId?: string;
  persona?: Persona;
  featureName?: string;
  /** 0..4 ordinal, same scale as legacy StatusIssue.priority. Defaults to 0. */
  priority?: number;
  /** Rarely known at creation time; ADR-010 default is null. */
  currentRole?: DeliveryRole;
  legacyUrl?: string;
  legacyLabels?: string[];
}

export interface UpdateTicketFieldsInput {
  title?: string;
  description?: string | null;
  priority?: number;
  persona?: Persona | null;
  featureName?: string | null;
  /** CAM identifier or internal id of the target EPIC; null detaches (CAM-300). */
  epicId?: string | null;
  /** CAM-342: model-tier trial stamp -- omitted leaves the existing value unchanged (BR-3). */
  agentModel?: AgentModelTier;
}

// ── Shared helpers ────────────────────────────────────────────────────────────────────

async function getTicketOr404(db: PrismaClient, identifier: string): Promise<Ticket> {
  const ticket = await db.ticket.findUnique({ where: { identifier } });
  if (!ticket) throw new TicketNotFoundError(identifier);
  return ticket;
}

function assertState(ticket: Ticket, allowed: TicketState[], verb: string): void {
  if (!allowed.includes(ticket.state)) {
    throw new TicketTransitionError(
      "invalid_state",
      `${verb} requires state in [${allowed.join(", ")}], got ${ticket.state}`
    );
  }
}

async function logEvent(
  tx: Tx,
  ticketId: string,
  kind: string,
  fromValue: string | null,
  toValue: string | null,
  actor: string,
  note?: string | null
): Promise<void> {
  await tx.ticketEvent.create({
    data: { ticketId, kind, fromValue, toValue, actor, note: note ?? null },
  });
}

interface RoleChange {
  changed: boolean;
  fromRole: DeliveryRole | null;
  nextRoleHistory: string[];
}

/** Compute the roleHistory push + change flag for a currentRole transition (start/approve/handoff). */
function computeRoleChange(ticket: Ticket, newRole: DeliveryRole): RoleChange {
  const changed = ticket.currentRole !== newRole;
  const history = ticket.roleHistory;
  const last = history[history.length - 1];
  const nextRoleHistory = changed && last !== newRole ? [...history, newRole] : history;
  return { changed, fromRole: ticket.currentRole, nextRoleHistory };
}

// CAM-285: the "More Detail" button always opens OUR board (/status/map), never legacyUrl —
// legacyUrl is a historical archive pointer (imported tickets only) surfaced in the map modal's
// archive link (lib/delivery/status-adapter.ts), not a live notification target. Every ticket,
// imported or newly created, gets the same board deep link here.
function ticketCtx(t: Ticket): EventCtx {
  return { id: t.identifier, title: t.title, url: statusMapUrl() };
}

/** Send a Telegram notification; never throws, never fails the calling mutation. */
async function notifySafe(kind: EventKind, ctx: EventCtx): Promise<void> {
  try {
    const msg = buildEventMessage(kind, ctx);
    if (!msg) return; // toggled off in NOTIFY_EVENTS
    const res = await sendTelegram(msg.text, { buttons: msg.buttons });
    if (!res.ok) {
      console.error(
        JSON.stringify({ event: "delivery_notify_failed", kind, ticketId: ctx.id, reason: res.reason ?? null })
      );
    }
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "delivery_notify_exception",
        kind,
        ticketId: ctx.id,
        reason: e instanceof Error ? e.message : String(e),
      })
    );
  }
}

/**
 * Fire the gate-approved repository_dispatch that continues the orchestrator.
 * event_type is "gate-approved", matching the trigger in
 * .github/workflows/gate-continue.yml (renamed from linear-continue.yml / event
 * linear-gate-approved in chore/retire-linear-sync, one cycle after the CAM-281 T-5b cutover).
 */
async function dispatchApproved(ticket: Ticket): Promise<void> {
  const res = await fireRepositoryDispatch("gate-approved", {
    identifier: ticket.identifier,
    title: ticket.title,
    epic: ticket.epicId ?? "",
  });
  if (!res.dispatched) {
    console.error(
      JSON.stringify({
        event: "delivery_gate_dispatch_failed",
        identifier: ticket.identifier,
        status: res.status ?? null,
      })
    );
  }
}

// ── create ────────────────────────────────────────────────────────────────────────────

export async function createTicket(actor: string, input: CreateTicketInput): Promise<Ticket> {
  const title = input.title.trim();
  if (!title) throw new TicketTransitionError("invalid_input", "title is required");

  const db = getDeliveryClient();
  const ticket = await db.$transaction(async (tx) => {
    // v1 = a single global numeric sequence (Ticket.number has no DB-level autoincrement —
    // see ADR-010 "single-project v1"). Reading max()+1 inside this transaction is a
    // best-effort guard, not a row lock; acceptable for a solo-owner, low-concurrency
    // internal tool — do not add distributed locking for concurrency load that doesn't
    // exist yet (Lean, CLAUDE.md #6).
    const agg = await tx.ticket.aggregate({ _max: { number: true } });
    const number = (agg._max.number ?? 0) + 1;
    const identifier = `CAM-${number}`;

    const created = await tx.ticket.create({
      data: {
        number,
        identifier,
        title,
        description: input.description,
        type: input.type,
        epicId: input.epicId,
        persona: input.persona,
        featureName: input.featureName,
        priority: input.priority ?? 0,
        currentRole: input.currentRole ?? null,
        roleHistory: input.currentRole ? [input.currentRole] : [],
        legacyUrl: input.legacyUrl,
        legacyLabels: input.legacyLabels ?? [],
      },
    });

    await logEvent(tx, created.id, "created", null, "BACKLOG", actor);
    return created;
  });

  await bumpDeliveryPulse();
  await notifySafe("created", ticketCtx(ticket)); // NOTIFY_EVENTS.created = false by default (no spam)
  return ticket;
}

// ── start(role?) — overloaded verb (G2-locked, ADR-010 open trade-off #1) ──────────────

export async function start(
  id: string,
  actor: string,
  role?: DeliveryRole,
  agentModel?: AgentModelTier
): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);

  if (!role) {
    // start() with no role: BACKLOG -> TODO (queue/triage only, no owner yet).
    assertState(ticket, ["BACKLOG"], "start");
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          state: "TODO",
          // trial-2 feedback: latest stamp wins, omitted = unchanged (BR-3); no separate
          // TicketEvent kind is added for this, same as handoff/updateFields (AC-5).
          ...(agentModel ? { agentModel } : {}),
        },
      });
      await logEvent(tx, u.id, "state_change", ticket.state, "TODO", actor);
      return u;
    });
    await bumpDeliveryPulse();
    return updated;
  }

  // start(role): BACKLOG or TODO -> IN_PROGRESS (first entry into active work).
  assertState(ticket, ["BACKLOG", "TODO"], "start");
  const roleChange = computeRoleChange(ticket, role);
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        state: "IN_PROGRESS",
        startedAt: ticket.startedAt ?? new Date(),
        currentRole: role,
        roleHistory: roleChange.nextRoleHistory,
        // trial-2 feedback: latest stamp wins, omitted = unchanged (BR-3); no separate
        // TicketEvent kind is added for this, same as handoff/updateFields (AC-5).
        ...(agentModel ? { agentModel } : {}),
      },
    });
    await logEvent(tx, u.id, "state_change", ticket.state, "IN_PROGRESS", actor);
    if (roleChange.changed) {
      await logEvent(tx, u.id, "handoff", roleChange.fromRole, role, actor);
    }
    return u;
  });

  await bumpDeliveryPulse();
  // "started" fires on every genuine BACKLOG/TODO -> IN_PROGRESS entry — this transition is
  // the only place a ticket newly enters the "started" statusType (mirrors the legacy
  // webhook's `stateChanged && stateType === "started"` signal).
  await notifySafe("started", ticketCtx(updated));
  if (roleChange.changed) {
    await notifySafe("handoff", { ...ticketCtx(updated), role: roleSlug(role) ?? undefined });
  }
  return updated;
}

// ── raiseGate ─────────────────────────────────────────────────────────────────────────

export async function raiseGate(id: string, actor: string, note?: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["IN_PROGRESS"], "raiseGate");
  if (!ticket.currentRole) {
    throw new TicketTransitionError("no_current_role", "raiseGate requires currentRole to be set");
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: { state: "AWAITING_GATE", gateRaisedAt: new Date() },
    });
    await logEvent(tx, u.id, "gate_raised", ticket.state, "AWAITING_GATE", actor, note);
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("gate", ticketCtx(updated));
  return updated;
}

// ── approve(nextRole?) — not the terminal gate; AWAITING_GATE -> IN_PROGRESS ───────────

export async function approve(id: string, actor: string, nextRole?: DeliveryRole): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["AWAITING_GATE"], "approve");

  const roleChange = nextRole ? computeRoleChange(ticket, nextRole) : null;
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        state: "IN_PROGRESS",
        gateRaisedAt: null,
        changesRequested: false,
        ...(nextRole ? { currentRole: nextRole, roleHistory: roleChange!.nextRoleHistory } : {}),
      },
    });
    await logEvent(tx, u.id, "approved", ticket.state, "IN_PROGRESS", actor);
    if (roleChange?.changed) {
      await logEvent(tx, u.id, "handoff", roleChange.fromRole, nextRole!, actor);
    }
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("approved", ticketCtx(updated));
  if (roleChange?.changed) {
    await notifySafe("handoff", { ...ticketCtx(updated), role: roleSlug(nextRole) ?? undefined });
  }
  // Continue the orchestrator — only `approve` does this (there is more work to do);
  // `complete` below is the terminal gate and fires no dispatch.
  await dispatchApproved(updated);
  return updated;
}

// ── complete — the terminal gate (Staging sign-off, ops.md "Done"); AWAITING_GATE -> DONE

export async function complete(id: string, actor: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["AWAITING_GATE"], "complete");

  // Verify-coverage guard: a STORY cannot reach Done unless it passed through a
  // Verify-stage role (QA or Security). Role rotation was previously pure
  // convention — a solo, frontend-only run could complete without QA/Security ever
  // appearing on the board or in Telegram. This makes the Verify stage enforceable.
  // Scoped to STORY: epic containers and chore/docs tasks carry no AC and are not
  // required to pass Verify. Transition-time only: already-Done stories are never
  // re-checked (no retroactive backlog). Recovery for a blocked story: approve the
  // gate to a qa-engineer/security-reviewer (AWAITING_GATE -> IN_PROGRESS, which
  // pushes that role into roleHistory), then re-raise the gate.
  if (ticket.type === "STORY" && !hasPassedVerify(ticket.roleHistory)) {
    throw new TicketTransitionError(
      "no_verify_role",
      `cannot complete ${id}: this story never passed a Verify-stage role — route it through qa-engineer or security-reviewer (approve the gate to that role) before Done`
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: { state: "DONE", gateRaisedAt: null, changesRequested: false, completedAt: new Date() },
    });
    await logEvent(tx, u.id, "approved", ticket.state, "DONE", actor);
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("done", ticketCtx(updated));
  return updated;
}

// ── reject — AWAITING_GATE -> IN_PROGRESS, same role reworks it ────────────────────────

export async function reject(id: string, actor: string, note?: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["AWAITING_GATE"], "reject");

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        state: "IN_PROGRESS",
        gateRaisedAt: null,
        changesRequested: true,
        regressionRound: ticket.regressionRound + 1,
      },
    });
    // ADR-010 / CAM-275c: reject carries no reason field by default (the reject-reason UI
    // was removed) — `note` is accepted only for signature parity with cancel/reopen; the
    // common call site omits it, which stores null here, preserving the ADR's described
    // behavior exactly. Flagged to the architect for confirmation (see handoff notes).
    await logEvent(tx, u.id, "rejected", ticket.state, "IN_PROGRESS", actor, note);
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("rejected", ticketCtx(updated));
  return updated;
}

// ── release — idempotent-guarded; DONE -> DONE, stamps releasedAt only ─────────────────

export async function release(id: string, actor: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  if (ticket.state !== "DONE") {
    throw new TicketTransitionError("invalid_state", `release requires state=DONE, got ${ticket.state}`);
  }
  if (ticket.releasedAt) {
    throw new TicketTransitionError("already_released", "ticket has already been released");
  }

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data: { releasedAt: now } });
    await logEvent(tx, u.id, "released", null, now.toISOString(), actor);
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("released", ticketCtx(updated));
  return updated;
}

// ── stage — re-stampable; DONE -> DONE, stamps stagedAt only (CAM-370) ─────────────────
//
// UNLIKE release() (idempotent-GUARDED — throws "already_released" on a second call),
// stage() is re-stampable: a story can ride more than one batched dev->staging promote
// over its life (ops.md "on-staging ~1-3/day or on owner request"), so every call simply
// overwrites stagedAt with the latest promote time — no "already staged" error.
//
// UNLIKE release() (which THROWS invalid_state on a non-DONE ticket), a non-DONE ticket is
// a silent no-op here (same idempotent-no-op shape as setBlocked above) — the on-staging
// marker only ever applies to a Done ticket, but a batched promote across many tickets
// should never hard-fail the whole run just because one of them isn't Done yet (ops.md
// "batched daily sitting" runs across a mixed-state set). The CLI (scripts/ticket-sync.mjs)
// detects this by comparing the returned ticket's state and prints a distinct warn line —
// see cmdSet/cmdStage there.
export async function stage(id: string, actor: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  if (ticket.state !== "DONE") return ticket; // no-op: on-staging only applies once a story is Done

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data: { stagedAt: now } });
    await logEvent(tx, u.id, "staged", ticket.stagedAt ? ticket.stagedAt.toISOString() : null, now.toISOString(), actor);
    return u;
  });

  await bumpDeliveryPulse();
  await notifySafe("staged", ticketCtx(updated));
  return updated;
}

// ── cancel(note?) — any non-terminal state -> CANCELED ──────────────────────────────────

export async function cancel(id: string, actor: string, note?: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE"], "cancel");

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: { state: "CANCELED", gateRaisedAt: null },
    });
    await logEvent(tx, u.id, "state_change", ticket.state, "CANCELED", actor, note);
    return u;
  });

  await bumpDeliveryPulse();
  return updated;
}

// ── reopen(note!) — CANCELED -> BACKLOG only; note is REQUIRED (G2-locked) ─────────────

export async function reopen(id: string, actor: string, note: string): Promise<Ticket> {
  if (!note || !note.trim()) {
    throw new TicketTransitionError("note_required", "reopen requires a non-empty note");
  }

  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["CANCELED"], "reopen");

  const trimmedNote = note.trim();
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: { state: "BACKLOG", changesRequested: false },
    });
    await logEvent(tx, u.id, "state_change", ticket.state, "BACKLOG", actor, trimmedNote);
    return u;
  });

  await bumpDeliveryPulse();
  return updated;
}

// ── handoff(role, note?) — orthogonal to state (outside the 9 guarded verbs, like
//    blocked/archivedAt): reassigns currentRole while the ticket stays IN_PROGRESS, for a
//    peer-to-peer handoff that doesn't need a human gate (e.g. Frontend -> Backend inside
//    the Build stage). regressionRound bumps on a backward stage move, exactly mirroring
//    the legacy webhook's stageRank(newRole) < stageRank(oldRole) classification. ────────

export async function handoff(
  id: string,
  actor: string,
  role: DeliveryRole,
  note?: string,
  agentModel?: AgentModelTier
): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  assertState(ticket, ["IN_PROGRESS"], "handoff");

  const fromRole = ticket.currentRole;
  const fromSlug = roleSlug(fromRole);
  const toSlug = roleSlug(role) ?? "";
  const isBackward = fromSlug !== null && stageRank(toSlug) < stageRank(fromSlug);
  const roleChange = computeRoleChange(ticket, role);

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        currentRole: role,
        roleHistory: roleChange.nextRoleHistory,
        ...(isBackward ? { regressionRound: ticket.regressionRound + 1 } : {}),
        // CAM-342: latest stamp wins, omitted = unchanged (BR-3); no TicketEvent kind is
        // added for this -- the AC explicitly keeps no per-dispatch model history (AC-5).
        ...(agentModel ? { agentModel } : {}),
      },
    });
    if (roleChange.changed) {
      await logEvent(tx, u.id, "handoff", fromRole, role, actor, note);
    }
    return u;
  });

  await bumpDeliveryPulse();
  if (roleChange.changed) {
    if (isBackward) {
      await notifySafe("regression", {
        ...ticketCtx(updated),
        role: toSlug,
        fromRole: fromSlug ?? undefined,
        round: updated.regressionRound,
      });
    } else if (ROLE_STAGE[toSlug] === "Verify" && ticket.regressionRound > 0) {
      await notifySafe("reverify", { ...ticketCtx(updated), role: toSlug, round: updated.regressionRound });
    } else {
      await notifySafe("handoff", { ...ticketCtx(updated), role: toSlug });
    }
  }
  return updated;
}

// ── blocked toggle — orthogonal flag ────────────────────────────────────────────────────

export async function setBlocked(id: string, actor: string, blocked: boolean, note?: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  if (ticket.blocked === blocked) return ticket; // idempotent no-op

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data: { blocked } });
    await logEvent(tx, u.id, "blocked", String(ticket.blocked), String(blocked), actor, note);
    return u;
  });

  await bumpDeliveryPulse();
  if (blocked) await notifySafe("blocked", ticketCtx(updated));
  return updated;
}

// ── archive / unarchive — orthogonal flag ───────────────────────────────────────────────

export async function archiveTicket(id: string, actor: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  if (ticket.archivedAt) return ticket; // idempotent no-op

  const now = new Date();
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data: { archivedAt: now } });
    await logEvent(tx, u.id, "archived", null, now.toISOString(), actor);
    return u;
  });

  await bumpDeliveryPulse();
  return updated;
}

export async function unarchiveTicket(id: string, actor: string): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  if (!ticket.archivedAt) return ticket; // idempotent no-op

  const priorArchivedAt = ticket.archivedAt.toISOString();
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data: { archivedAt: null } });
    await logEvent(tx, u.id, "archived", priorArchivedAt, null, actor);
    return u;
  });

  await bumpDeliveryPulse();
  return updated;
}

// ── addComment — free-form thread + a "comment" ledger entry (schema kind list) ────────

export async function addComment(id: string, actor: string, body: string): Promise<TicketComment> {
  const trimmed = body.trim();
  if (!trimmed) throw new TicketTransitionError("invalid_input", "comment body is required");

  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);
  const comment = await db.$transaction(async (tx) => {
    const c = await tx.ticketComment.create({
      data: { ticketId: ticket.id, body: trimmed, authorName: actor },
    });
    await logEvent(tx, ticket.id, "comment", null, null, actor, trimmed);
    return c;
  });

  await bumpDeliveryPulse();
  return comment;
}

// ── updateFields — plain edits, no state-machine side effects ──────────────────────────

export async function updateFields(id: string, actor: string, input: UpdateTicketFieldsInput): Promise<Ticket> {
  const db = getDeliveryClient();
  const ticket = await getTicketOr404(db, id);

  const changedKeys = (Object.keys(input) as (keyof UpdateTicketFieldsInput)[]).filter(
    (k) => input[k] !== undefined
  );
  if (changedKeys.length === 0) return ticket;
  if (input.title !== undefined && !input.title.trim()) {
    throw new TicketTransitionError("invalid_input", "title cannot be empty");
  }

  // CAM-300: epicId arrives as a CAM identifier or internal id — resolve to the internal id
  // and enforce the FK invariants (target exists, is an EPIC, is not the ticket itself).
  let resolvedEpicId: string | null | undefined;
  if (input.epicId !== undefined) {
    if (input.epicId === null) {
      resolvedEpicId = null;
    } else {
      const epic = TICKET_ID_RE.test(input.epicId)
        ? await db.ticket.findUnique({ where: { identifier: input.epicId } })
        : await db.ticket.findUnique({ where: { id: input.epicId } });
      if (!epic) throw new TicketNotFoundError(input.epicId);
      if (epic.type !== "EPIC") {
        throw new TicketTransitionError(
          "invalid_input",
          `epicId target ${epic.identifier} is ${epic.type}, not EPIC`
        );
      }
      if (epic.id === ticket.id) {
        throw new TicketTransitionError("invalid_input", "a ticket cannot be its own epic");
      }
      resolvedEpicId = epic.id;
    }
  }
  const data = input.epicId !== undefined ? { ...input, epicId: resolvedEpicId } : input;

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.ticket.update({ where: { id: ticket.id }, data });
    // "updated" is an additive TicketEvent kind beyond ADR-010's enumerated list — the
    // schema's `kind` column is a plain String specifically so a new kind can be added
    // without a migration (see prisma/delivery/schema.prisma comment on TicketEvent.kind).
    await logEvent(tx, u.id, "updated", null, changedKeys.join(","), actor);
    return u;
  });

  await bumpDeliveryPulse();
  return updated;
}

// ── reads (used by the API detail route) ────────────────────────────────────────────────

export async function getTicketByIdentifier(identifier: string): Promise<Ticket | null> {
  const db = getDeliveryClient();
  return db.ticket.findUnique({ where: { identifier } });
}

export async function listComments(ticketId: string): Promise<TicketComment[]> {
  const db = getDeliveryClient();
  return db.ticketComment.findMany({ where: { ticketId }, orderBy: { createdAt: "asc" } });
}

export async function listEvents(ticketId: string) {
  const db = getDeliveryClient();
  return db.ticketEvent.findMany({ where: { ticketId }, orderBy: { createdAt: "asc" } });
}

export interface ListTicketsFilter {
  state?: TicketState;
  epicId?: string;
  archived?: boolean;
  /** CAM-595: a targeted server-side read for a surface that must never truncate silently —
   *  see buildTicketWhere below + lib/delivery/validations.ts's `mode` query-param comment.
   *  Mutually exclusive with state/epicId (enforced at the zod boundary). */
  mode?: "gate" | "audit";
}

/** The where-shape for each read mode (CAM-595). `mode` bypasses state/epicId entirely —
 *  a fully different, purpose-built filter, not a refinement of the general one. */
function buildTicketWhere(filter: ListTicketsFilter): Prisma.TicketWhereInput {
  const archivedAt =
    filter.archived === true ? { not: null } : filter.archived === false ? null : undefined;
  if (filter.mode === "gate") {
    // Everything `gates` must show: awaiting a human decision right now, or sent back for
    // rework. Small by construction (a handful of tickets at a time, not a slice of "all").
    return { archivedAt, OR: [{ state: "AWAITING_GATE" }, { changesRequested: true }] };
  }
  if (filter.mode === "audit") {
    // Everything `audit` must show: every non-Done work item, PLUS every epic (even one
    // that finished long ago) so a story's feature/epic name still resolves for its
    // docs/specs path — buildEpicIndex() in ticket-sync.mjs needs the epic row present
    // regardless of the epic's own state.
    return { archivedAt, OR: [{ type: "EPIC" }, { NOT: { state: "DONE" } }] };
  }
  return {
    ...(filter.state ? { state: filter.state } : {}),
    ...(filter.epicId ? { epicId: filter.epicId } : {}),
    archivedAt,
  };
}

/** Never let a non-essential row-count query break the primary read. The shared delivery
 *  test double (__tests__/helpers/delivery-fake-client.ts) implements only the subset of the
 *  Prisma API the service layer calls as of its last update and has no `count()` — feature-
 *  detect rather than assume, so tests using that double still exercise the real listTickets
 *  logic; a real Prisma client always has count(). A thrown error is logged (structured, no
 *  secrets/PII) and treated the same as "unknown" — the caller falls back to a conservative
 *  length-based heuristic rather than ever claiming `truncated:false` on a guess. */
async function countMatching(
  db: ReturnType<typeof getDeliveryClient>,
  where: Prisma.TicketWhereInput
): Promise<number | null> {
  if (typeof db.ticket.count !== "function") return null;
  try {
    return await db.ticket.count({ where });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "ticket_list_count_failed",
        message: err instanceof Error ? err.message : String(err),
      })
    );
    return null;
  }
}

/** A bounded ticket-list read that also carries the real truncation signal as extra own
 *  properties on the returned array — see TicketListResult. A caller that only
 *  destructures/iterates the array (every existing caller) is completely unaffected. */
export type TicketListResult = Ticket[] & {
  readonly total: number;
  readonly truncated: boolean;
  /** CAM-602: proof the caller can check against the mode it requested — the request's own
   *  `filter.mode` echoed back ("gate"/"audit"), or `null` for a genuine general (no-mode)
   *  read. An older server that predates `mode` entirely never attaches this property at
   *  all — indistinguishable, from the response alone, from a mismatch, which is exactly
   *  why a caller checks for an exact match rather than truthiness. See
   *  scripts/lib/ticket-sync-mode-proof.mjs for the client-side refusal this enables. */
  readonly appliedMode: "gate" | "audit" | null;
};

/**
 * Bounded list read (CAM-595). Still bounded on purpose — performance.md is right that an
 * unbounded read is wrong — but two things changed from the original take-500/ascending read
 * that silently dropped the newest 34+ tickets the moment the project crossed 500 unarchived
 * rows (gates raised on that work reported as "no gates open"):
 *   1. `orderBy: number desc`, and the cap raised to TICKET_LIST_TAKE_CAP — if the cap DOES
 *      bite, it now drops the OLDEST rows (most likely long-settled work), never the newest
 *      in-flight tickets / open gates. This is still a deferral, not a fix for the general
 *      (no-`mode`) read path — see tech.md for when it next bites.
 *   2. the returned array carries `.total` (the real matching-row count, ignoring the cap)
 *      and `.truncated` (`total > length`) as extra own properties. `/api/tickets` projects
 *      them into the JSON response so truncation can never read as completeness (ops.md
 *      "no silent caps").
 * `mode: "gate" | "audit"` sidesteps the cap's danger zone entirely for the two surfaces that
 * must never truncate at all — see buildTicketWhere.
 */
export async function listTickets(filter: ListTicketsFilter = {}): Promise<TicketListResult> {
  const db = getDeliveryClient();
  const where = buildTicketWhere(filter);
  const tickets = await db.ticket.findMany({
    where,
    orderBy: { number: "desc" },
    take: TICKET_LIST_TAKE_CAP,
  });
  const total = await countMatching(db, where);
  const truncated = total !== null ? total > tickets.length : tickets.length >= TICKET_LIST_TAKE_CAP;
  // CAM-602: appliedMode echoes back the mode that actually built `where` above (or `null`
  // for a genuine general read) — the response's proof that a requested mode was honoured,
  // not silently ignored by a server that predates it. See TicketListResult's doc comment.
  return Object.assign(tickets, { total: total ?? tickets.length, truncated, appliedMode: filter.mode ?? null });
}
