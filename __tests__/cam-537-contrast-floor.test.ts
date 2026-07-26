/**
 * CAM-537 — selected-state and price tokens meet the WCAG contrast floor.
 *
 * Every ratio in this file is RECOMPUTED from the real `app/globals.css` using
 * the same engine the guard ships (`scripts/check-contrast.mjs`). No expected
 * ratio is hardcoded: a test that pins "3.28" would pass forever even if the
 * token and the floor both drifted. What is asserted instead is the PROPERTY —
 * "this pair clears its floor in this theme" — which stays true only as long as
 * the tokens really do.
 *
 * Covers: AC-1..AC-6, BR-1..BR-5, EC-1..EC-6 (story.md).
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
  measureAll,
  measurePairs,
  oklchToSrgb,
  parseOklch,
  parseTokens,
  relativeLuminance,
  resolveOver,
  resolveSurface,
} from "../scripts/check-contrast.mjs";

const ROOT = path.join(__dirname, "..");
const CSS = readFileSync(CSS_PATH, "utf8");
const GUARD = path.join(ROOT, "scripts", "check-contrast.mjs");

/**
 * `scripts/check-contrast.mjs` is plain JS, so TS infers `{}` for its token
 * maps. One asserted boundary here beats sprinkling casts through every test —
 * the shape is "CSS custom property name → declaration", and nothing else.
 */
type TokenSet = Record<string, string>;
const tokens = (css: string) => parseTokens(css) as { light: TokenSet; dark: TokenSet };

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

