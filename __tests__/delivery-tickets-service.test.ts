/**
 * CAM-278 (T-2) — lib/delivery/tickets.ts contract tests.
 *
 * Covers the full ADR-010 state-machine transition matrix (every verb x every from-state),
 * the reopen-requires-note rule, CAM-<n> numbering, role/handoff bookkeeping, the
 * regression/reverify/handoff Telegram classification, and event emission per verb.
 *
 * Mocking strategy (mirrors __tests__/status-approve-endpoints.test.ts):
 *   - server-only            -> empty stub (Next.js server-only guard).
 *   - @/lib/delivery/client  -> getDeliveryClient() returns a fresh in-memory fake per test
 *                               (__tests__/helpers/delivery-fake-client.ts).
 *   - @/lib/notify           -> sendTelegram stub (asserted on for notify behavior).
 *   - @/lib/github-dispatch  -> fireRepositoryDispatch stub (asserted on for the approve verb).
 *   - @/lib/notify-messages, @/lib/status-derive: REAL modules — exercises the actual
 *     message copy + stageRank classification, not a re-description of it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/client", () => ({ getDeliveryClient: vi.fn() }));
vi.mock("@/lib/notify", () => ({ sendTelegram: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/github-dispatch", () => ({
  fireRepositoryDispatch: vi.fn(async () => ({ dispatched: true, status: 200 })),
}));

import * as tickets from "@/lib/delivery/tickets";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";
import { getDeliveryClient } from "@/lib/delivery/client";
import { sendTelegram } from "@/lib/notify";
import { fireRepositoryDispatch } from "@/lib/github-dispatch";
import { createFakeDeliveryClient, makeTicketRow, type FakeTicketRow } from "./helpers/delivery-fake-client";

const getClient = vi.mocked(getDeliveryClient);
const tg = vi.mocked(sendTelegram);
const dispatch = vi.mocked(fireRepositoryDispatch);

let fake: ReturnType<typeof createFakeDeliveryClient>;
let counter = 0;

/** Seed a ticket row directly into the fake store, bypassing service logic. */
function seed(overrides: Partial<FakeTicketRow> = {}): FakeTicketRow {
  counter += 1;
  const row = makeTicketRow({
    number: counter,
    identifier: `CAM-${counter}`,
    title: `Test ticket ${counter}`,
    type: "STORY",
    ...overrides,
  });
  fake.store.tickets.set(row.id, row);
  return row;
}

beforeEach(() => {
  fake = createFakeDeliveryClient();
  getClient.mockReturnValue(fake.client);
  vi.clearAllMocks();
  getClient.mockReturnValue(fake.client); // re-set after clearAllMocks wipes prior mockReturnValue
});

const ALL_STATES = ["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE", "DONE", "CANCELED"] as const;

// ── create ───────────────────────────────────────────────────────────────────────────────

describe("createTicket", () => {
  it("[unit] assigns CAM-<max+1> identifiers sequentially", async () => {
    const t1 = await tickets.createTicket("architect", { title: "First", type: "EPIC" });
    expect(t1.identifier).toBe("CAM-1");
    expect(t1.number).toBe(1);
    const t2 = await tickets.createTicket("architect", { title: "Second", type: "STORY" });
    expect(t2.identifier).toBe("CAM-2");
  });

  it("[unit] applies ADR-010 defaults: BACKLOG, empty roleHistory, null currentRole, priority 0", async () => {
    const t = await tickets.createTicket("architect", { title: "X", type: "STORY" });
    expect(t.state).toBe("BACKLOG");
    expect(t.roleHistory).toEqual([]);
    expect(t.currentRole).toBeNull();
    expect(t.priority).toBe(0);
  });

  it("[unit] seeds roleHistory with currentRole when known at creation", async () => {
    const t = await tickets.createTicket("architect", { title: "X", type: "STORY", currentRole: "ARCHITECT" });
    expect(t.currentRole).toBe("ARCHITECT");
    expect(t.roleHistory).toEqual(["ARCHITECT"]);
  });

  it("[event] logs a 'created' TicketEvent (fromValue null, toValue BACKLOG)", async () => {
    const t = await tickets.createTicket("architect", { title: "X", type: "STORY" });
    const ev = fake.store.events.find((e) => e.ticketId === t.id);
    expect(ev).toMatchObject({ kind: "created", fromValue: null, toValue: "BACKLOG", actor: "architect" });
  });

  it("[notify] does not send a Telegram message (NOTIFY_EVENTS.created = false by default)", async () => {
    await tickets.createTicket("architect", { title: "X", type: "STORY" });
    expect(tg).not.toHaveBeenCalled();
  });

  it("[error] rejects an empty/whitespace-only title", async () => {
    await expect(tickets.createTicket("architect", { title: "   ", type: "STORY" })).rejects.toThrow(
      TicketTransitionError
    );
  });
});

