/**
 * CAM-279 (T-3) — scripts/lib/ticket-sync-mapping.mjs unit tests.
 *
 * Covers the full legacy-state -> ADR-010-verb decision table (every current TicketState x
 * every one of the 5 legacy target names) and the legacy-label -> verb table (awaiting-you /
 * released / blocked / persona / unknown), per the ADR-010 transition table
 * (docs/adr/ADR-010-self-hosted-delivery-tickets.md).
 */
import { describe, it, expect } from "vitest";
import {
  mapLegacyState,
  mapLegacyLabel,
  LEGACY_STATES,
  PERSONA_LABELS,
  ACTIONS_ACCEPTING_NOTE,
} from "../scripts/lib/ticket-sync-mapping.mjs";

const ALL_STATES = ["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE", "DONE", "CANCELED"];

describe("mapLegacyState — target Backlog", () => {
  it("noop when already BACKLOG", () => {
    expect(mapLegacyState("Backlog", { state: "BACKLOG" })).toEqual({ ok: true, noop: true });
  });
  it("reopen when CANCELED", () => {
    expect(mapLegacyState("Backlog", { state: "CANCELED" })).toEqual({ ok: true, action: "reopen" });
  });
  it.each(["TODO", "IN_PROGRESS", "AWAITING_GATE", "DONE"])("no verb from %s", (state) => {
    const r = mapLegacyState("Backlog", { state });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no verb/i);
  });
});

describe("mapLegacyState — target Todo", () => {
  it("noop when already TODO", () => {
    expect(mapLegacyState("Todo", { state: "TODO" })).toEqual({ ok: true, noop: true });
  });
  it("start() with no params from BACKLOG", () => {
    expect(mapLegacyState("Todo", { state: "BACKLOG" })).toEqual({
      ok: true,
      action: "start",
      params: {},
    });
  });
  it.each(["IN_PROGRESS", "AWAITING_GATE", "DONE", "CANCELED"])("no verb from %s", (state) => {
    expect(mapLegacyState("Todo", { state }).ok).toBe(false);
  });
});

describe("mapLegacyState — target In Progress", () => {
  it("noop when already IN_PROGRESS", () => {
    expect(mapLegacyState("In Progress", { state: "IN_PROGRESS" })).toEqual({ ok: true, noop: true });
  });
  it("start() with no role from BACKLOG when no currentRole known", () => {
    expect(mapLegacyState("In Progress", { state: "BACKLOG" })).toEqual({
      ok: true,
      action: "start",
      params: {},
    });
  });
  it("start(role) from TODO keeps the ticket's current role", () => {
    expect(mapLegacyState("In Progress", { state: "TODO", currentRole: "BACKEND_ENGINEER" })).toEqual({
      ok: true,
      action: "start",
      params: { role: "BACKEND_ENGINEER" },
    });
  });
  it("approve() from AWAITING_GATE with no nextRole when no currentRole known", () => {
    expect(mapLegacyState("In Progress", { state: "AWAITING_GATE" })).toEqual({
      ok: true,
      action: "approve",
      params: {},
    });
  });
  it("approve(nextRole) from AWAITING_GATE keeps the ticket's current role", () => {
    expect(mapLegacyState("In Progress", { state: "AWAITING_GATE", currentRole: "QA_ENGINEER" })).toEqual({
      ok: true,
      action: "approve",
      params: { nextRole: "QA_ENGINEER" },
    });
  });
  it.each(["DONE", "CANCELED"])("no verb from %s", (state) => {
    expect(mapLegacyState("In Progress", { state }).ok).toBe(false);
  });
});

describe("mapLegacyState — target Done", () => {
  it("noop when already DONE", () => {
    expect(mapLegacyState("Done", { state: "DONE" })).toEqual({ ok: true, noop: true });
  });
  it("complete() from AWAITING_GATE", () => {
    expect(mapLegacyState("Done", { state: "AWAITING_GATE" })).toEqual({ ok: true, action: "complete" });
  });
  it.each(["BACKLOG", "TODO", "IN_PROGRESS", "CANCELED"])("no verb from %s", (state) => {
    expect(mapLegacyState("Done", { state }).ok).toBe(false);
  });
});