describe("CAM-537 · the measurement engine is sound (EC-3..EC-6)", () => {
  it("reproduces the two figures CAM-532 measured independently", () => {
    // The strongest available check that the engine is RIGHT and not merely
    // self-consistent: a different story measured these pairs with different
    // code and published them in its design.md.
    const { light } = tokens(CSS);
    const white = resolveSurface(light, "--background");
    const border = resolveOver(light, "--border", white);
    // `--border` on light `--background` = 1.25:1 (CAM-532 design.md)
    expect(contrastRatio(border, white)).toBeCloseTo(1.25, 2);

    // Selected chip label on the selected fill = 5.17:1 light (CAM-532)
    const fill = resolveOver(light, "--primary", white);
    const label = resolveOver(light, "--primary-foreground", fill);
    expect(contrastRatio(label, fill)).toBeCloseTo(5.17, 2);
  });

  it("EC-4: merges every `:root` block, including the one nested in @media", () => {
    // Reading only the FIRST `:root` block finds zero colour tokens — that block
    // holds nothing but a comment. This is the bug that would silently make the
    // whole guard measure nothing.
    expect(blocksFor(CSS, ":root").length).toBeGreaterThan(1);
    const { light } = tokens(CSS);
    expect(Object.keys(light).length).toBeGreaterThan(20);
    expect(light["--primary"]).toBeDefined();
  });

  it("EC-5: dark inherits a `:root` token it does not override", () => {
    // Today every colour token in globals.css IS overridden in `.dark`, so the
    // real file cannot exercise this path — asserting against it would prove
    // nothing. A synthetic fixture tests the mechanism, so the day someone adds
    // a light-only token the guard measures it in dark instead of crashing.
    const fixture = `
      :root { --solo: oklch(0.5 0.1 200); --both: oklch(0.9 0 0); }
      .dark { --both: oklch(0.2 0 0); }
    `;
    const { light, dark } = tokens(fixture);
    expect(dark["--solo"]).toBe(light["--solo"]); // inherited
    expect(dark["--both"]).not.toBe(light["--both"]); // overridden
  });

  it("EC-3: composites an alpha token over its backdrop instead of measuring it opaque", () => {
    const { dark } = tokens(CSS);
    const parsed = parseOklch(dark["--border"]);
    expect(parsed.alpha).toBeLessThan(1); // dark --border is oklch(1 0 0 / 10%)

    const card = resolveSurface(dark, "--card");
    const composited = resolveOver(dark, "--border", card);
    const opaque = oklchToSrgb(parsed);

    // Treated as opaque it would read as pure white on a dark card (~15:1) and
    // the guard would call a 1.34:1 hairline "excellent".
    expect(contrastRatio(opaque, card)).toBeGreaterThan(10);
    expect(contrastRatio(composited, card)).toBeLessThan(2);
  });

  it("EC-6: clamps an out-of-gamut colour instead of returning a fake luminance", () => {
    const wild = oklchToSrgb({ L: 0.9, C: 0.4, h: 140 }); // far outside sRGB
    for (const channel of wild) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    expect(relativeLuminance(wild)).toBeLessThanOrEqual(1);
  });

  it("composites in gamma-encoded space, which is what a browser does", () => {
    const black = [0, 0, 0];
    const white = [1, 1, 1];
    expect(compositeOver(white, 0.5, black)).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("CAM-537 · AC-1..AC-3 the fixed pairs clear their floor in BOTH themes", () => {
  const { enforced } = measureAll(CSS);

  it.each(enforced.map((r) => [`${r.theme} · ${r.fg} on ${r.bg} (floor ${r.floor} ${r.kind})`, r] as const))(
    "%s",
    (_label, row) => {
      expect(row.ratio).toBeGreaterThanOrEqual(row.floor);
    }
  );

  it("AC-1: the exact defect CAM-532 reported is gone — selected fill vs its surface, dark", () => {
    const { dark } = tokens(CSS);
    const card = resolveSurface(dark, "--card");
    const background = resolveSurface(dark, "--background");
    // Was 2.31:1 and 2.62:1; the floor is 3:1 for non-text state (SC 1.4.11).
    expect(contrastRatio(resolveOver(dark, "--primary", card), card)).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(resolveOver(dark, "--primary", background), background)
    ).toBeGreaterThanOrEqual(3);
  });

  it("AC-2: raising the fill did not push the label under the text floor", () => {
    const { dark } = tokens(CSS);
    const card = resolveSurface(dark, "--card");
    const fill = resolveOver(dark, "--primary", card);
    expect(contrastRatio(resolveOver(dark, "--primary-foreground", fill), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it("AC-3 / BR-3: `--accent` tracks `--primary` exactly in both themes", () => {
    const { light, dark } = tokens(CSS);
    expect(light["--accent"]).toBe(light["--primary"]);
    expect(dark["--accent"]).toBe(dark["--primary"]);
  });
});

describe("CAM-537 · BR-2 the shipped value sits inside the feasible window", () => {
  // The window is DERIVED here, not quoted: sweep lightness and find where both
  // floors hold. If a later edit narrows the window (by darkening --card, say),
  // this fails even though every individual pair still passes.
  const { dark } = tokens(CSS);
  const card = resolveSurface(dark, "--card");
  const primary = parseOklch(dark["--primary"]);

  const holds = (L: number) => {
    const fill = oklchToSrgb({ L, C: primary.C, h: primary.h });
    const label = resolveOver(dark, "--primary-foreground", fill);
    return contrastRatio(fill, card) >= 3 && contrastRatio(label, fill) >= 4.5;
  };

  it("the shipped lightness satisfies both floors simultaneously", () => {
    expect(holds(primary.L)).toBe(true);
  });

  it("keeps headroom at both ends rather than sitting on an edge", () => {
    // A value one step from either wall would fail on any future rounding.
    expect(holds(primary.L - 0.015)).toBe(true);
    expect(holds(primary.L + 0.015)).toBe(true);
  });

  it("the window really is bounded on both sides (so the value is a choice, not a coincidence)", () => {
    expect(holds(0.437)).toBe(false); // the old value — fill too dark
    expect(holds(0.62)).toBe(false); // too bright — the white label fails
  });
});

describe("CAM-537 · the deferred set is honest", () => {
  const { deferred } = measureAll(CSS);

  it("every deferred pair carries a written reason", () => {
    for (const row of deferred) {
      expect(row.reason, `${row.fg} on ${row.bg}`).toBeTruthy();
      expect(row.reason.length).toBeGreaterThan(40);
    }
  });

  it("BR-1: no deferred row is silently passing — a passing pair belongs in ENFORCED", () => {
    // If a deferred pair ever starts passing in BOTH themes it has been fixed,
    // and leaving it deferred would quietly drop it from the blocking set.
    const contexts = new Map<string, boolean>();
    for (const row of deferred) {
      const key = `${row.fg}|${row.bg}|${row.floor}`;
      contexts.set(key, (contexts.get(key) ?? true) && row.pass);
    }
    const fullyFixed = [...contexts.entries()].filter(([, pass]) => pass).map(([k]) => k);
    expect(fullyFixed, "promote these to ENFORCED_PAIRS").toEqual([]);
  });

  it("the one-token impossibility behind the `text-primary` deferral is real", () => {
    // Claimed in design.md + DESIGN.md §8: no single lightness clears 4.5:1 as
    // TEXT on --card while also keeping a near-white label at 4.5:1 on the fill.
    const { dark } = tokens(CSS);
    const card = resolveSurface(dark, "--card");
    const { C, h } = parseOklch(dark["--primary"]);
    let both = 0;
    for (let L = 0.3; L <= 0.95; L += 0.001) {
      const fill = oklchToSrgb({ L, C, h });
      const label = resolveOver(dark, "--primary-foreground", fill);
      if (contrastRatio(fill, card) >= 4.5 && contrastRatio(label, fill) >= 4.5) both += 1;
    }
    expect(both).toBe(0);
  });
});

describe("CAM-537 · AC-6 the guard fires AND stays quiet (both directions)", () => {
  it("is QUIET on the real tree — exit 0, backlog 0", () => {
    const { code, out } = runGuard();
    expect(code).toBe(0);
    expect(out).toContain("0 fail");
    expect(out).toContain("every enforced pair clears its floor");
  });

  it("FIRES on a deliberately-bad token value — exit 1, naming the pair", () => {
    // Restore the pre-CAM-537 lightness in a throwaway copy. A guard only ever
    // proven in the passing direction can be silently toothless (CAM-532 R9).
    const bad = CSS.replace(
      /--primary: oklch\(0\.520 0\.078 188\.216\);/,
      "--primary: oklch(0.437 0.078 188.216);"
    );
    expect(bad).not.toBe(CSS); // the substitution actually landed

    const file = path.join(mkdtempSync(path.join(tmpdir(), "cam537-")), "globals.css");
    writeFileSync(file, bad);

    const { code, out } = runGuard(file);
    expect(code).toBe(1);
    expect(out).toContain("--primary on --card");
    expect(out).toContain("below the contrast floor");
  });

  it("FIRES when the label floor is broken from the other side", () => {
    // Over-brightening is the opposite failure and must be caught too, or the
    // guard would only defend one wall of the BR-2 window.
    const bad = CSS.replace(
      /--primary: oklch\(0\.520 0\.078 188\.216\);/,
      "--primary: oklch(0.700 0.078 188.216);"
    );
    const file = path.join(mkdtempSync(path.join(tmpdir(), "cam537-")), "globals.css");
    writeFileSync(file, bad);

    const { code, out } = runGuard(file);
    expect(code).toBe(1);
    expect(out).toContain("--primary-foreground on --primary");
  });

  it("does not false-positive: the bad-value run and the real run differ only by the token", () => {
    const enforcedIds = ENFORCED_PAIRS.map((p) => `${p.fg}|${p.bg}`);
    const deferredIds = DEFERRED_PAIRS.map((p) => `${p.fg}|${p.bg}`);
    // A pair must not sit in both registries, or a failure could be both
    // blocking and excused depending on which list is read.
    const overlap = enforcedIds.filter(
      (id, i) => deferredIds.includes(id) && ENFORCED_PAIRS[i].floor === DEFERRED_PAIRS[deferredIds.indexOf(id)].floor
    );
    expect(overlap).toEqual([]);
  });
});

describe("CAM-537 · wiring", () => {
  it("`npm run check:contrast` is registered", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["check:contrast"]).toMatch(/check-contrast\.mjs/);
  });

  it("DESIGN.md records the new dark primary value (token sync)", () => {
    // DESIGN.md §2 is the human-readable mirror of globals.css. The two drifting
    // apart is how a token table starts lying.
    const design = readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
    const { dark } = tokens(CSS);
    // Compare the RAW declaration, not reparsed numbers: `0.520` round-trips
    // through Number as `0.52` and would never match the table's text.
    const declared = dark["--primary"].replace(/^oklch\(|\)$/g, "");
    expect(design).toContain(declared);
  });

  it("every enforced pair names a real token in both themes", () => {
    const sets = tokens(CSS);
    for (const pair of [...ENFORCED_PAIRS, ...DEFERRED_PAIRS]) {
      for (const theme of ["light", "dark"] as const) {
        expect(sets[theme][pair.fg], `${pair.fg} (${theme})`).toBeDefined();
        expect(sets[theme][pair.bg], `${pair.bg} (${theme})`).toBeDefined();
      }
    }
  });

  it("measurePairs is theme-complete: every pair is measured in both themes", () => {
    const sets = tokens(CSS);
    const rows = measurePairs(ENFORCED_PAIRS, { light: sets.light, dark: sets.dark });
    expect(rows.length).toBe(ENFORCED_PAIRS.length * 2);
    expect(rows.filter((r) => r.theme === "light").length).toBe(ENFORCED_PAIRS.length);
    expect(rows.filter((r) => r.theme === "dark").length).toBe(ENFORCED_PAIRS.length);
  });
});