// ── full transition matrix (ADR-010) ────────────────────────────────────────────────────

describe("transition matrix — start()/start(role)", () => {
  it.each(ALL_STATES)("start() [no role]: %s", async (state) => {
    const row = seed({ state });
    if (state === "BACKLOG") {
      const t = await tickets.start(row.identifier, "human");
      expect(t.state).toBe("TODO");
    } else {
      await expect(tickets.start(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
    }
  });

  it.each(ALL_STATES)("start(role): %s", async (state) => {
    const row = seed({ state });
    if (state === "BACKLOG" || state === "TODO") {
      const t = await tickets.start(row.identifier, "human", "BACKEND_ENGINEER");
      expect(t.state).toBe("IN_PROGRESS");
      expect(t.currentRole).toBe("BACKEND_ENGINEER");
      expect(t.startedAt).not.toBeNull();
    } else {
      await expect(tickets.start(row.identifier, "human", "BACKEND_ENGINEER")).rejects.toMatchObject({
        code: "invalid_state",
      });
    }
  });

  it("[unit] startedAt is set once and never overwritten by a later start", async () => {
    const first = new Date("2026-01-01T00:00:00.000Z");
    const row = seed({ state: "TODO", startedAt: first });
    const t = await tickets.start(row.identifier, "human", "BACKEND_ENGINEER");
    expect(t.startedAt).toEqual(first);
  });

  it("start() on an unknown identifier throws TicketNotFoundError", async () => {
    await expect(tickets.start("CAM-9999", "human")).rejects.toThrow(TicketNotFoundError);
  });

  // trial-2 feedback (CAM-342 follow-up) — the `start` verb also stamps agentModel now
  describe("agentModel stamp via start() (trial-2 feedback)", () => {
    it("[unit] start(role, agentModel) stamps agentModel when provided", async () => {
      const row = seed({ state: "BACKLOG", agentModel: null });
      const t = await tickets.start(row.identifier, "human", "BACKEND_ENGINEER", "sonnet");
      expect(t.state).toBe("IN_PROGRESS");
      expect(t.agentModel).toBe("sonnet");
    });

    it("[unit/EC-4] start(role) without agentModel leaves the existing value unchanged", async () => {
      const row = seed({ state: "BACKLOG", agentModel: null });
      const t = await tickets.start(row.identifier, "human", "BACKEND_ENGINEER");
      expect(t.agentModel).toBeNull();
    });

    it("[unit] latest stamp wins — overwrites a prior tier (sonnet -> opus)", async () => {
      const row = seed({ state: "TODO", agentModel: "sonnet" });
      const t = await tickets.start(row.identifier, "human", "BACKEND_ENGINEER", "opus");
      expect(t.agentModel).toBe("opus");
    });

    it("[unit] start() with no role also stamps agentModel when provided", async () => {
      const row = seed({ state: "BACKLOG", agentModel: null });
      const t = await tickets.start(row.identifier, "human", undefined, "opus");
      expect(t.state).toBe("TODO");
      expect(t.agentModel).toBe("opus");
    });

    it("[unit] no per-dispatch history is kept — no extra TicketEvent kind for the model stamp", async () => {
      const row = seed({ state: "BACKLOG", agentModel: null });
      await tickets.start(row.identifier, "human", "BACKEND_ENGINEER", "sonnet");
      const events = fake.store.events.filter((e) => e.ticketId === row.id);
      expect(events.every((e) => e.kind === "state_change" || e.kind === "handoff")).toBe(true);
    });
  });
});

describe("transition matrix — raiseGate", () => {
  it.each(ALL_STATES)("raiseGate: %s", async (state) => {
    const row = seed({ state, currentRole: "BACKEND_ENGINEER" });
    if (state === "IN_PROGRESS") {
      const t = await tickets.raiseGate(row.identifier, "backend-engineer");
      expect(t.state).toBe("AWAITING_GATE");
      expect(t.gateRaisedAt).not.toBeNull();
    } else {
      await expect(tickets.raiseGate(row.identifier, "backend-engineer")).rejects.toMatchObject({
        code: "invalid_state",
      });
    }
  });

  it("[error] IN_PROGRESS with no currentRole -> no_current_role", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: null });
    await expect(tickets.raiseGate(row.identifier, "human")).rejects.toMatchObject({ code: "no_current_role" });
  });

  it("[notify] sends the 'gate' Telegram message", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "BACKEND_ENGINEER" });
    await tickets.raiseGate(row.identifier, "backend-engineer");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Waiting for your approval");
  });
});

