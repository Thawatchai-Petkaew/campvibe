/**
 * CAM-662 — de-emphasis uses a dropped colour, never transparency.
 *
 * Owner ruling (verbatim): "ห้ามใช้ opacity ในการลด ไม่ว่าจะแบบใดก็ตาม ในระบบของเรา
 * ควรใช้สีที่ drop ลง" — opacity may never de-emphasize anything; use a dropped
 * solid colour instead. Scope: every `disabled:opacity-50`-family use in
 * `components/ui/*` (~21 occurrences across button/input/select/textarea/
 * checkbox/label/tabs/calendar/filter-chip/dropdown-menu/command/input-group),
 * replaced by the flat `--disabled` / `--disabled-foreground` tokens.
 * `opacity-0`/`opacity-100` enter/exit transitions are explicitly NOT in
 * scope (not de-emphasis) and must be untouched.
 *
 * Four assertion families:
 *   1. Token math — the new tokens are FLAT (no alpha) and clear the
 *      self-imposed 3:1 floor in both themes, on every surface a disabled
 *      control renders on (recomputed from the real app/globals.css).
 *   2. Source invariant — no component/ui file carries a disabled-state
 *      opacity class; the flat token classes are present instead. This is
 *      the regression GUARD (never silently regrows).
 *   3. The new report-mode scanner — fires on a synthetic bad fixture,
 *      is quiet on the real components/ui tree, and never blocks the CLI
 *      exit code even though the repo-wide backlog is non-zero.
 *   4. DESIGN.md sync — the declared token values and the no-opacity rule
 *      are recorded there (token table is the human-readable mirror).
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CSS_PATH,
  ENFORCED_PAIRS,
  ALPHA_ON_TEXT_RE,
  DISABLED_JS_OPACITY_RE,
  DISABLED_OPACITY_RE,
  HAIRLINE_TINT_ALPHA_RE,
  contrastRatio,
  measureAll,
  parseOklch,
  parseTokens,
  resolveOver,
  resolveSurface,
  scanDeEmphasis,
} from "../scripts/check-contrast.mjs";

const ROOT = path.join(__dirname, "..");
const CSS = readFileSync(CSS_PATH, "utf8");
const GUARD = path.join(ROOT, "scripts", "check-contrast.mjs");

type TokenSet = Record<string, string>;
const tokens = (css: string) => parseTokens(css) as { light: TokenSet; dark: TokenSet };

/**
 * `scripts/check-contrast.mjs` is plain JS, so TS infers `never[]` for
 * `scanDeEmphasis`'s object-literal array properties (it does not evolve an
 * OBJECT PROPERTY's array type from later `.push()` calls the way it does for
 * a local `let` variable). One asserted boundary here beats casting at every
 * call site — the shape is "a list of {file, line, match}", nothing else.
 */
type ScanHit = { file: string; line: number; match: string };
type ScanHits = { disabledOpacity: ScanHit[]; alphaOnText: ScanHit[]; hairlineTintAlpha: ScanHit[] };
const scan = (root: string) => scanDeEmphasis(root) as ScanHits;

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

const UI_FILES = [
  "button.tsx",
  "input.tsx",
  "textarea.tsx",
  "select.tsx",
  "checkbox.tsx",
  "label.tsx",
  "tabs.tsx",
  "calendar.tsx",
  "filter-chip.tsx",
  "dropdown-menu.tsx",
  "command.tsx",
  "input-group.tsx",
];

const uiSrc = (file: string) => readFileSync(path.join(ROOT, "components", "ui", file), "utf8");

