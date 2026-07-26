/**
 * CAM-546 — primary-coloured TEXT is readable on the dark background.
 *
 * axe reported a SERIOUS `color-contrast` violation on `/preview` once dark
 * became the default theme (CAM-544): `#257771` on `#090b0c` = 3.71:1 against
 * the 4.5:1 body-text floor. `#257771` is dark `--primary`.
 *
 * Two assertion styles are used here ON PURPOSE:
 *
 *   - PROPERTY assertions (most of the file) recompute every ratio from the real
 *     `app/globals.css` with the shipped engine and assert "this pair clears its
 *     floor". A test that pinned "8.52" would pass forever even if the token and
 *     the floor both drifted.
 *   - REGRESSION PINS (the `--primary` unchanged block) deliberately DO pin
 *     CAM-537's published numbers to 2dp. That block's whole job is to prove
 *     this story did not move a value another story tuned, so the literal number
 *     IS the contract.
 *
 * Covers: AC-1..AC-7, BR-1..BR-7, EC-1..EC-6 (story.md).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CSS_PATH,
  DEFERRED_PAIRS,
  ENFORCED_PAIRS,
  blocksFor,
  compositeOver,
  contrastRatio,
  measurePairs,
  oklchToSrgb,
  parseOklch,
  parseTokens,
  resolveOver,
  resolvePairBackground,
  resolveSurface,
  toHex,
} from "../scripts/check-contrast.mjs";

const ROOT = path.join(__dirname, "..");
const CSS = readFileSync(CSS_PATH, "utf8");
const GUARD = path.join(ROOT, "scripts", "check-contrast.mjs");
const BODY_FLOOR = 4.5; // WCAG 2.1 SC 1.4.3
const NON_TEXT_FLOOR = 3; // WCAG 2.1 SC 1.4.11

type TokenSet = Record<string, string>;
const tokens = (css: string) => parseTokens(css) as { light: TokenSet; dark: TokenSet };
const sets = tokens(CSS);
const themes = ["light", "dark"] as const;

const rootBlocks = blocksFor(CSS, ":root").join("\n");
const darkBlock = blocksFor(CSS, ".dark").join("\n");

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

/** Run the guard as a real process; return {code, out}. */
function runGuard(cssPath?: string): { code: number; out: string } {
  try {
    const out = execFileSync("node", cssPath ? [GUARD, cssPath] : [GUARD], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

/** Write a mutated stylesheet to a throwaway file so the repo's own is never touched. */
function withCss(mutate: (css: string) => string, prefix = "cam546-"): string {
  const bad = mutate(CSS);
  expect(bad, "the substitution did not land — the test would prove nothing").not.toBe(CSS);
  const file = path.join(mkdtempSync(path.join(tmpdir(), prefix)), "globals.css");
  writeFileSync(file, bad);
  return file;
}

/* ────────────────────────────────────────────────────────────────────────── */

describe("CAM-546 · the token is declared and actually wired (BR-3, EC-6)", () => {
  it("[unit] --primary-ink is declared in BOTH :root and .dark", () => {
    // EC-6: declared only in .dark, light would silently inherit :root and go
    // unmeasured — the failure mode this assertion exists to catch.
    expect(rootBlocks).toMatch(/--primary-ink:\s*oklch\(/);
    expect(darkBlock).toMatch(/--primary-ink:\s*oklch\(/);
    for (const theme of themes) expect(sets[theme]["--primary-ink"]).toBeDefined();
  });

  it("[unit] --color-primary-ink is mapped in @theme inline, or `text-primary-ink` emits NOTHING", () => {
    // Without this entry Tailwind never generates the utility, the class is a
    // no-op, and every migrated call site silently falls back to inherited
    // colour — a worse bug than the one being fixed, and invisible in review.
    expect(CSS).toContain("--color-primary-ink: var(--primary-ink);");
  });

  it("[unit] light --primary-ink is byte-identical to light --primary (AC-4: light mode does not change)", () => {
    // Compare RAW declarations: `0.511` round-trips through Number as `0.511`
    // but other values do not, and a reparsed comparison would hide a drift.
    expect(sets.light["--primary-ink"]).toBe(sets.light["--primary"]);
  });

  it("[unit] dark --primary-ink is measurably brighter than dark --primary — a real fix, not just a new name", () => {
    const ink = parseOklch(sets.dark["--primary-ink"]) as { L: number };
    const primary = parseOklch(sets.dark["--primary"]) as { L: number };
    expect(ink.L).toBeGreaterThan(primary.L);
  });
});

describe("CAM-546 · the reported axe violation is closed (AC-1)", () => {
  it("[unit] reproduces axe's foreground hex — dark --primary really is #257771", () => {
    // The evidence chain: if this hex did not match the axe report, we would be
    // fixing a different pair than the one that failed.
    expect(toHex(oklchToSrgb(parseOklch(sets.dark["--primary"])))).toBe("#257771");
  });

  it("[unit] reproduces axe's background hex — #090b0c is --background, not --card", () => {
    expect(toHex(resolveSurface(sets.dark, "--background"))).toBe("#090b0c");
  });

  it("[unit] the failing pair failed, and the replacement passes, on that exact surface", () => {
    const bg = resolveSurface(sets.dark, "--background");
    const before = contrastRatio(oklchToSrgb(parseOklch(sets.dark["--primary"])), bg);
    const after = contrastRatio(oklchToSrgb(parseOklch(sets.dark["--primary-ink"])), bg);

    expect(before).toBeLessThan(BODY_FLOOR); // axe measured 3.71 (8-bit rounding)
    expect(after).toBeGreaterThanOrEqual(BODY_FLOOR);
    expect(after).toBeGreaterThan(before);
  });
});

describe("CAM-546 · --primary-ink clears 4.5:1 on EVERY surface it sits on, BOTH themes (AC-1..AC-4)", () => {
  const inkPairs = ENFORCED_PAIRS.filter((p: { fg: string }) => p.fg === "--primary-ink");

  it("[unit] the registry actually covers the surfaces the migration created", () => {
    // A guard that measures zero rows is green and worthless.
    expect(inkPairs.length).toBeGreaterThanOrEqual(8);
    const backdrops = inkPairs.map((p: { bg: string }) => p.bg);
    for (const surface of ["--background", "--card", "--popover", "--ai-surface"]) {
      expect(backdrops, `${surface} is a real surface for this token`).toContain(surface);
    }
    // EC-2: the tinted surfaces are the worst case and must be registered.
    expect(inkPairs.filter((p: { overlay?: unknown }) => p.overlay).length).toBeGreaterThanOrEqual(4);
  });

  it("[unit] every registered --primary-ink pair is judged at the 4.5:1 BODY floor (BR-1)", () => {
    // The migrated call sites include 12px copy, so none of them may be excused
    // by the large-text exception.
    for (const pair of inkPairs) expect(pair.floor).toBe(BODY_FLOOR);
  });

  it.each([...themes])("[unit] %s: every --primary-ink pair clears its floor", (theme) => {
    const rows = measurePairs(inkPairs, { [theme]: sets[theme] }) as Array<{
      ratio: number; floor: number; context: string;
    }>;
    expect(rows.length).toBe(inkPairs.length);
    for (const row of rows) {
      expect(row.ratio, `${theme}: ${row.context} measured ${row.ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(row.floor);
    }
  });

  it("[unit] the 10% tint really is the worst surface, and it still passes (EC-2)", () => {
    // If a tint were NOT worse than the bare surface, the overlay feature would
    // be decorative. This asserts the premise the registry is built on.
    const tinted = inkPairs.find(
      (p: { bg: string; overlay?: { alpha: number } }) => p.bg === "--card" && p.overlay?.alpha === 0.1
    )!;
    const bare = inkPairs.find((p: { bg: string; overlay?: unknown }) => p.bg === "--card" && !p.overlay)!;

    for (const theme of themes) {
      const ink = sets[theme]["--primary-ink"];
      const tintedBg = resolvePairBackground(sets[theme], tinted);
      const bareBg = resolvePairBackground(sets[theme], bare);
      const onTint = contrastRatio(oklchToSrgb(parseOklch(ink)), tintedBg);
      const onBare = contrastRatio(oklchToSrgb(parseOklch(ink)), bareBg);

      expect(onTint, `${theme}: tint must be the harder surface`).toBeLessThan(onBare);
      expect(onTint, `${theme}: and it must still clear the floor`).toBeGreaterThanOrEqual(BODY_FLOOR);
    }
  });
});

describe("CAM-546 · --primary is UNCHANGED — CAM-537's window must not be undone (AC-6, BR-4)", () => {
  it("[unit] the dark --primary declaration is still CAM-537's exact value", () => {
    expect(sets.dark["--primary"]).toBe("oklch(0.520 0.078 188.216)");
    expect(sets.light["--primary"]).toBe("oklch(0.511 0.096 186.391)");
  });

  it("[unit] --accent still tracks --primary exactly in both themes (CAM-537 BR-3)", () => {
    for (const theme of themes) expect(sets[theme]["--accent"]).toBe(sets[theme]["--primary"]);
  });

  /**
   * REGRESSION PIN (see the file header): these are CAM-537's published ratios.
   * Recomputed from the live stylesheet, then compared to the literal numbers
   * that story shipped — so any drift in either the token or the engine fails
   * here rather than silently re-opening a closed defect.
   */
  it.each([
    ["--primary", "--card", "light", 5.39],
    ["--primary", "--card", "dark", 3.28],
    ["--primary", "--background", "light", 5.39],
    ["--primary", "--background", "dark", 3.73],
    ["--accent", "--card", "light", 5.39],
    ["--accent", "--card", "dark", 3.28],
  ])("[unit] %s fill on %s (%s) is still CAM-537's %s:1", (fg, bg, theme, expected) => {
    const tk = sets[theme as "light" | "dark"];
    const surface = resolveSurface(tk, bg as string);
    const ratio = contrastRatio(resolveOver(tk, fg as string, surface), surface);
    expect(+ratio.toFixed(2)).toBe(expected);
    expect(ratio).toBeGreaterThanOrEqual(NON_TEXT_FLOOR); // the floor that governs a state fill
  });

  it.each([
    ["light", 5.17],
    ["dark", 5.08],
  ])("[unit] the near-white label ON the primary fill is still %s's %s:1", (theme, expected) => {
    const tk = sets[theme as "light" | "dark"];
    const fill = resolveSurface(tk, "--primary");
    const ratio = contrastRatio(resolveOver(tk, "--primary-foreground", fill), fill);
    expect(+ratio.toFixed(2)).toBe(expected);
    expect(ratio).toBeGreaterThanOrEqual(BODY_FLOOR);
  });

  it("[unit] the one-token impossibility still holds — this is why two tokens exist (BR-4)", () => {
    // Re-derived, not quoted: scan lightness at 0.001 and show the two windows
    // do not intersect. If they ever did, this story's second token would be
    // dead weight and should be removed rather than maintained.
    const { C, h } = parseOklch(sets.dark["--primary"]) as { C: number; h: number };
    const card = resolveSurface(sets.dark, "--card");
    const label = oklchToSrgb(parseOklch(sets.dark["--primary-foreground"]));

    let minLforText = Infinity;
    let maxLforLabel = -Infinity;
    for (let L = 0.4; L <= 0.9; L += 0.001) {
      const rgb = oklchToSrgb({ L, C, h });
      if (contrastRatio(rgb, card) >= BODY_FLOOR) minLforText = Math.min(minLforText, L);
      if (contrastRatio(label, rgb) >= BODY_FLOOR) maxLforLabel = Math.max(maxLforLabel, L);
    }
    expect(minLforText).toBeGreaterThan(maxLforLabel); // disjoint ⇒ no single value works
  });

  it("[unit] icons left on --primary still clear their own 3:1 non-text floor (AC-5, EC-3)", () => {
    // The justification for NOT migrating 22 icon call sites. Measured on the
    // worst icon surface (a 10% primary tint over --card), both themes.
    const tintedCard = { fg: "--primary", bg: "--card", overlay: { token: "--primary", alpha: 0.1 } };
    for (const theme of themes) {
      const surface = resolvePairBackground(sets[theme], tintedCard);
      const ratio = contrastRatio(resolveOver(sets[theme], "--primary", surface), surface);
      expect(ratio, `${theme}: icon on a 10% tint measured ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
    }
  });
});

describe("CAM-546 · the alpha modifier was dropped, not re-tinted (BR-5)", () => {
  it("[unit] an /80 alpha on this token would fail in LIGHT mode — so no call site may use one", () => {
    // The permission tooltip shipped `text-primary/80`, which failed in BOTH
    // themes (3.70 light / 2.56 dark). Swapping the token alone would have left
    // the light failure in place, so the alpha itself had to go.
    const card = resolveSurface(sets.light, "--card");
    const ink = oklchToSrgb(parseOklch(sets.light["--primary-ink"]));
    const at80 = contrastRatio(compositeOver(ink, 0.8, card), card);

    expect(at80).toBeLessThan(BODY_FLOOR); // proves dropping the alpha was necessary
    expect(contrastRatio(ink, card)).toBeGreaterThanOrEqual(BODY_FLOOR); // and sufficient
  });

  it("[structural] no source file applies an opacity modifier to text-primary-ink", () => {
    const hits = sourceFiles().filter((f) => read(f).includes("text-primary-ink/"));
    expect(hits).toEqual([]);
  });
});

/** Every .tsx under app/ and components/ — the surface this story migrated. */
function sourceFiles(): string[] {
  const out = execFileSync(
    "git",
    ["ls-files", "app/**/*.tsx", "components/**/*.tsx"],
    { cwd: ROOT, encoding: "utf8" }
  );
  return out.split("\n").filter(Boolean);
}

describe("CAM-546 · the call sites really moved (AC-1..AC-3)", () => {
  it("[structural] the axe-flagged link variants use the text token", () => {
    expect(read("components/ui/button.tsx")).toContain(
      'link: "text-primary-ink underline-offset-4 hover:underline",'
    );
    expect(read("components/ui/badge.tsx")).toContain(
      'link: "text-primary-ink underline-offset-4 hover:underline",'
    );
  });

  it.each([
    "app/bookings/page.tsx",
    "app/bookings/[id]/BookingDetailClient.tsx",
    "app/bookings/[id]/confirmation/BookingConfirmationClient.tsx",
    "app/dashboard/layout-client.tsx",
    "app/dashboard/page.tsx",
    "app/dashboard/settings/page.tsx",
    "app/dashboard/bookings/page.tsx",
    "app/dashboard/campsites/page.tsx",
    "app/login/page.tsx",
    "components/LoginModal.tsx",
    "components/RegisterModal.tsx",
    "components/ActiveFilters.tsx",
    "components/CampgroundForm.tsx",
    "components/availability-calendar.tsx",
    "components/settings/TeamManagement.tsx",
    "components/ui/filter-chip.tsx",
    "components/ui/permission-tooltip.tsx",
    // CAM-547 removed AiChatCampCard.tsx's ONLY text-primary-ink usage (the
    // redundant "ดูรายละเอียด" line + ChevronRight, per that story's AC-3 —
    // the whole card is already a button, so the affordance line was
    // dropped; the SAME copy stays wired into the card's own aria-label,
    // never removed). The card no longer renders any teal link-style text
    // at all, so it is intentionally removed from this list rather than a
    // drift this guard should keep catching.
    "components/ui/button.tsx",
    "components/ui/badge.tsx",
  ])("[structural] %s renders teal words through the text token", (file) => {
    expect(read(file)).toContain("text-primary-ink");
  });

  it("[structural] the AI card's price hero is untouched — it keeps CAM-444's token", () => {
    // Guards against a careless sweep pulling the price onto the new token and
    // silently re-opening CAM-444's decision.
    expect(read("components/ai-chat/AiChatCampCard.tsx")).toContain("text-ai-price");
  });
});

describe("CAM-546 · the guard has teeth in BOTH directions (AC-7, BR-6)", () => {
  it("[integration] is QUIET on the real tree — backlog 0, blocking", () => {
    const { code, out } = runGuard();
    expect(code).toBe(0);
    expect(out).toContain("0 fail");
    expect(out).toContain("every enforced pair clears its floor");
  });

  it("[integration] FIRES when --primary-ink is reverted to --primary's value", () => {
    // The exact regression this story exists to prevent: someone "simplifying"
    // the two tokens back into one.
    const file = withCss((css) =>
      css.replace(/--primary-ink: oklch\(0\.760 0\.120 184\);/, "--primary-ink: oklch(0.520 0.078 188.216);")
    );
    const { code, out } = runGuard(file);
    expect(code).toBe(1);
    expect(out).toContain("--primary-ink on --card");
    expect(out).toContain("below the contrast floor");
  });

  it("[integration] FIRES on a value that passes the bare surfaces but fails the 10% tint", () => {
    // Proves the `overlay` rows are load-bearing rather than decorative:
    // L 0.600 measures 5.41:1 on --background and 4.76:1 on --card (both pass)
    // but 4.36:1 on the tint. Without the overlay rows this would ship green.
    const file = withCss((css) =>
      css.replace(/--primary-ink: oklch\(0\.760 0\.120 184\);/, "--primary-ink: oklch(0.600 0.120 184);")
    );
    const { code, out } = runGuard(file);
    expect(code).toBe(1);
    expect(out).toContain("--primary/10 over --card");
  });

  it("[integration] does NOT fire for the wrong reason — the bare-surface rows stay green in that run", () => {
    const file = withCss((css) =>
      css.replace(/--primary-ink: oklch\(0\.760 0\.120 184\);/, "--primary-ink: oklch(0.600 0.120 184);")
    );
    const { out } = runGuard(file);
    // If this line were also failing, the previous test would prove nothing
    // about the overlay row specifically.
    expect(out).not.toMatch(/FAIL.*--primary-ink on --background —/);
  });

  it("[unit] the retired deferral is gone: --primary is no longer excused as text", () => {
    const stillDeferred = (DEFERRED_PAIRS as Array<{ fg: string; kind: string }>).some(
      (p) => p.fg === "--primary" && p.kind === "text"
    );
    expect(stillDeferred).toBe(false);
  });

  it("[unit] every remaining DEFERRED row still carries a written reason", () => {
    for (const row of DEFERRED_PAIRS as Array<{ reason?: string }>) {
      expect(row.reason?.length ?? 0).toBeGreaterThan(40);
    }
  });
});

describe("CAM-546 · token sync — DESIGN.md mirrors globals.css", () => {
  it("[unit] DESIGN.md records the new token's dark value verbatim", () => {
    // A token table that drifts from the stylesheet is how DESIGN.md starts
    // lying. Compare the RAW declaration; `0.760` reparses as `0.76`.
    const declared = sets.dark["--primary-ink"].replace(/^oklch\(|\)$/g, "");
    expect(read("DESIGN.md")).toContain(declared);
  });

  it("[unit] DESIGN.md names the utility so an agent can find it", () => {
    expect(read("DESIGN.md")).toContain("`text-primary-ink`");
  });
});