describe("transition matrix — approve(nextRole?)", () => {
  it.each(ALL_STATES)("approve: %s", async (state) => {
    const row = seed({ state, currentRole: "ARCHITECT" });
    if (state === "AWAITING_GATE") {
      const t = await tickets.approve(row.identifier, "human");
      expect(t.state).toBe("IN_PROGRESS");
      expect(t.gateRaisedAt).toBeNull();
      expect(t.changesRequested).toBe(false);
    } else {
      await expect(tickets.approve(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
    }
  });

  it("[unit] with nextRole: reassigns currentRole + pushes roleHistory + logs handoff", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "ARCHITECT" });
    const t = await tickets.approve(row.identifier, "human", "UX_DESIGNER");
    expect(t.currentRole).toBe("UX_DESIGNER");
    expect(t.roleHistory).toEqual(["UX_DESIGNER"]);
    const ev = fake.store.events.find((e) => e.kind === "handoff" && e.ticketId === row.id);
    expect(ev).toMatchObject({ fromValue: "ARCHITECT", toValue: "UX_DESIGNER" });
  });

  it("[unit] without nextRole: currentRole unchanged, no handoff event", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "ARCHITECT" });
    const t = await tickets.approve(row.identifier, "human");
    expect(t.currentRole).toBe("ARCHITECT");
    expect(fake.store.events.filter((e) => e.kind === "handoff" && e.ticketId === row.id)).toHaveLength(0);
  });

  it("[notify] approve + handoff both fire when nextRole differs", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "ARCHITECT" });
    await tickets.approve(row.identifier, "human", "UX_DESIGNER");
    expect(tg).toHaveBeenCalledTimes(2);
  });

  it("[dispatch] fires the gate-approved repository_dispatch", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "ARCHITECT" });
    await tickets.approve(row.identifier, "human");
    expect(dispatch).toHaveBeenCalledWith(
      "gate-approved",
      expect.objectContaining({ identifier: row.identifier })
    );
  });

  it("[resilience] a failed dispatch still returns the updated ticket (no-throw policy)", async () => {
    dispatch.mockResolvedValueOnce({ dispatched: false, status: 500 });
    const row = seed({ state: "AWAITING_GATE", currentRole: "ARCHITECT" });
    const t = await tickets.approve(row.identifier, "human");
    expect(t.state).toBe("IN_PROGRESS");
  });
});

describe("transition matrix — reject", () => {
  it.each(ALL_STATES)("reject: %s", async (state) => {
    const row = seed({ state, currentRole: "BACKEND_ENGINEER", regressionRound: 0 });
    if (state === "AWAITING_GATE") {
      const t = await tickets.reject(row.identifier, "human");
      expect(t.state).toBe("IN_PROGRESS");
      expect(t.changesRequested).toBe(true);
      expect(t.regressionRound).toBe(1);
      expect(t.currentRole).toBe("BACKEND_ENGINEER"); // unchanged — same role reworks it
    } else {
      await expect(tickets.reject(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
    }
  });

  it("[unit] omitting note stores null (ADR-010/CAM-275c default — no reason field)", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "BACKEND_ENGINEER" });
    await tickets.reject(row.identifier, "human");
    const ev = fake.store.events.find((e) => e.kind === "rejected" && e.ticketId === row.id);
    expect(ev?.note ?? null).toBeNull();
  });

  it("[notify] sends the 'rejected' Telegram message", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "BACKEND_ENGINEER" });
    await tickets.reject(row.identifier, "human");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Sent back for changes");
  });
});