describe("mapLegacyState — target Canceled", () => {
  it("noop when already CANCELED", () => {
    expect(mapLegacyState("Canceled", { state: "CANCELED" })).toEqual({ ok: true, noop: true });
  });
  it("accepts the 2-L spelling too", () => {
    expect(mapLegacyState("Cancelled", { state: "CANCELED" })).toEqual({ ok: true, noop: true });
  });
  it("refuses DONE (terminal)", () => {
    const r = mapLegacyState("Canceled", { state: "DONE" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/terminal/i);
  });
  it.each(["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE"])("cancel() from %s", (state) => {
    expect(mapLegacyState("Canceled", { state })).toEqual({ ok: true, action: "cancel" });
  });
});

describe("mapLegacyState — unknown target / case-insensitivity", () => {
  it("rejects an unrecognized legacy state name", () => {
    const r = mapLegacyState("Triaged", { state: "BACKLOG" });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(LEGACY_STATES.join(", "));
  });
  it("is case-insensitive on the target name", () => {
    expect(mapLegacyState("in progress", { state: "IN_PROGRESS" })).toEqual({ ok: true, noop: true });
    expect(mapLegacyState("DONE", { state: "AWAITING_GATE" })).toEqual({ ok: true, action: "complete" });
  });
});

describe("mapLegacyState — full matrix has an answer for every (state, target) pair", () => {
  it.each(ALL_STATES)("every legacy target resolves for current state %s", (state) => {
    for (const target of LEGACY_STATES) {
      const r = mapLegacyState(target, { state });
      expect(typeof r.ok).toBe("boolean");
      if (r.ok) expect(r.noop === true || typeof r.action === "string").toBe(true);
      else expect(typeof r.reason).toBe("string");
    }
  });
});

// ── mapLegacyLabel ─────────────────────────────────────────────────────────────────────

describe("mapLegacyLabel", () => {
  it("add awaiting-you -> raiseGate", () => {
    expect(mapLegacyLabel("awaiting-you", "add")).toEqual({ ok: true, action: "raiseGate" });
  });
  it("remove awaiting-you -> approve", () => {
    expect(mapLegacyLabel("awaiting-you", "remove")).toEqual({ ok: true, action: "approve" });
  });
  it("add released -> release", () => {
    expect(mapLegacyLabel("released", "add")).toEqual({ ok: true, action: "release" });
  });
  it("remove released -> warn (one-way stamp)", () => {
    const r = mapLegacyLabel("released", "remove");
    expect(r.ok).toBe(true);
    expect(r.warn).toMatch(/one-way stamp/i);
  });
  it("add blocked -> setBlocked(true)", () => {
    expect(mapLegacyLabel("blocked", "add")).toEqual({
      ok: true,
      action: "setBlocked",
      params: { blocked: true },
    });
  });
  it("remove blocked -> setBlocked(false)", () => {
    expect(mapLegacyLabel("blocked", "remove")).toEqual({
      ok: true,
      action: "setBlocked",
      params: { blocked: false },
    });
  });
  it.each(PERSONA_LABELS)("add persona label %s -> updateFields(persona)", (persona) => {
    expect(mapLegacyLabel(persona, "add")).toEqual({
      ok: true,
      action: "updateFields",
      params: { persona: persona.toUpperCase() },
    });
  });
  it("remove a persona label -> updateFields(persona: null)", () => {
    expect(mapLegacyLabel("camper", "remove")).toEqual({
      ok: true,
      action: "updateFields",
      params: { persona: null },
    });
  });
  it("is case-insensitive on the label name", () => {
    expect(mapLegacyLabel("Awaiting-You", "add")).toEqual({ ok: true, action: "raiseGate" });
    expect(mapLegacyLabel("HOST", "add")).toEqual({
      ok: true,
      action: "updateFields",
      params: { persona: "HOST" },
    });
  });
  it("unknown label -> warn no-op (labels are columns now)", () => {
    const r = mapLegacyLabel("priority:high", "add");
    expect(r.ok).toBe(true);
    expect(r.warn).toMatch(/labels are columns now/i);
  });
});

describe("ACTIONS_ACCEPTING_NOTE", () => {
  it("contains exactly the verbs whose zod schema has a note field", () => {
    expect([...ACTIONS_ACCEPTING_NOTE].sort()).toEqual(
      ["cancel", "handoff", "raiseGate", "reject", "reopen", "setBlocked"].sort()
    );
  });
  it("excludes verbs with no note field", () => {
    for (const a of ["start", "approve", "complete", "release", "archive", "unarchive", "updateFields"]) {
      expect(ACTIONS_ACCEPTING_NOTE.has(a)).toBe(false);
    }
  });
});
