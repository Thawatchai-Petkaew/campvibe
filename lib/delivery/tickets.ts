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
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { TICKET_ID_RE, type AgentModelTier } from "@/lib/delivery/validations";
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
}

/** Bounded list read (take 500) — small internal dataset, but never unbounded (perf.md). */
export async function listTickets(filter: ListTicketsFilter = {}): Promise<Ticket[]> {
  const db = getDeliveryClient();
  return db.ticket.findMany({
    where: {
      ...(filter.state ? { state: filter.state } : {}),
      ...(filter.epicId ? { epicId: filter.epicId } : {}),
      archivedAt: filter.archived ? { not: null } : filter.archived === false ? null : undefined,
    },
    orderBy: { number: "asc" },
    take: 500,
  });
}