describe("transition matrix — complete", () => {
  it.each(ALL_STATES)("complete: %s", async (state) => {
    const row = seed({ state, currentRole: "DEVOPS_RELEASE" });
    if (state === "AWAITING_GATE") {
      const t = await tickets.complete(row.identifier, "human");
      expect(t.state).toBe("DONE");
      expect(t.completedAt).not.toBeNull();
      expect(t.currentRole).toBe("DEVOPS_RELEASE"); // unchanged
    } else {
      await expect(tickets.complete(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
    }
  });

  it("[notify] sends 'done', does NOT fire a repository_dispatch (terminal gate)", async () => {
    const row = seed({ state: "AWAITING_GATE", currentRole: "DEVOPS_RELEASE" });
    await tickets.complete(row.identifier, "human");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Completed");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("release — idempotent-guarded, DONE -> DONE (stamps releasedAt only)", () => {
  it("DONE without releasedAt passes", async () => {
    const row = seed({ state: "DONE", releasedAt: null });
    const t = await tickets.release(row.identifier, "human");
    expect(t.releasedAt).not.toBeNull();
    expect(t.state).toBe("DONE");
  });

  it("[error] already_released when releasedAt is already set", async () => {
    const row = seed({ state: "DONE", releasedAt: new Date() });
    await expect(tickets.release(row.identifier, "human")).rejects.toMatchObject({ code: "already_released" });
  });

  it.each(ALL_STATES.filter((s) => s !== "DONE"))("[error] invalid_state for %s", async (state) => {
    const row = seed({ state });
    await expect(tickets.release(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("[notify] sends the 'released' Telegram message with an ISO toValue on the event", async () => {
    const row = seed({ state: "DONE", releasedAt: null });
    await tickets.release(row.identifier, "human");
    const ev = fake.store.events.find((e) => e.kind === "released" && e.ticketId === row.id);
    expect(ev?.toValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Now live");
  });
});

describe("stage — CAM-370: re-stampable, DONE -> DONE (stamps stagedAt only)", () => {
  it("DONE without stagedAt stamps stagedAt, state unchanged", async () => {
    const row = seed({ state: "DONE", stagedAt: null });
    const t = await tickets.stage(row.identifier, "human");
    expect(t.stagedAt).not.toBeNull();
    expect(t.state).toBe("DONE");
  });

  it("[idempotent] DONE with stagedAt already set re-stamps (no error, unlike release)", async () => {
    const first = new Date("2026-01-01T00:00:00Z");
    const row = seed({ state: "DONE", stagedAt: first });
    const t = await tickets.stage(row.identifier, "human");
    expect(t.stagedAt).not.toBeNull();
    expect(t.stagedAt!.getTime()).toBeGreaterThan(first.getTime());
  });

  it.each(ALL_STATES.filter((s) => s !== "DONE"))("[no-op] %s ticket returns unchanged, does not throw", async (state) => {
    const row = seed({ state, stagedAt: null });
    const t = await tickets.stage(row.identifier, "human");
    expect(t.stagedAt).toBeNull();
    expect(t.state).toBe(state);
  });

  it("[no-op] does not emit a TicketEvent or Telegram notification for a non-DONE ticket", async () => {
    const row = seed({ state: "IN_PROGRESS", stagedAt: null });
    await tickets.stage(row.identifier, "human");
    expect(fake.store.events.find((e) => e.kind === "staged" && e.ticketId === row.id)).toBeUndefined();
    expect(tg).not.toHaveBeenCalled();
  });

  it("[notify] sends the 'staged' Telegram message with an ISO toValue on the event", async () => {
    const row = seed({ state: "DONE", stagedAt: null });
    await tickets.stage(row.identifier, "human");
    const ev = fake.store.events.find((e) => e.kind === "staged" && e.ticketId === row.id);
    expect(ev?.toValue).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Now on staging");
  });
});

describe("transition matrix — cancel(note?)", () => {
  const cancellable = ["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE"];
  it.each(ALL_STATES)("cancel: %s", async (state) => {
    const row = seed({ state });
    if (cancellable.includes(state)) {
      const t = await tickets.cancel(row.identifier, "human", "no longer needed");
      expect(t.state).toBe("CANCELED");
    } else {
      await expect(tickets.cancel(row.identifier, "human")).rejects.toMatchObject({ code: "invalid_state" });
    }
  });

  it("[notify] cancel does not send any Telegram message", async () => {
    const row = seed({ state: "BACKLOG" });
    await tickets.cancel(row.identifier, "human");
    expect(tg).not.toHaveBeenCalled();
  });

  it("cancel note is optional and stored on the event when provided", async () => {
    const row = seed({ state: "BACKLOG" });
    await tickets.cancel(row.identifier, "human", "duplicate of CAM-1");
    const ev = fake.store.events.find((e) => e.kind === "state_change" && e.toValue === "CANCELED");
    expect(ev?.note).toBe("duplicate of CAM-1");
  });
});

describe("transition matrix — reopen(note!) — note is REQUIRED (G2-locked)", () => {
  it.each(ALL_STATES)("reopen: %s", async (state) => {
    const row = seed({ state });
    if (state === "CANCELED") {
      const t = await tickets.reopen(row.identifier, "human", "regression found after release");
      expect(t.state).toBe("BACKLOG");
    } else {
      await expect(tickets.reopen(row.identifier, "human", "a note")).rejects.toMatchObject({
        code: "invalid_state",
      });
    }
  });

  it("[error] empty note -> note_required (400 mapped by the API layer)", async () => {
    const row = seed({ state: "CANCELED" });
    await expect(tickets.reopen(row.identifier, "human", "")).rejects.toMatchObject({ code: "note_required" });
  });

  it("[error] whitespace-only note -> note_required", async () => {
    const row = seed({ state: "CANCELED" });
    await expect(tickets.reopen(row.identifier, "human", "   ")).rejects.toMatchObject({ code: "note_required" });
  });

  it("[unit] trims the note before storing it on the TicketEvent", async () => {
    const row = seed({ state: "CANCELED" });
    await tickets.reopen(row.identifier, "human", "  found a regression  ");
    const ev = fake.store.events.find((e) => e.kind === "state_change" && e.toValue === "BACKLOG");
    expect(ev?.note).toBe("found a regression");
  });

  it("[unit] currentRole/regressionRound are preserved (not reset)", async () => {
    const row = seed({ state: "CANCELED", currentRole: "QA_ENGINEER", regressionRound: 2 });
    const t = await tickets.reopen(row.identifier, "human", "reopening");
    expect(t.currentRole).toBe("QA_ENGINEER");
    expect(t.regressionRound).toBe(2);
  });
});

describe("transition matrix — handoff(role, note?) — orthogonal, outside the 9 verbs", () => {
  it.each(ALL_STATES)("handoff: %s", async (state) => {
    const row = seed({ state, currentRole: "FRONTEND_ENGINEER" });
    if (state === "IN_PROGRESS") {
      const t = await tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER");
      expect(t.currentRole).toBe("BACKEND_ENGINEER");
    } else {
      await expect(tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER")).rejects.toMatchObject({
        code: "invalid_state",
      });
    }
  });

  it("[unit] no-op (no event, no notify) when the role is unchanged", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "ARCHITECT" });
    await tickets.handoff(row.identifier, "architect", "ARCHITECT");
    expect(fake.store.events.filter((e) => e.ticketId === row.id)).toHaveLength(0);
    expect(tg).not.toHaveBeenCalled();
  });

  it("[unit] pushes the new role only when it differs from the last roleHistory entry", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "FRONTEND_ENGINEER", roleHistory: ["FRONTEND_ENGINEER"] });
    const t = await tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER");
    expect(t.roleHistory).toEqual(["FRONTEND_ENGINEER", "BACKEND_ENGINEER"]);
  });

  it("[classification] backward stage move increments regressionRound + sends 'regression'", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "QA_ENGINEER", regressionRound: 0 });
    const t = await tickets.handoff(row.identifier, "qa-engineer", "BACKEND_ENGINEER", "found a bug");
    expect(t.regressionRound).toBe(1);
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Sent back from QA to Backend");
    expect(text).toContain("round 1");
  });

  it("[classification] forward into Verify after a prior regression sends 'reverify' (no extra increment)", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "BACKEND_ENGINEER", regressionRound: 1 });
    const t = await tickets.handoff(row.identifier, "backend-engineer", "QA_ENGINEER");
    expect(t.regressionRound).toBe(1);
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Back to QA for re-review");
  });

  it("[classification] normal forward move with no prior regression sends plain 'handoff'", async () => {
    const row = seed({ state: "IN_PROGRESS", currentRole: "ARCHITECT", regressionRound: 0 });
    await tickets.handoff(row.identifier, "architect", "UX_DESIGNER");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Handed over to Designer");
  });

  // CAM-342 — model-tier trial instrumentation (AC-5, EC-4)
  describe("agentModel stamp (CAM-342)", () => {
    it("[unit] stamps agentModel when provided", async () => {
      const row = seed({ state: "IN_PROGRESS", currentRole: "FRONTEND_ENGINEER", agentModel: null });
      const t = await tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER", undefined, "sonnet");
      expect(t.agentModel).toBe("sonnet");
    });

    it("[unit] latest stamp wins — overwrites a prior tier (sonnet -> opus)", async () => {
      const row = seed({ state: "IN_PROGRESS", currentRole: "BACKEND_ENGINEER", agentModel: "sonnet" });
      const t = await tickets.handoff(row.identifier, "orchestrator", "QA_ENGINEER", undefined, "opus");
      expect(t.agentModel).toBe("opus");
    });

    it("[unit/EC-4] omitting agentModel leaves the existing value unchanged", async () => {
      const row = seed({ state: "IN_PROGRESS", currentRole: "FRONTEND_ENGINEER", agentModel: "sonnet" });
      const t = await tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER");
      expect(t.agentModel).toBe("sonnet");
    });

    it("[unit] no per-dispatch history is kept — only one TicketEvent (handoff), never a model-change event", async () => {
      const row = seed({ state: "IN_PROGRESS", currentRole: "FRONTEND_ENGINEER", agentModel: "sonnet" });
      await tickets.handoff(row.identifier, "frontend-engineer", "BACKEND_ENGINEER", undefined, "opus");
      const events = fake.store.events.filter((e) => e.ticketId === row.id);
      expect(events).toHaveLength(1);
      expect(events[0].kind).toBe("handoff");
    });

    it("[unit] stamps agentModel even on a same-role handoff (no role change, model still latest-wins)", async () => {
      const row = seed({ state: "IN_PROGRESS", currentRole: "ARCHITECT", agentModel: "sonnet" });
      const t = await tickets.handoff(row.identifier, "architect", "ARCHITECT", undefined, "opus");
      expect(t.agentModel).toBe("opus");
    });
  });
});

