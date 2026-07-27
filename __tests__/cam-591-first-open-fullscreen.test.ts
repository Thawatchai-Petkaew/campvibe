// @vitest-environment node
/**
 * cam-591-first-open-fullscreen.test.ts — CAM-591 (owner instruction
 * 2026-07-27: the assistant opens full screen the first time a camper opens
 * it; a returning camper's own stored collapse/expand choice always wins
 * after that).
 *
 * Layer: behavioral, not source-inspection-only. `readExpandedFromStorage`
 * is not exported, so its REAL source is extracted from the shipped
 * `AiChatPanel.tsx` and EXECUTED (same technique as
 * cam-544-dark-default-theme.test.ts) against a constructed fake
 * `window.sessionStorage` — these tests assert what the function actually
 * RETURNS for each stored value, not merely what literal appears in source.
 * A source-inspection-only guard would still pass if `null` and `"0"` were
 * accidentally collapsed back into the same branch (the exact accident this
 * ticket names); the behavioral harness below is what actually catches it.
 *
 * ACs covered:
 *   AC-1 never stored (no key at all)      -> full screen (true)
 *   AC-2 stored "0" (explicit collapse)    -> anchored panel (false) — the
 *        assertion that catches the "collapsed null and '0'" accident
 *   AC-3 stored "1" (explicit expand)      -> full screen (true)
 *   AC-4 mobile (below `sm`) is unchanged (CAM-550, source-inspection)
 *   BR-3 a sessionStorage read failure falls back to false (unchanged)
 *   EC-2 a corrupted stored value (not null, not "1") -> false
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");

// ─────────────────────────────────────────────────────────────
// Harness — extract the real readExpandedFromStorage() body from the
// shipped source and execute it against a fake window.sessionStorage.
// ─────────────────────────────────────────────────────────────

function extractReadFn(): string {
  const match = panelSrc.match(
    /function readExpandedFromStorage\(\): boolean \{[\s\S]*?\n\}\n(?=\nfunction writeExpandedToStorage)/
  );
  if (!match) {
    throw new Error("cam-591: could not locate readExpandedFromStorage() in AiChatPanel.tsx");
  }
  return match[0].replace(": boolean", "");
}

function extractStorageKey(): string {
  const match = panelSrc.match(/const EXPANDED_STORAGE_KEY = "([^"]+)";/);
  if (!match) throw new Error("cam-591: could not locate EXPANDED_STORAGE_KEY constant");
  return match[1];
}

interface FakeWindowOptions {
  stored?: string | null;
  throws?: boolean;
}

function runReadExpandedFromStorage(opts: FakeWindowOptions): boolean {
  const storageKey = extractStorageKey();
  const fnSrc = extractReadFn();
  const combined = `const EXPANDED_STORAGE_KEY = ${JSON.stringify(storageKey)};\n${fnSrc}\nreturn readExpandedFromStorage();`;
  const fakeWindow = {
    sessionStorage: {
      getItem: () => {
        if (opts.throws) throw new Error("cam-591: sessionStorage blocked (private mode)");
        return opts.stored ?? null;
      },
    },
  };
  const runner = new Function("window", combined);
  return runner(fakeWindow) as boolean;
}

describe("AC-1 — never stored (this camper's first-ever open) opens full screen", () => {
  it("[unit] getItem returning null (key never written) returns true", () => {
    expect(runReadExpandedFromStorage({ stored: null })).toBe(true);
  });
});

describe("AC-2 — a remembered explicit collapse still opens as the panel (the assertion that catches the accident)", () => {
  it("[unit] getItem returning the explicit string \"0\" returns false, NOT the AC-1 full-screen default", () => {
    expect(runReadExpandedFromStorage({ stored: "0" })).toBe(false);
  });

  it("[unit/Prove-It] null and \"0\" are PROVABLY different inputs producing different outputs — a regression that collapses them back together would fail this exact pair", () => {
    const neverSet = runReadExpandedFromStorage({ stored: null });
    const explicitlyCollapsed = runReadExpandedFromStorage({ stored: "0" });
    expect(neverSet).toBe(true);
    expect(explicitlyCollapsed).toBe(false);
    expect(neverSet).not.toBe(explicitlyCollapsed);
  });
});

describe("AC-3 — a remembered explicit expand still opens full screen", () => {
  it("[unit] getItem returning the explicit string \"1\" returns true", () => {
    expect(runReadExpandedFromStorage({ stored: "1" })).toBe(true);
  });
});

describe("BR-3/EC-2 — safe fallback on storage failure or a corrupted value (unchanged from CAM-429)", () => {
  it("[unit] a sessionStorage read that throws (privacy mode) falls back to false", () => {
    expect(runReadExpandedFromStorage({ throws: true })).toBe(false);
  });

  it("[unit] a corrupted stored value (not null, not \"1\") is treated as collapsed, not full screen", () => {
    expect(runReadExpandedFromStorage({ stored: "banana" })).toBe(false);
    expect(runReadExpandedFromStorage({ stored: "" })).toBe(false);
  });
});

describe("BR-4 — the first full-screen open persists nothing on its own", () => {
  it("[structural] no sessionStorage.setItem call exists inside readExpandedFromStorage — only toggleExpanded writes", () => {
    expect(extractReadFn()).not.toContain("setItem");
  });
});

describe("AC-4 — mobile (below sm) is unchanged; CAM-550's fullscreen geometry is still in place", () => {
  it("[unit] the max-sm: fullscreen override (100dvh, top-0, bottom-auto) is byte-identical to CAM-550", () => {
    expect(panelSrc).toContain(
      "max-sm:inset-x-0 max-sm:top-0 max-sm:bottom-auto max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-none"
    );
  });

  it("[unit] the safe-area-inset breathing room on header/composer is unchanged", () => {
    expect(panelSrc).toContain("max-sm:pt-[max(1rem,env(safe-area-inset-top))]");
    expect(panelSrc).toContain("max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]");
  });

  it("[unit] the expand/collapse toggle is still hidden below sm: (mobile never gets a minimize control, CAM-550)", () => {
    const idx = panelSrc.indexOf('data-testid="btn--ai-chat-expand-toggle"');
    expect(idx).toBeGreaterThan(-1);
    const block = panelSrc.slice(idx - 200, idx + 200);
    expect(block).toContain('className="hidden sm:inline-flex"');
  });
});

describe("Icons/copy — token-only, no new hardcoded strings introduced by this story", () => {
  it("[structural] no stray hex/px literal introduced near the storage functions", () => {
    const region = panelSrc.slice(panelSrc.indexOf("EXPANDED_STORAGE_KEY"), panelSrc.indexOf("DESKTOP_SPLIT_QUERY"));
    expect(region).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(region).not.toMatch(/\[\d+px\]/);
  });
});
