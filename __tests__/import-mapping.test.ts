/**
 * CAM-280 (T-4) — scripts/lib/import-mapping.mjs unit tests.
 *
 * Covers the full Linear -> ADR-010-column decision tables this story's mapping reverses:
 * title/role-tag stripping, the legacy "Epic · Story" title-prefix split, state mapping,
 * type mapping (incl. the known parentless-legacy-story edge case), label -> column mapping
 * (incl. the regression-label parse and multi-persona precedence), epic resolution, and the
 * full per-issue composer.
 */
import { describe, it, expect } from "vitest";
import {
  roleSlugToEnum,
  stripRoleTag,
  splitEpicTitlePrefix,
  mapState,
  mapType,
  mapLabels,
  resolveEpicId,
  mapIssueToTicketInput,
  mapComment,
} from "../scripts/lib/import-mapping.mjs";

describe("roleSlugToEnum", () => {
  it("canonical slug -> matching enum member", () => {
    expect(roleSlugToEnum("backend-engineer")).toBe("BACKEND_ENGINEER");
    expect(roleSlugToEnum("devops-release")).toBe("DEVOPS_RELEASE");
    expect(roleSlugToEnum("product-owner")).toBe("PRODUCT_OWNER");
  });

  it("short-hand alias -> canonical enum member", () => {
    expect(roleSlugToEnum("backend")).toBe("BACKEND_ENGINEER");
    expect(roleSlugToEnum("devops")).toBe("DEVOPS_RELEASE");
    expect(roleSlugToEnum("qa")).toBe("QA_ENGINEER");
    expect(roleSlugToEnum("designer")).toBe("UX_DESIGNER");
    expect(roleSlugToEnum("po")).toBe("PRODUCT_OWNER");
  });

  it("excluded roles (orchestrator/human) and unknown slugs -> null", () => {
    expect(roleSlugToEnum("human")).toBeNull();
    expect(roleSlugToEnum("orchestrator")).toBeNull();
    expect(roleSlugToEnum("test")).toBeNull();
    expect(roleSlugToEnum("id")).toBeNull();
  });

  it("null/undefined/empty -> null", () => {
    expect(roleSlugToEnum(null)).toBeNull();
    expect(roleSlugToEnum(undefined)).toBeNull();
    expect(roleSlugToEnum("")).toBeNull();
  });
});

describe("stripRoleTag", () => {
  it("extracts a known role and cleans the title", () => {
    expect(stripRoleTag("[backend-engineer] Fix the thing")).toEqual({
      role: "BACKEND_ENGINEER",
      title: "Fix the thing",
    });
  });

  it("extracts an alias role", () => {
    expect(stripRoleTag("[backend] แก้บั๊ก")).toEqual({ role: "BACKEND_ENGINEER", title: "แก้บั๊ก" });
  });

  it("unmappable tag (human/test) -> role null, tag still stripped (real CAM-11/CAM-172 shape)", () => {
    expect(stripRoleTag("Wishlist · [human] รีวิว & อนุมัติ Design (Gate G2)")).toEqual({
      role: null,
      title: "Wishlist · รีวิว & อนุมัติ Design (Gate G2)",
    });
    expect(stripRoleTag("[test] เดโม gift ส่งมอบสำเร็จ (cancel after)")).toEqual({
      role: null,
      title: "เดโม gift ส่งมอบสำเร็จ (cancel after)",
    });
  });

  it("no tag -> role null, title unchanged (trimmed)", () => {
    expect(stripRoleTag("Data-layer performance and freshness")).toEqual({
      role: null,
      title: "Data-layer performance and freshness",
    });
  });

  it("multiple bracket tags (real CAM-61 shape) -> only the first is inspected for role; all stripped", () => {
    expect(stripRoleTag("[devops-release] หน้ารายละเอียดการจอง /bookings/[id]")).toEqual({
      role: "DEVOPS_RELEASE",
      title: "หน้ารายละเอียดการจอง /bookings/",
    });
  });

  it("null/empty input -> role null, empty title", () => {
    expect(stripRoleTag(null)).toEqual({ role: null, title: "" });
    expect(stripRoleTag("")).toEqual({ role: null, title: "" });
  });
});