// ── start(role) notify semantics (documents the dual-fire design decision) ─────────────

describe("start(role) — notify semantics", () => {
  it("[notify] start() [no role] sends no Telegram message", async () => {
    const row = seed({ state: "BACKLOG" });
    await tickets.start(row.identifier, "human");
    expect(tg).not.toHaveBeenCalled();
  });

  it("[notify] first-ever start(role) fires BOTH 'started' and 'handoff' (currentRole was null)", async () => {
    const row = seed({ state: "BACKLOG", currentRole: null });
    await tickets.start(row.identifier, "human", "ARCHITECT");
    expect(tg).toHaveBeenCalledTimes(2);
    const texts = tg.mock.calls.map(([t]) => t as string);
    expect(texts.some((t) => t.includes("Work started"))).toBe(true);
    expect(texts.some((t) => t.includes("Handed over to Architect"))).toBe(true);
  });

  it("[notify] start(role) with a preserved-and-unchanged role (post-reopen) fires only 'started'", async () => {
    const row = seed({ state: "BACKLOG", currentRole: "ARCHITECT", roleHistory: ["ARCHITECT"] });
    await tickets.start(row.identifier, "human", "ARCHITECT");
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0] as [string];
    expect(text).toContain("Work started");
  });

  it("[resilience] a rejected sendTelegram call still returns the updated ticket", async () => {
    tg.mockRejectedValueOnce(new Error("network down"));
    const row = seed({ state: "BACKLOG" });
    const t = await tickets.start(row.identifier, "human", "ARCHITECT");
    expect(t.state).toBe("IN_PROGRESS");
  });
});