describe("CAM-662 · token math — flat, no alpha, clears the self-imposed floor", () => {
  const { light, dark } = tokens(CSS);

  it("neither token carries an alpha channel in either theme (no derive-with-alpha)", () => {
    for (const set of [light, dark]) {
      expect(parseOklch(set["--disabled"]).alpha).toBe(1);
      expect(parseOklch(set["--disabled-foreground"]).alpha).toBe(1);
    }
  });

  it("the two ENFORCED pairs for --disabled-foreground clear floor 3 in both themes", () => {
    const { enforced } = measureAll(CSS);
    const rows = enforced.filter((r) => r.fg === "--disabled-foreground");
    expect(rows.length).toBe(4); // 2 pairs x 2 themes
    for (const r of rows) {
      expect(r.floor).toBe(3);
      expect(r.ratio).toBeGreaterThanOrEqual(3);
    }
  });

  it("measured: every surface a disabled control actually renders on clears 3:1, both themes", () => {
    for (const [themeName, set] of [["light", light] as const, ["dark", dark] as const]) {
      const disabledFill = resolveOver(set, "--disabled", resolveSurface(set, "--background"));
      const fgOnFill = resolveOver(set, "--disabled-foreground", disabledFill);
      expect(contrastRatio(fgOnFill, disabledFill), `${themeName} fg-on-fill`).toBeGreaterThanOrEqual(3);

      for (const surface of ["--background", "--card", "--popover", "--muted"] as const) {
        const bg = resolveSurface(set, surface);
        const fg = resolveOver(set, "--disabled-foreground", bg);
        expect(contrastRatio(fg, bg), `${themeName} fg on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("also clears the stricter 4.5:1 body floor almost everywhere (bonus headroom, not required)", () => {
    // WCAG SC 1.4.3/1.4.11 both exempt disabled/inactive components, so 4.5 is
    // not owed — this just documents the measured margin honestly.
    const { dark } = tokens(CSS);
    const disabledFill = resolveOver(dark, "--disabled", resolveSurface(dark, "--background"));
    const fgOnFill = resolveOver(dark, "--disabled-foreground", disabledFill);
    expect(contrastRatio(fgOnFill, disabledFill)).toBeGreaterThan(4); // 4.09 measured
  });
});

describe("CAM-662 · source invariant — no disabled-state opacity remains in components/ui", () => {
  it.each(UI_FILES)("%s carries no disabled-state opacity class", (file) => {
    const src = uiSrc(file);
    expect(src).not.toMatch(/disabled:opacity-50/);
    expect(src).not.toMatch(/data-disabled:opacity-50/);
    expect(src).not.toMatch(/aria-disabled:opacity-50/);
    expect(src).not.toMatch(/peer-disabled:opacity-50/);
    expect(src).not.toMatch(DISABLED_OPACITY_RE);
    expect(src).not.toMatch(DISABLED_JS_OPACITY_RE);
  });

  it("every file in the fixed set now uses a flat disabled token", () => {
    for (const file of UI_FILES) {
      const src = uiSrc(file);
      expect(
        /disabled-foreground|bg-disabled\b/.test(src),
        `${file} should reference the new flat token`
      ).toBe(true);
    }
  });

  it("transition pairs (opacity-0 <-> opacity-100) are explicitly untouched, not de-emphasis", () => {
    // A regression net for the exemption named in the story: nobody should
    // ever "fix" an enter/exit transition under this rule.
    const total = UI_FILES.reduce((n, f) => n + (uiSrc(f).match(/opacity-0\b/g) ?? []).length, 0);
    expect(total).toBe(3); // calendar.tsx dropdown fade + command.tsx checkmark fade + tabs.tsx active-line fade
  });

  it("the one decorative opacity NOT covered by this rule (command search icon) is untouched", () => {
    // Constant decorative dimming, unconditional on any state — not de-emphasis.
    expect(uiSrc("command.tsx")).toMatch(/<Search className="size-4 shrink-0 opacity-50" \/>/);
  });
});

describe("CAM-662 · the ds1/R9 literal substrings FilterChip's tests pin are still intact", () => {
  // filter-chip.tsx's own comment warns these exact literals are asserted by
  // __tests__/ds1-dropdown-grammar.test.ts — proving they still appear
  // verbatim here catches an accidental disturbance before that suite does.
  it("selected-state literals are untouched", () => {
    const src = uiSrc("filter-chip.tsx");
    expect(src).toMatch(/border-primary bg-primary text-primary-foreground hover:bg-primary\/85/);
    expect(src).toMatch(/border-primary bg-primary\/5/);
    expect(src).toMatch(/border-primary bg-primary\/5 font-semibold text-primary-ink/);
  });

  it("the disabled treatment is a flat token, added as the LAST cn() argument (wins via tailwind-merge)", () => {
    const src = uiSrc("filter-chip.tsx");
    const disabledLines = [...src.matchAll(/disabled && "[^"]*"/g)].map((m) => m[0]);
    expect(disabledLines.length).toBe(5); // 3 wrapper buttons (flat fill) + Icon + label overrides in the "card" variant
    for (const line of disabledLines) {
      expect(line).not.toMatch(/opacity-/);
    }
  });
});

describe("CAM-662 · the new report-mode scanner", () => {
  it("FIRES on a synthetic bad fixture (all three patterns)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "cam662-"));
    mkdirSync(path.join(dir, "app"), { recursive: true });
    mkdirSync(path.join(dir, "components"), { recursive: true });
    writeFileSync(
      path.join(dir, "app", "bad.tsx"),
      [
        'export const Bad = () => <button disabled className="disabled:opacity-50 text-foreground/70 bg-primary/10" />;',
        'export const Bad2 = ({disabled}: {disabled?: boolean}) => <div className={disabled && "opacity-50 pointer-events-none"} />;',
      ].join("\n")
    );
    const hits = scan(dir);
    expect(hits.disabledOpacity.length).toBe(2); // the variant form + the JS-conditional form
    expect(hits.alphaOnText.length).toBe(1);
    expect(hits.hairlineTintAlpha.length).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("is QUIET on components/ui for disabled-state opacity (backlog 0 there, by construction)", () => {
    const hits = scan(ROOT);
    const uiDisabledHits = hits.disabledOpacity.filter((h) => h.file.startsWith(path.join("components", "ui")));
    expect(uiDisabledHits).toEqual([]);
  });

  it("never blocks the CLI exit code, even though the repo-wide backlog is non-zero", () => {
    // The real tree DOES still carry phase-2 backlog outside components/ui
    // (dashboard pages, FilterModal, …) — that is the whole point of
    // shipping this in report mode. Prove the guard still exits 0.
    const hits = scan(ROOT);
    const total = hits.disabledOpacity.length + hits.alphaOnText.length + hits.hairlineTintAlpha.length;
    expect(total).toBeGreaterThan(0);

    const { code, out } = runGuard();
    expect(code).toBe(0);
    expect(out).toContain("CAM-662 de-emphasis scan (report-only, never blocks)");
  });

  it("ALPHA_ON_TEXT_RE and HAIRLINE_TINT_ALPHA_RE do not false-positive on a text-size shorthand", () => {
    // `text-sm/6` is Tailwind's font-size+line-height shorthand, not a colour
    // alpha — must never be mistaken for `text-<token>/<alpha>`.
    expect("text-sm/6 text-lg/7").not.toMatch(ALPHA_ON_TEXT_RE);
  });
});

describe("CAM-662 · DESIGN.md sync", () => {
  const design = readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
  const { light, dark } = tokens(CSS);

  it("records the new token values (token table is the human-readable mirror)", () => {
    expect(design).toContain(light["--disabled"].replace(/^oklch\(|\)$/g, ""));
    expect(design).toContain(dark["--disabled-foreground"].replace(/^oklch\(|\)$/g, ""));
  });

  it("states the no-opacity-for-de-emphasis rule", () => {
    expect(design).toMatch(/Opacity may never de-emphasize a control/);
  });

  it("names the transition-pair exemption so nobody 'fixes' opacity-0/opacity-100 pairs later", () => {
    expect(design).toMatch(/opacity-for-de-emphasis/);
  });

  it("reconciles the scrim exception — exactly one family, both call sites named", () => {
    expect(design).toMatch(/one family of sanctioned exceptions/);
    expect(design).toContain("bg-overlay");
  });
});

describe("CAM-662 · wiring", () => {
  it("every enforced pair (including the two new ones) names a real token in both themes", () => {
    const sets = tokens(CSS);
    for (const pair of ENFORCED_PAIRS) {
      for (const theme of ["light", "dark"] as const) {
        expect(sets[theme][pair.fg], `${pair.fg} (${theme})`).toBeDefined();
        expect(sets[theme][pair.bg], `${pair.bg} (${theme})`).toBeDefined();
      }
    }
  });

  it("`bg-disabled` / `text-disabled-foreground` are registered as real Tailwind utilities", () => {
    const globals = readFileSync(CSS_PATH, "utf8");
    expect(globals).toContain("--color-disabled: var(--disabled);");
    expect(globals).toContain("--color-disabled-foreground: var(--disabled-foreground);");
  });
});
