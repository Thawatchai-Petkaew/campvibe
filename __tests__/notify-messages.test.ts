/**
 * Tests for lib/notify-messages.ts
 *
 * Asserts:
 * - exact English header text for each event kind
 * - correct buttons (labels + callback_data for gate)
 * - description present/absent per spec
 * - [role] tag stripped from description
 * - NO emoji in text or button labels
 * - NOTIFY_EVENTS gating: disabled kind → null
 */
import { describe, it, expect, vi } from "vitest";

// server-only guard: stub the import before importing the module
vi.mock("server-only", () => ({}));

import {
  buildEventMessage,
  NOTIFY_EVENTS,
  ROLE_LABEL,
  esc,
  cleanTitle,
} from "@/lib/notify-messages";

// Emoji detection regex: covers main Unicode emoji ranges
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;

function allButtonLabels(buttons: Array<Array<{ text: string }>>): string[] {
  return buttons.flatMap((row) => row.map((btn) => btn.text));
}

function assertNoEmoji(value: string, location: string) {
  expect(EMOJI_RE.test(value), `emoji found in ${location}: ${value}`).toBe(false);
}

const BASE_CTX = { id: "CAM-9", title: "Some story title", url: "https://linear.app/x" };

describe("ROLE_LABEL", () => {
  it("contains expected role mappings", () => {
    expect(ROLE_LABEL["architect"]).toBe("Architect");
    expect(ROLE_LABEL["ux-designer"]).toBe("Designer");
    expect(ROLE_LABEL["frontend-engineer"]).toBe("Frontend");
    expect(ROLE_LABEL["backend-engineer"]).toBe("Backend");
    expect(ROLE_LABEL["qa-engineer"]).toBe("QA");
    expect(ROLE_LABEL["security-reviewer"]).toBe("Security");
    expect(ROLE_LABEL["devops-release"]).toBe("DevOps");
    expect(ROLE_LABEL["product-owner"]).toBe("Product Owner");
    expect(ROLE_LABEL["analyst"]).toBe("Analyst");
  });
});

describe("NOTIFY_EVENTS defaults", () => {
  it("created is false (default off)", () => {
    expect(NOTIFY_EVENTS.created).toBe(false);
  });
  it("released is true", () => {
    expect(NOTIFY_EVENTS.released).toBe(true);
  });
  it("started is true", () => {
    expect(NOTIFY_EVENTS.started).toBe(true);
  });
  it("handoff is true", () => {
    expect(NOTIFY_EVENTS.handoff).toBe(true);
  });
  it("gate is true", () => {
    expect(NOTIFY_EVENTS.gate).toBe(true);
  });
  it("approved is true", () => {
    expect(NOTIFY_EVENTS.approved).toBe(true);
  });
  it("rejected is true", () => {
    expect(NOTIFY_EVENTS.rejected).toBe(true);
  });
  it("blocked is true", () => {
    expect(NOTIFY_EVENTS.blocked).toBe(true);
  });
  it("done is true", () => {
    expect(NOTIFY_EVENTS.done).toBe(true);
  });
  it("defect is false (default off)", () => {
    expect(NOTIFY_EVENTS.defect).toBe(false);
  });
});

describe("NOTIFY_EVENTS gating", () => {
  it("returns null for a disabled event kind (created)", () => {
    expect(NOTIFY_EVENTS.created).toBe(false);
    const result = buildEventMessage("created", BASE_CTX);
    expect(result).toBeNull();
  });

  it("returns null for a disabled event kind (defect)", () => {
    expect(NOTIFY_EVENTS.defect).toBe(false);
    const result = buildEventMessage("defect", BASE_CTX);
    expect(result).toBeNull();
  });
});