// ── ticketCtx — "More Detail" button target (CAM-285) ───────────────────────────────────
// Telegram's "More Detail" button must open OUR board (/status/map), never the legacy
// Linear URL — for imported tickets (legacyUrl set) AND for brand-new tickets (legacyUrl
// null), which previously got no button at all.

type TgButton = { text: string; url?: string; callback_data?: string };

function moreDetailButtonFrom(callIndex = 0): TgButton | undefined {
  const [, options] = tg.mock.calls[callIndex] as [string, { buttons: TgButton[][] }];
  return options.buttons.flat().find((b) => b.text === "More Detail");
}

describe("ticketCtx — More Detail button always targets /status/map (CAM-285)", () => {
  it("[notify] an imported ticket with a legacyUrl still gets the board URL, not legacyUrl", async () => {
    const row = seed({
      state: "IN_PROGRESS",
      currentRole: "BACKEND_ENGINEER",
      legacyUrl: "https://linear.app/campvibe/issue/CAM-1",
    });
    await tickets.raiseGate(row.identifier, "backend-engineer");
    const btn = moreDetailButtonFrom();
    expect(btn).toBeDefined();
    expect(btn!.url).toContain("/status/map");
    expect(btn!.url).not.toBe(row.legacyUrl);
    expect(btn!.url).not.toContain("linear.app");
  });

  it("[notify] a brand-new ticket (no legacyUrl) still gets a More Detail button", async () => {
    const row = seed({ state: "BACKLOG", currentRole: null, legacyUrl: null });
    await tickets.start(row.identifier, "human", "ARCHITECT");
    const btn = moreDetailButtonFrom();
    expect(btn).toBeDefined();
    expect(btn!.url).toContain("/status/map");
  });

  it("[notify] the board URL never leaks the STATUS_TOKEN into a log line (button url only)", async () => {
    const saved = process.env.STATUS_TOKEN;
    process.env.STATUS_TOKEN = "super-secret-token";
    try {
      const row = seed({ state: "IN_PROGRESS", currentRole: "BACKEND_ENGINEER" });
      const consoleErr = vi.spyOn(console, "error").mockImplementation(() => {});
      await tickets.raiseGate(row.identifier, "backend-engineer");
      const btn = moreDetailButtonFrom();
      expect(btn!.url).toContain("super-secret-token"); // token belongs in the button url…
      consoleErr.mock.calls.forEach((call) => {
        expect(JSON.stringify(call)).not.toContain("super-secret-token"); // …never in a log line
      });
      consoleErr.mockRestore();
    } finally {
      process.env.STATUS_TOKEN = saved;
    }
  });
});

// ── blocked / archive / unarchive (orthogonal flags) ────────────────────────────────────