describe("splitEpicTitlePrefix", () => {
  it("splits on the first · and trims both sides", () => {
    expect(splitEpicTitlePrefix("Wishlist · บันทึกแคมป์ที่ถูกใจ (Camper)")).toEqual({
      epicPrefix: "Wishlist",
      rest: "บันทึกแคมป์ที่ถูกใจ (Camper)",
    });
  });

  it("no · in title -> epicPrefix null, rest = the original title", () => {
    expect(splitEpicTitlePrefix("Self-hosted Delivery Tickets")).toEqual({
      epicPrefix: null,
      rest: "Self-hosted Delivery Tickets",
    });
  });

  it("real mid-title · with a real parent (CAM-239 shape) — still splits mechanically; caller gates by hasParent", () => {
    // This function is pure text-splitting; the "only meaningful when no parent" rule is
    // enforced by the caller (mapIssueToTicketInput), not here.
    const r = splitEpicTitlePrefix(
      "[devops-release] MEDIA-1 — fix avatar display + image upload (navbar-stale · flash)"
    );
    expect(r.epicPrefix).toBe("[devops-release] MEDIA-1 — fix avatar display + image upload (navbar-stale");
    expect(r.rest).toBe("flash)");
  });

  it("null/empty input", () => {
    expect(splitEpicTitlePrefix(null)).toEqual({ epicPrefix: null, rest: "" });
  });
});

describe("mapState", () => {
  it("maps each Linear state.type to the matching TicketState (no awaiting-you label)", () => {
    expect(mapState("backlog", false)).toBe("BACKLOG");
    expect(mapState("unstarted", false)).toBe("TODO");
    expect(mapState("started", false)).toBe("IN_PROGRESS");
    expect(mapState("completed", false)).toBe("DONE");
    expect(mapState("canceled", false)).toBe("CANCELED");
  });

  it("started + awaiting-you label -> AWAITING_GATE (the only way to recover it from raw Linear data)", () => {
    expect(mapState("started", true)).toBe("AWAITING_GATE");
  });

  it("awaiting-you label on a non-started state.type is ignored (never overrides backlog/unstarted/completed/canceled)", () => {
    expect(mapState("backlog", true)).toBe("BACKLOG");
    expect(mapState("completed", true)).toBe("DONE");
  });

  it("unknown/missing state.type defaults to BACKLOG (safest default)", () => {
    expect(mapState("weird", false)).toBe("BACKLOG");
    expect(mapState(undefined, false)).toBe("BACKLOG");
  });
});

describe("mapType", () => {
  it("parentless + has a Linear project -> EPIC", () => {
    expect(mapType(false, true)).toBe("EPIC");
  });

  it("parentless + no project -> STORY", () => {
    expect(mapType(false, false)).toBe("STORY");
  });

  it("has a parent (with or without a project) -> STORY", () => {
    expect(mapType(true, true)).toBe("STORY");
    expect(mapType(true, false)).toBe("STORY");
  });
});