describe("esc helper", () => {
  it("escapes &, <, > for HTML", () => {
    expect(esc("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
  });
  it("leaves normal strings unchanged", () => {
    expect(esc("hello world")).toBe("hello world");
  });
});

describe("cleanTitle helper", () => {
  it("strips a [role] prefix", () => {
    expect(cleanTitle("[backend-engineer] My story")).toBe("My story");
  });
  it("strips a [role] prefix with spaces", () => {
    expect(cleanTitle("  [qa-engineer]  Some title  ")).toBe("Some title");
  });
  it("leaves titles without a tag unchanged", () => {
    expect(cleanTitle("Plain title")).toBe("Plain title");
  });
});

describe("buildEventMessage — started", () => {
  it("returns exact header 'Work started'", () => {
    const msg = buildEventMessage("started", BASE_CTX);
    expect(msg).not.toBeNull();
    expect(msg!.text).toContain("Work started");
  });

  it("includes the issue ID", () => {
    const msg = buildEventMessage("started", BASE_CTX);
    expect(msg!.text).toContain("CAM-9");
  });

  it("includes the description (title)", () => {
    const msg = buildEventMessage("started", BASE_CTX);
    expect(msg!.text).toContain("Some story title");
  });

  it("has More Detail and Live Status buttons", () => {
    const msg = buildEventMessage("started", BASE_CTX);
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).toContain("More Detail");
    expect(labels).toContain("Live Status");
  });

  it("no emoji in text or button labels", () => {
    const msg = buildEventMessage("started", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });

  it("omits More Detail button when url is absent", () => {
    const msg = buildEventMessage("started", { id: "CAM-9", title: "title" });
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).not.toContain("More Detail");
    expect(labels).toContain("Live Status");
  });
});

describe("buildEventMessage — handoff", () => {
  it("returns exact header 'Handed over to Backend' for backend-engineer", () => {
    const msg = buildEventMessage("handoff", { ...BASE_CTX, role: "backend-engineer" });
    expect(msg!.text).toContain("Handed over to Backend");
  });

  it("uses raw slug as fallback for unknown role", () => {
    const msg = buildEventMessage("handoff", { ...BASE_CTX, role: "unknown-role" });
    expect(msg!.text).toContain("Handed over to unknown-role");
  });

  it("includes the description (stripped of role tag)", () => {
    const msg = buildEventMessage("handoff", {
      ...BASE_CTX,
      title: "[backend-engineer] My story",
      role: "backend-engineer",
    });
    expect(msg!.text).toContain("My story");
    expect(msg!.text).not.toContain("[backend-engineer]");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("handoff", { ...BASE_CTX, role: "qa-engineer" });
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — gate", () => {
  it("returns exact header 'Waiting for your approval'", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    expect(msg!.text).toContain("Waiting for your approval");
  });

  it("includes the next-step line", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    expect(msg!.text).toContain("Approve to let the team continue, or send it back for changes.");
  });

  it("has Approve button with callback_data approve:CAM-9", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    const flat = msg!.buttons.flat();
    const approve = flat.find((b) => b.callback_data === "approve:CAM-9");
    expect(approve).toBeDefined();
    expect(approve!.text).toBe("Approve");
  });

  it("has Send Back button with callback_data reject:CAM-9", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    const flat = msg!.buttons.flat();
    const reject = flat.find((b) => b.callback_data === "reject:CAM-9");
    expect(reject).toBeDefined();
    expect(reject!.text).toBe("Send Back");
  });

  it("has More Detail and Live Status buttons", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).toContain("More Detail");
    expect(labels).toContain("Live Status");
  });

  it("includes the description (title)", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    expect(msg!.text).toContain("Some story title");
  });

  it("no emoji in text or button labels", () => {
    const msg = buildEventMessage("gate", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — approved", () => {
  it("returns exact header 'Approved — the team continues'", () => {
    const msg = buildEventMessage("approved", BASE_CTX);
    expect(msg!.text).toContain("Approved — the team continues");
  });

  it("does NOT include the description (title) line", () => {
    const msg = buildEventMessage("approved", BASE_CTX);
    // description is suppressed per spec
    expect(msg!.text).not.toContain("Some story title");
  });

  it("has only Live Status button (no More Detail)", () => {
    const msg = buildEventMessage("approved", BASE_CTX);
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).toContain("Live Status");
    expect(labels).not.toContain("More Detail");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("approved", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — rejected", () => {
  it("returns exact header 'Sent back for changes'", () => {
    const msg = buildEventMessage("rejected", BASE_CTX);
    expect(msg!.text).toContain("Sent back for changes");
  });

  it("does NOT include the description (title) line", () => {
    const msg = buildEventMessage("rejected", BASE_CTX);
    expect(msg!.text).not.toContain("Some story title");
  });

  it("has only Live Status button (no More Detail)", () => {
    const msg = buildEventMessage("rejected", BASE_CTX);
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).toContain("Live Status");
    expect(labels).not.toContain("More Detail");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("rejected", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — blocked", () => {
  it("returns exact header 'Blocked — waiting to be unblocked'", () => {
    const msg = buildEventMessage("blocked", BASE_CTX);
    expect(msg!.text).toContain("Blocked — waiting to be unblocked");
  });

  it("includes the description", () => {
    const msg = buildEventMessage("blocked", BASE_CTX);
    expect(msg!.text).toContain("Some story title");
  });

  it("has More Detail and Live Status buttons", () => {
    const msg = buildEventMessage("blocked", BASE_CTX);
    const labels = allButtonLabels(msg!.buttons);
    expect(labels).toContain("More Detail");
    expect(labels).toContain("Live Status");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("blocked", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — done", () => {
  it("returns exact header 'Completed'", () => {
    const msg = buildEventMessage("done", BASE_CTX);
    expect(msg!.text).toContain("Completed");
  });

  it("includes the description", () => {
    const msg = buildEventMessage("done", BASE_CTX);
    expect(msg!.text).toContain("Some story title");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("done", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — released", () => {
  it("returns exact header 'Now live'", () => {
    const msg = buildEventMessage("released", BASE_CTX);
    expect(msg!.text).toContain("Now live");
  });

  it("includes the description", () => {
    const msg = buildEventMessage("released", BASE_CTX);
    expect(msg!.text).toContain("Some story title");
  });

  it("no emoji", () => {
    const msg = buildEventMessage("released", BASE_CTX);
    assertNoEmoji(msg!.text, "text");
    allButtonLabels(msg!.buttons).forEach((l) => assertNoEmoji(l, "button label"));
  });
});

describe("buildEventMessage — defect (default off)", () => {
  it("returns null because defect is disabled", () => {
    expect(buildEventMessage("defect", BASE_CTX)).toBeNull();
  });
});

describe("buildEventMessage — created (default off)", () => {
  it("returns null because created is disabled", () => {
    expect(buildEventMessage("created", BASE_CTX)).toBeNull();
  });
});

describe("[role] tag stripping in description", () => {
  it("strips [backend-engineer] from the title shown in messages", () => {
    const msg = buildEventMessage("done", {
      id: "CAM-9",
      title: "[backend-engineer] Implement the API",
      url: "https://linear.app/x",
    });
    expect(msg!.text).not.toContain("[backend-engineer]");
    expect(msg!.text).toContain("Implement the API");
  });

  it("strips [qa-engineer] from the gate description", () => {
    const msg = buildEventMessage("gate", {
      id: "CAM-5",
      title: "[qa-engineer] Gate G3 · QA sign-off",
      url: "https://linear.app/x",
    });
    expect(msg!.text).not.toContain("[qa-engineer]");
    expect(msg!.text).toContain("Gate G3");
  });
});