describe("setBlocked — orthogonal flag", () => {
  it("transitioning to blocked=true logs a 'blocked' event and notifies", async () => {
    const row = seed({ state: "IN_PROGRESS", blocked: false });
    const t = await tickets.setBlocked(row.identifier, "backend-engineer", true, "waiting on staging DB");
    expect(t.blocked).toBe(true);
    const ev = fake.store.events.find((e) => e.kind === "blocked" && e.ticketId === row.id);
    expect(ev).toMatchObject({ fromValue: "false", toValue: "true", note: "waiting on staging DB" });
    expect(tg).toHaveBeenCalledTimes(1);
  });

  it("unblocking logs the event but does not notify", async () => {
    const row = seed({ state: "IN_PROGRESS", blocked: true });
    const t = await tickets.setBlocked(row.identifier, "backend-engineer", false);
    expect(t.blocked).toBe(false);
    expect(tg).not.toHaveBeenCalled();
  });

  it("is idempotent when already at the requested value (no event)", async () => {
    const row = seed({ state: "IN_PROGRESS", blocked: true });
    await tickets.setBlocked(row.identifier, "backend-engineer", true);
    expect(fake.store.events.filter((e) => e.ticketId === row.id)).toHaveLength(0);
  });
});

describe("archive / unarchive — orthogonal flag", () => {
  it("archive sets archivedAt and logs an 'archived' event (toValue set, fromValue null)", async () => {
    const row = seed({ archivedAt: null });
    const t = await tickets.archiveTicket(row.identifier, "human");
    expect(t.archivedAt).not.toBeNull();
    const ev = fake.store.events.find((e) => e.kind === "archived" && e.ticketId === row.id);
    expect(ev?.toValue).not.toBeNull();
    expect(ev?.fromValue).toBeNull();
  });

  it("archive is idempotent when already archived (no event)", async () => {
    const row = seed({ archivedAt: new Date() });
    await tickets.archiveTicket(row.identifier, "human");
    expect(fake.store.events.filter((e) => e.ticketId === row.id)).toHaveLength(0);
  });

  it("unarchive clears archivedAt and logs an 'archived' event (toValue null)", async () => {
    const row = seed({ archivedAt: new Date() });
    const t = await tickets.unarchiveTicket(row.identifier, "human");
    expect(t.archivedAt).toBeNull();
    const ev = fake.store.events.find((e) => e.kind === "archived" && e.ticketId === row.id);
    expect(ev?.toValue).toBeNull();
    expect(ev?.fromValue).not.toBeNull();
  });

  it("unarchive is idempotent when not archived (no event)", async () => {
    const row = seed({ archivedAt: null });
    await tickets.unarchiveTicket(row.identifier, "human");
    expect(fake.store.events.filter((e) => e.ticketId === row.id)).toHaveLength(0);
  });
});

// ── addComment ───────────────────────────────────────────────────────────────────────────

describe("addComment", () => {
  it("creates a TicketComment and logs a 'comment' TicketEvent", async () => {
    const row = seed({});
    const c = await tickets.addComment(row.identifier, "human", "  looks good  ");
    expect(c.body).toBe("looks good");
    expect(c.authorName).toBe("human");
    const ev = fake.store.events.find((e) => e.kind === "comment" && e.ticketId === row.id);
    expect(ev?.note).toBe("looks good");
  });

  it("[error] rejects an empty/whitespace-only body", async () => {
    const row = seed({});
    await expect(tickets.addComment(row.identifier, "human", "   ")).rejects.toThrow(TicketTransitionError);
  });

  it("addComment on an unknown identifier throws TicketNotFoundError", async () => {
    await expect(tickets.addComment("CAM-9999", "human", "hi")).rejects.toThrow(TicketNotFoundError);
  });
});

// ── updateFields ─────────────────────────────────────────────────────────────────────────

