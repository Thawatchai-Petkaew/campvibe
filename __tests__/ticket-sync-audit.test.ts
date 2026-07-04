/**
 * scripts/lib/ticket-sync-audit.mjs unit tests (docs/template-upgrades-v2, PR-3/4).
 *
 * Covers the pure `hasUnresolvedMarker` check that `ticket-sync.mjs audit` uses to fail
 * template-conformance (exit 11) when a non-DONE STORY/TASK spec still carries an open
 * `[NEEDS CLARIFICATION: <question>]` marker (spec-kit convention, story.md header comment).
 * Kept as a pure-function test — no network, no live ticket DB mutation.
 */
import { describe, it, expect } from "vitest";
import { hasUnresolvedMarker, NEEDS_CLARIFICATION_MARKER } from "../scripts/lib/ticket-sync-audit.mjs";

describe("hasUnresolvedMarker", () => {
  it("false on a clean story.md with no marker", () => {
    const body = "## Story\nAs a **Camper**, I want X, so that Y.\n\n## AC\n| # | Given | When |\n";
    expect(hasUnresolvedMarker(body)).toBe(false);
  });

  it("true when the spec carries an open [NEEDS CLARIFICATION: ...] marker", () => {
    const body = "## Story\nAs a **Camper**, I want [NEEDS CLARIFICATION: which persona?], so that Y.\n";
    expect(hasUnresolvedMarker(body)).toBe(true);
  });

  it("true even when the marker sits inside a table cell", () => {
    const body = "| AC-1 | [NEEDS CLARIFICATION: max photos] | when | then |\n";
    expect(hasUnresolvedMarker(body)).toBe(true);
  });

  it("true for more than one marker in the same spec (still just fails once)", () => {
    const body = "[NEEDS CLARIFICATION: a] ... [NEEDS CLARIFICATION: b]";
    expect(hasUnresolvedMarker(body)).toBe(true);
  });

  it("false on empty/undefined/non-string input — never throws", () => {
    expect(hasUnresolvedMarker("")).toBe(false);
    expect(hasUnresolvedMarker(undefined as unknown as string)).toBe(false);
    expect(hasUnresolvedMarker(null as unknown as string)).toBe(false);
  });

  it("is case-sensitive to the exact spec-kit marker text (does not false-positive on similar words)", () => {
    const body = "This story needs clarification from the host before build.";
    expect(hasUnresolvedMarker(body)).toBe(false);
  });

  it("exports the marker constant used by the template + docs", () => {
    expect(NEEDS_CLARIFICATION_MARKER).toBe("[NEEDS CLARIFICATION");
  });
});