describe("mapLabels", () => {
  it("role:* labels dedupe into roleHistory, unknown role labels dropped", () => {
    const r = mapLabels(["role:backend-engineer", "role:qa-engineer", "role:backend-engineer", "role:unknown-thing"]);
    expect(r.roleHistory).toEqual(["BACKEND_ENGINEER", "QA_ENGINEER"]);
  });

  it("regression:<role>:<n> -> regressionRound = max(n) across every matching label", () => {
    expect(mapLabels(["regression:frontend-engineer:2"]).regressionRound).toBe(2);
    expect(
      mapLabels(["regression:frontend-engineer:1", "regression:architect:3"]).regressionRound
    ).toBe(3);
  });

  it("no regression label -> regressionRound 0", () => {
    expect(mapLabels(["platform"]).regressionRound).toBe(0);
  });

  it("multi-persona label (real CAM-47 shape: admin+platform) resolves by specific-over-generic precedence", () => {
    expect(mapLabels(["admin", "platform"]).persona).toBe("ADMIN");
  });

  it("single persona label resolves directly", () => {
    expect(mapLabels(["camper"]).persona).toBe("CAMPER");
    expect(mapLabels(["host"]).persona).toBe("HOST");
    expect(mapLabels(["platform"]).persona).toBe("PLATFORM");
  });

  it("no persona label -> persona null", () => {
    expect(mapLabels(["Bug"]).persona).toBeNull();
  });

  it("flags: awaiting-you / released / blocked / changes-requested", () => {
    const r = mapLabels(["awaiting-you", "released", "blocked", "changes-requested"]);
    expect(r.gateFlag).toBe(true);
    expect(r.releasedFlag).toBe(true);
    expect(r.blocked).toBe(true);
    expect(r.changesRequested).toBe(true);
  });

  it("flags default false when absent", () => {
    const r = mapLabels(["platform"]);
    expect(r.gateFlag).toBe(false);
    expect(r.releasedFlag).toBe(false);
    expect(r.blocked).toBe(false);
    expect(r.changesRequested).toBe(false);
  });

  it("every raw label is preserved verbatim in legacyLabels, including unmapped ones (Bug/phase-1/cancel)", () => {
    const raw = ["platform", "role:backend-engineer", "Bug", "phase-1", "cancel", "released"];
    expect(mapLabels(raw).legacyLabels).toEqual(raw);
  });

  it("empty/missing labels -> all-default shape", () => {
    const r = mapLabels([]);
    expect(r).toEqual({
      persona: null,
      roleHistory: [],
      regressionRound: 0,
      blocked: false,
      gateFlag: false,
      changesRequested: false,
      releasedFlag: false,
      legacyLabels: [],
    });
    expect(mapLabels(undefined).legacyLabels).toEqual([]);
  });
});

describe("resolveEpicId", () => {
  const byIdentifier = new Map([
    ["CAM-138", { id: "epic-id-138" }],
    ["CAM-18", { id: "epic-id-18" }],
  ]);
  const epicTitleIndex = new Map([["Wishlist", { id: "epic-id-wishlist" }]]);

  it("resolves via parent identifier when present", () => {
    expect(resolveEpicId({ parentIdentifier: "CAM-138", epicPrefix: null }, byIdentifier, epicTitleIndex)).toBe(
      "epic-id-138"
    );
  });

  it("parent identifier present but not found in byIdentifier (dangling) -> null", () => {
    expect(
      resolveEpicId({ parentIdentifier: "CAM-9999", epicPrefix: null }, byIdentifier, epicTitleIndex)
    ).toBeNull();
  });

  it("no parent, epicPrefix matches an EPIC-type ticket's title -> resolves via title", () => {
    expect(resolveEpicId({ parentIdentifier: null, epicPrefix: "Wishlist" }, byIdentifier, epicTitleIndex)).toBe(
      "epic-id-wishlist"
    );
  });

  it("no parent, epicPrefix has no matching EPIC title (real CAM-131/CAM-17 shape: 'Hardening'/'P0 Hardening') -> null", () => {
    expect(
      resolveEpicId({ parentIdentifier: null, epicPrefix: "Hardening" }, byIdentifier, epicTitleIndex)
    ).toBeNull();
  });

  it("neither parent nor epicPrefix -> null", () => {
    expect(resolveEpicId({ parentIdentifier: null, epicPrefix: null }, byIdentifier, epicTitleIndex)).toBeNull();
  });
});