describe("updateFields — plain edits, no state-machine side effects", () => {
  it("updates the provided fields and logs an 'updated' event listing the changed keys", async () => {
    const row = seed({ title: "Old title", priority: 0 });
    const t = await tickets.updateFields(row.identifier, "human", { title: "New title", priority: 2 });
    expect(t.title).toBe("New title");
    expect(t.priority).toBe(2);
    const ev = fake.store.events.find((e) => e.kind === "updated" && e.ticketId === row.id);
    expect(ev?.toValue).toContain("title");
    expect(ev?.toValue).toContain("priority");
  });

  it("no-op (no event) when no fields are provided", async () => {
    const row = seed({});
    await tickets.updateFields(row.identifier, "human", {});
    expect(fake.store.events.filter((e) => e.ticketId === row.id)).toHaveLength(0);
  });

  it("[error] rejects an empty title", async () => {
    const row = seed({});
    await expect(tickets.updateFields(row.identifier, "human", { title: "   " })).rejects.toThrow(
      TicketTransitionError
    );
  });

  it("does not fire any Telegram notification", async () => {
    const row = seed({});
    await tickets.updateFields(row.identifier, "human", { priority: 1 });
    expect(tg).not.toHaveBeenCalled();
  });

  // CAM-300 — epicId re-parenting via updateFields
  it("re-parents to another epic by CAM identifier and logs the change", async () => {
    const epicA = seed({ type: "EPIC", title: "Epic A" });
    const epicB = seed({ type: "EPIC", title: "Epic B" });
    const row = seed({ epicId: epicA.id });
    const t = await tickets.updateFields(row.identifier, "human", { epicId: epicB.identifier });
    expect(t.epicId).toBe(epicB.id);
    const ev = fake.store.events.find((e) => e.kind === "updated" && e.ticketId === row.id);
    expect(ev?.toValue).toContain("epicId");
  });

  it("re-parents by internal id as well", async () => {
    const epic = seed({ type: "EPIC", title: "Epic C" });
    const row = seed({});
    const t = await tickets.updateFields(row.identifier, "human", { epicId: epic.id });
    expect(t.epicId).toBe(epic.id);
  });

  it("detaches from its epic when epicId is null", async () => {
    const epic = seed({ type: "EPIC", title: "Epic D" });
    const row = seed({ epicId: epic.id });
    const t = await tickets.updateFields(row.identifier, "human", { epicId: null });
    expect(t.epicId).toBeNull();
  });

  it("[error] rejects an epicId target that is not an EPIC", async () => {
    const story = seed({ type: "STORY" });
    const row = seed({});
    await expect(
      tickets.updateFields(row.identifier, "human", { epicId: story.identifier })
    ).rejects.toThrow(TicketTransitionError);
    const after = fake.store.tickets.get(row.id);
    expect(after?.epicId ?? null).toBeNull();
  });

  it("[error] rejects an epicId that does not exist", async () => {
    const row = seed({});
    await expect(
      tickets.updateFields(row.identifier, "human", { epicId: "CAM-99999" })
    ).rejects.toThrow(TicketNotFoundError);
  });

  it("[error] rejects a ticket set as its own epic", async () => {
    const epic = seed({ type: "EPIC", title: "Epic E" });
    await expect(
      tickets.updateFields(epic.identifier, "human", { epicId: epic.identifier })
    ).rejects.toThrow(TicketTransitionError);
  });

  // CAM-342 — model-tier trial instrumentation (AC-5, EC-4) via the updateFields verb
  describe("agentModel stamp (CAM-342)", () => {
    it("[unit] stamps agentModel when provided", async () => {
      const row = seed({ agentModel: null });
      const t = await tickets.updateFields(row.identifier, "human", { agentModel: "haiku" });
      expect(t.agentModel).toBe("haiku");
      const ev = fake.store.events.find((e) => e.kind === "updated" && e.ticketId === row.id);
      expect(ev?.toValue).toContain("agentModel");
    });

    it("[unit] latest stamp wins — overwrites a prior tier", async () => {
      const row = seed({ agentModel: "sonnet" });
      const t = await tickets.updateFields(row.identifier, "human", { agentModel: "fable" });
      expect(t.agentModel).toBe("fable");
    });

    it("[unit/EC-4] omitting agentModel leaves the existing value unchanged", async () => {
      const row = seed({ agentModel: "sonnet" });
      const t = await tickets.updateFields(row.identifier, "human", { priority: 3 });
      expect(t.agentModel).toBe("sonnet");
    });
  });
});

// ── reads ────────────────────────────────────────────────────────────────────────────────

describe("reads — listTickets / getTicketByIdentifier / listComments / listEvents", () => {
  it("listTickets filters by epicId and archived", async () => {
    const epic = seed({ type: "EPIC", title: "Epic A" });
    seed({ state: "BACKLOG", epicId: epic.id });
    seed({ state: "DONE", epicId: epic.id, archivedAt: new Date() });

    const onlyEpic = await tickets.listTickets({ epicId: epic.id });
    expect(onlyEpic.length).toBe(2);
    expect(onlyEpic.every((t) => t.epicId === epic.id)).toBe(true);

    const onlyArchived = await tickets.listTickets({ archived: true });
    expect(onlyArchived.every((t) => t.archivedAt !== null)).toBe(true);

    const excludeArchived = await tickets.listTickets({ archived: false });
    expect(excludeArchived.every((t) => t.archivedAt === null)).toBe(true);
  });

  it("getTicketByIdentifier returns null for an unknown id", async () => {
    expect(await tickets.getTicketByIdentifier("CAM-999999")).toBeNull();
  });

  it("listComments / listEvents return only rows for the given ticket, ordered oldest-first", async () => {
    const row = seed({});
    await tickets.addComment(row.identifier, "human", "first");
    await tickets.addComment(row.identifier, "human", "second");
    const comments = await tickets.listComments(row.id);
    expect(comments.map((c) => c.body)).toEqual(["first", "second"]);
  });
});