describe("mapIssueToTicketInput", () => {
  const base = {
    identifier: "CAM-100",
    number: 100,
    title: "[backend-engineer] Fix the thing",
    description: "some markdown",
    priority: 2,
    url: "https://linear.app/campvibe/issue/CAM-100/fix-the-thing",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
    startedAt: "2026-06-01T01:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    state: { name: "In Progress", type: "started" },
    labels: { nodes: [{ name: "role:backend-engineer" }, { name: "platform" }] },
    parent: null,
    project: null,
    assignee: { name: "Tawatchai Petkaew", displayName: "t.petkaew" },
  };

  it("maps a plain in-progress story with no parent/project", () => {
    const t = mapIssueToTicketInput(base);
    expect(t.identifier).toBe("CAM-100");
    expect(t.number).toBe(100);
    expect(t.title).toBe("Fix the thing"); // role tag stripped
    expect(t.currentRole).toBe("BACKEND_ENGINEER");
    expect(t.type).toBe("STORY"); // no project -> STORY regardless of parent
    expect(t.state).toBe("IN_PROGRESS");
    expect(t.priority).toBe(2);
    expect(t.roleHistory).toEqual(["BACKEND_ENGINEER"]);
    expect(t.persona).toBe("PLATFORM"); // base fixture carries the "platform" label
    expect(t.featureName).toBeNull();
    expect(t.assigneeName).toBe("t.petkaew");
    expect(t.legacyUrl).toBe(base.url);
    expect(t.legacyLabels).toEqual(["role:backend-engineer", "platform"]);
    expect(t._parentIdentifier).toBeNull();
    expect(t._epicPrefix).toBeNull();
  });

  it("awaiting-you label -> AWAITING_GATE + gateRaisedAt = updatedAt", () => {
    const t = mapIssueToTicketInput({
      ...base,
      labels: { nodes: [{ name: "awaiting-you" }] },
    });
    expect(t.state).toBe("AWAITING_GATE");
    expect(t.gateRaisedAt).toBe(base.updatedAt);
  });

  it("released label -> releasedAt = completedAt", () => {
    const t = mapIssueToTicketInput({
      ...base,
      completedAt: "2026-06-05T00:00:00.000Z",
      state: { name: "Done", type: "completed" },
      labels: { nodes: [{ name: "released" }] },
    });
    expect(t.releasedAt).toBe("2026-06-05T00:00:00.000Z");
  });

  it("has a real parent -> type STORY, epicPrefix null even if the title contains ·, _parentIdentifier carried", () => {
    const t = mapIssueToTicketInput({
      ...base,
      title: "MEDIA-1 note (navbar-stale · flash)",
      parent: { id: "internal-id", identifier: "CAM-138", title: "AI delivery workflow (The Camper)" },
      project: { id: "proj-1", name: "AI Workflow" },
    });
    expect(t.type).toBe("STORY");
    expect(t._epicPrefix).toBeNull();
    expect(t._parentIdentifier).toBe("CAM-138");
    expect(t.title).toBe("MEDIA-1 note (navbar-stale · flash)"); // · left untouched — not the epic-tag convention here
    expect(t.featureName).toBe("AI Workflow");
  });

  it("legacy Epic · Story title, no parent, has project -> epic-prefix split applies, type EPIC per the given rule (known edge case)", () => {
    const t = mapIssueToTicketInput({
      ...base,
      title: "Wishlist · บันทึกแคมป์ที่ถูกใจ (Camper)",
      parent: null,
      project: { id: "proj-2", name: "Reviews & Reputation" },
    });
    expect(t._epicPrefix).toBe("Wishlist");
    expect(t.title).toBe("บันทึกแคมป์ที่ถูกใจ (Camper)");
    expect(t.type).toBe("EPIC"); // parentless + project, per mapType's literal rule
    expect(t._parentIdentifier).toBeNull();
  });

  it("priority is clamped into 0..4", () => {
    expect(mapIssueToTicketInput({ ...base, priority: 99 }).priority).toBe(4);
    expect(mapIssueToTicketInput({ ...base, priority: -1 }).priority).toBe(0);
    expect(mapIssueToTicketInput({ ...base, priority: null }).priority).toBe(0);
  });

  it("no assignee -> assigneeName null", () => {
    expect(mapIssueToTicketInput({ ...base, assignee: null }).assigneeName).toBeNull();
  });
});

describe("mapComment", () => {
  it("maps a Linear comment node into a TicketComment shape", () => {
    expect(
      mapComment({
        body: "some comment",
        createdAt: "2026-06-01T00:00:00.000Z",
        user: { name: "Tawatchai Petkaew", displayName: "t.petkaew" },
      })
    ).toEqual({ body: "some comment", authorName: "t.petkaew", createdAt: "2026-06-01T00:00:00.000Z" });
  });

  it("falls back to name when displayName is absent, and 'unknown' when no user", () => {
    expect(mapComment({ body: "x", createdAt: "t", user: { name: "Someone" } }).authorName).toBe("Someone");
    expect(mapComment({ body: "x", createdAt: "t", user: null }).authorName).toBe("unknown");
  });

  it("missing body -> empty string, not undefined", () => {
    expect(mapComment({ createdAt: "t", user: null }).body).toBe("");
  });
});
