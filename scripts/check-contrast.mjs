#!/usr/bin/env node
/**
 * check-contrast — CAM-537
 *
 * Numeric WCAG 2.1 contrast guard over the design tokens in `app/globals.css`.
 *
 * WHY THIS IS A SEPARATE SCRIPT FROM `check-palette.mjs`:
 * `check-palette` is a LEXICAL scanner — it walks ~200 source files hunting for
 * forbidden hardcoded-colour strings; its unit is a line of code. This is a
 * NUMERIC check over exactly ONE file; its unit is a (foreground, background,
 * floor) triple and it needs colour-space maths to say anything at all. Fusing
 * them would give one script two inputs, two failure vocabularies and one
 * ambiguous exit code.
 *
 * WHICH FLOOR APPLIES TO WHAT (WCAG 2.1 — do not mix these up):
 *   - body text ............................... 4.5:1  (SC 1.4.3)
 *   - large text (>=18.66px BOLD or >=24px) ... 3:1    (SC 1.4.3 exception)
 *   - a fill that identifies a STATE, and the
 *     boundary that identifies a control ...... 3:1    (SC 1.4.11 Non-text Contrast)
 *   - a DISABLED/inactive control's fill+text .. no floor is owed at all — SC
 *     1.4.3 and SC 1.4.11 BOTH explicitly exempt inactive components. The
 *     `--disabled`/`--disabled-foreground` rows (CAM-662) still carry a floor
 *     of 3 in this registry as a SELF-IMPOSED practical minimum (legibility),
 *     not a WCAG requirement — `kind` says so on those rows so this never
 *     reads as "the standard demands it".
 * A fill is never judged at the text floor, and body copy is never judged at the
 * non-text floor. Every pair below therefore declares its own `floor` + `kind`.
 *
 * ROLLOUT (per `.claude/rules/ops.md`: report-mode -> backlog 0 -> blocking):
 *   ENFORCED pairs block (exit 1). They ship blocking only because their
 *   measured backlog is 0. DEFERRED pairs are printed loudly and never block —
 *   each is a known failure whose fix is an owner-visible repaint or lives
 *   outside the token layer. See DESIGN.md section 8 item 11.
 *
 * Usage:  node scripts/check-contrast.mjs [--verbose]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CSS_PATH = path.join(ROOT, "app", "globals.css");

/* ── CSS token parsing ─────────────────────────────────────────────────────
   `:root` is declared in MORE THAN ONE block in globals.css (one of them is
   nested inside an @media rule, another holds only the /status HUD constant).
   A regex that grabs the first block finds no colour tokens at all, so we
   brace-match every block for the selector and merge them in source order,
   which is what the CSS cascade does. */

export function blocksFor(css, selector) {
  const out = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[\\s,}])${escaped}\\s*\\{`, "g");
  while (re.exec(css) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}

/** → { light, dark }; `.dark` inherits every `:root` token it does not override. */
export function parseTokens(css) {
  const grab = (blocks) => {
    const out = {};
    for (const block of blocks) {
      for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(oklch\([^)]*\))\s*;/g)) {
        out[m[1]] = m[2];
      }
    }
    return out;
  };
  const light = grab(blocksFor(css, ":root"));
  const dark = { ...light, ...grab(blocksFor(css, ".dark")) };
  return { light, dark };
}

export function parseOklch(value) {
  const m = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*(%?)\s*)?\)/
  );
  if (!m) throw new Error(`unparseable oklch value: ${value}`);
  let alpha = m[4] === undefined ? 1 : Number.parseFloat(m[4]);
  if (m[5] === "%") alpha /= 100;
  return { L: +m[1], C: +m[2], h: +m[3], alpha };
}

/* ── colour maths ──────────────────────────────────────────────────────────
   OKLCH -> OKLab -> linear sRGB (Björn Ottosson's matrices), then gamma-encode
   and CLAMP: an out-of-gamut value is clipped by the display, so clamping in
   encoded space is what a user actually sees. */

export function oklchToLinearRgb({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const encodeChannel = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
};
const decodeChannel = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

/** Gamma-encoded sRGB triple (0..1), gamut-clamped. */
export function oklchToSrgb(token) {
  return oklchToLinearRgb(token).map(encodeChannel);
}

/** Alpha-composite in gamma-encoded space — what a browser does for sRGB output. */
export function compositeOver(fg, alpha, backdrop) {
  return fg.map((c, i) => c * alpha + backdrop[i] * (1 - alpha));
}

export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(decodeChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(rgbA, rgbB) {
  const a = relativeLuminance(rgbA);
  const b = relativeLuminance(rgbB);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export function toHex(rgb) {
  return `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("")}`;
}

/* ── resolving a token against the surface it really sits on ───────────────
   A token declared with alpha (dark `--border` is `oklch(1 0 0 / 10%)`, and
   `--ai-surface` is translucent glass) is meaningless on its own: it must be
   composited over its backdrop before it can be measured. */

const PAGE = [1, 1, 1]; // the canvas under `--background`

/** Resolve a SURFACE token over the page-background chain. */
export function resolveSurface(tokens, name) {
  if (name === "--background") return resolveOver(tokens, "--background", PAGE);
  const background = resolveOver(tokens, "--background", PAGE);
  return resolveOver(tokens, name, background);
}

/** Resolve any token over an explicit backdrop, honouring its alpha. */
export function resolveOver(tokens, name, backdrop) {
  const raw = tokens[name];
  if (!raw) throw new Error(`token ${name} is not declared`);
  const token = parseOklch(raw);
  const rgb = oklchToSrgb(token);
  return token.alpha < 1 ? compositeOver(rgb, token.alpha, backdrop) : rgb;
}

/**
 * CAM-541 — resolve a TEXT token the way Tailwind's `text-x/NN` opacity
 * modifier actually renders it: the token's own full-opacity colour,
 * composited at `fgAlpha` over the backdrop it sits on (distinct from a
 * token's OWN declared alpha, handled by `resolveOver` above — `--foreground`
 * has none). This is the missing half of the `overlay` mechanism: `overlay`
 * tints the BACKGROUND a fill sits on; this tints the FOREGROUND text itself,
 * which is how `text-foreground/70` (the established fix for muted-foreground
 * failing on the ai-surface/ai-tint glass, CAM-451/CAM-541) actually renders.
 */
export function resolveForeground(tokens, name, backdrop, fgAlpha) {
  const raw = tokens[name];
  if (!raw) throw new Error(`token ${name} is not declared`);
  const rgb = oklchToSrgb(parseOklch(raw));
  return fgAlpha < 1 ? compositeOver(rgb, fgAlpha, backdrop) : rgb;
}

/* ── the pair registry ─────────────────────────────────────────────────────
   `fg` is measured against `bg`; `bg` is always a real surface in the app.
   `floor` + `kind` record WHICH standard the row is judged against and why.

   `overlay: { token, alpha }` (CAM-546) describes a Tailwind opacity fill laid
   over that surface — `bg-primary/10` is NOT a token, so it cannot be named in
   `bg`, yet it is the surface real text sits on (the active dashboard menu
   item, a guest's initial in an avatar). It matters because the tint LIGHTENS
   the backdrop and is therefore the WORST case, not an equivalent of the bare
   surface: measured 3.01:1 vs 3.28:1 on bare `--card` in dark. Without this the
   worst surface in the app would go unmeasured. */

export const ENFORCED_PAIRS = [
  // --- non-text state fills (SC 1.4.11) — the defect CAM-537 fixes ---------
  { fg: "--primary", bg: "--card", floor: 3, kind: "non-text",
    context: "selected chip fill vs unselected chip fill / dialog surface" },
  { fg: "--primary", bg: "--background", floor: 3, kind: "non-text",
    context: "selected chip fill vs the modal body" },
  { fg: "--accent", bg: "--card", floor: 3, kind: "non-text",
    context: "dropdown/select item focus fill vs the panel" },

  // --- the label ON those fills (SC 1.4.3) — the other half of the trade-off
  { fg: "--primary-foreground", bg: "--primary", floor: 4.5, kind: "text",
    context: "chip / primary button label on the primary fill" },
  { fg: "--accent-foreground", bg: "--accent", floor: 4.5, kind: "text",
    context: "menu item label on the accent fill" },

  // --- the owner's example: AI-chat price ---------------------------------
  // `text-lg font-semibold` = 18px/600. NOT WCAG "large text" (needs 18.66px at
  // weight 700), so it is judged at the 4.5:1 body floor, not 3:1.
  { fg: "--ai-price", bg: "--card", floor: 4.5, kind: "text",
    context: "AiChatCampCard price hero (18px/600) on the card" },
  { fg: "--ai-price", bg: "--ai-surface", floor: 4.5, kind: "text",
    context: "AiChatDetailCard price on the glass surface" },

  // --- CAM-546: primary teal AS TEXT ---------------------------------------
  // `--primary` paints fills/borders/rings/icons; `--primary-ink` paints WORDS.
  // The split exists because one token provably cannot do both (text on the
  // dark --card needs L >= 0.596, a near-white label ON the fill needs
  // L <= 0.548 — disjoint). Every row below is a surface `text-primary-ink`
  // actually sits on; each is judged at the 4.5:1 body floor, because the
  // migrated call sites include 12-14px copy, not just large headings.
  { fg: "--primary-ink", bg: "--background", floor: 4.5, kind: "text",
    context: "link-variant button / inline link / calendar today, on the page" },
  { fg: "--primary-ink", bg: "--card", floor: 4.5, kind: "text",
    context: "price, link and label text on a card" },
  { fg: "--primary-ink", bg: "--popover", floor: 4.5, kind: "text",
    context: "link text inside a popover/dialog" },
  { fg: "--primary-ink", bg: "--ai-surface", floor: 4.5, kind: "text",
    context: "AiChatCampCard view-detail line on the glass surface" },
  { fg: "--primary-ink", bg: "--card", overlay: { token: "--primary", alpha: 0.10 }, floor: 4.5, kind: "text",
    context: "active dashboard menu label / avatar initial on a 10% primary tint (the worst surface in the app)" },
  { fg: "--primary-ink", bg: "--background", overlay: { token: "--primary", alpha: 0.10 }, floor: 4.5, kind: "text",
    context: "the same 10% tint where it sits on the page rather than a card" },
  { fg: "--primary-ink", bg: "--card", overlay: { token: "--primary", alpha: 0.05 }, floor: 4.5, kind: "text",
    context: "selected icon-card chip label on a 5% primary tint" },
  { fg: "--primary-ink", bg: "--background", overlay: { token: "--primary", alpha: 0.05 }, floor: 4.5, kind: "text",
    context: "ghost-primary link-action label on its 5% hover tint" },

  // --- CAM-541: secondary assistant text on the glass surfaces -------------
  // `--muted-foreground` at full opacity measures 4.40:1 (light, --ai-surface)
  // / 4.19:1 (light, --ai-tint) — under the 4.5:1 floor (the owner-reported
  // "nearly invisible in light mode" defect). The established fix (CAM-451,
  // AiChatDetailCard) is `text-foreground/70`, not a new token — this pair
  // measures exactly that Tailwind opacity modifier via `fgAlpha`.
  // CAM-569: the card carousel's `{cur}/{N}` pagination counter sits on this
  // SAME `--ai-surface` glass (no wrapping `bg-ai-tint` bubble there) and
  // hit the identical defect — CAM-541 could not fix it because the file
  // belonged to CAM-547. It reuses this exact already-enforced pair rather
  // than adding a numerically-duplicate row (this script measures token
  // math, not per-component usage), so the context below now names it too.
  { fg: "--foreground", fgAlpha: 0.7, bg: "--ai-surface", floor: 4.5, kind: "text",
    context: "assistant secondary text (header role, welcome examples label, zero-result notice, the card carousel's {cur}/{N} pagination counter) on the glass surface" },
  { fg: "--foreground", fgAlpha: 0.7, bg: "--ai-tint", floor: 4.5, kind: "text",
    context: "assistant secondary text (AiChatDetailCard captions) on the tint surface" },

  // --- everyday body text -------------------------------------------------
  { fg: "--foreground", bg: "--background", floor: 4.5, kind: "text", context: "body text on the page" },
  { fg: "--foreground", bg: "--card", floor: 4.5, kind: "text", context: "body text on a card" },
  { fg: "--popover-foreground", bg: "--popover", floor: 4.5, kind: "text", context: "text in a popover/dialog" },
  { fg: "--muted-foreground", bg: "--background", floor: 4.5, kind: "text", context: "secondary text on the page" },
  { fg: "--muted-foreground", bg: "--card", floor: 4.5, kind: "text", context: "secondary text on a card" },
  { fg: "--secondary-foreground", bg: "--secondary", floor: 4.5, kind: "text", context: "secondary button label" },

  // --- status colours AS TEXT on their tints ------------------------------
  // Deliberately NOT registered: a solid status fill vs the page background.
  // Badges render as a tint with the colour as text (`bg-warning/2` + text), and
  // DESIGN.md forbids colour-only signals, so the fill identifies nothing on its
  // own. Judging it at the non-text floor would manufacture a failure the
  // standard does not ask for. What matters is the text, which is what we pin.
  { fg: "--destructive", bg: "--card", floor: 4.5, kind: "text", context: "destructive text on a card tint" },
  { fg: "--success", bg: "--card", floor: 4.5, kind: "text", context: "success text on a card tint" },
  { fg: "--info", bg: "--card", floor: 4.5, kind: "text", context: "info text on a card tint" },
  { fg: "--warning-foreground", bg: "--warning", floor: 4.5, kind: "text", context: "label on the warning fill" },
  { fg: "--success-foreground", bg: "--success", floor: 4.5, kind: "text", context: "label on the success fill" },
  { fg: "--info-foreground", bg: "--info", floor: 4.5, kind: "text", context: "label on the info fill" },

  // --- CAM-662: disabled controls, flat colour instead of opacity ----------
  // WCAG 2.1 SC 1.4.3 (Contrast Minimum) and SC 1.4.11 (Non-Text Contrast)
  // BOTH explicitly exempt "inactive"/"disabled" user-interface components
  // from any required floor — so, unlike every other row above, nothing here
  // is legally owed. These two rows are a SELF-IMPOSED floor (this file's
  // existing 3:1 non-text/state floor, reused on purpose rather than
  // inventing a fourth category) because a disabled control still has to be
  // legible, per the owner's ruling. `--disabled-foreground` on `--disabled`
  // is the worst case (a disabled BUTTON/INPUT/SELECT/TEXTAREA/CHECKBOX/
  // FILTER-CHIP's own flat fill); `--disabled-foreground` on `--popover` is
  // the representative text-only case (a disabled menu/select/command item,
  // which keeps the popover's own background rather than gaining a fill).
  { fg: "--disabled-foreground", bg: "--disabled", floor: 3, kind: "non-text (exempt, self-imposed)",
    context: "disabled control fill + label/icon (button/input/select/textarea/checkbox/filter-chip)" },
  { fg: "--disabled-foreground", bg: "--popover", floor: 3, kind: "non-text (exempt, self-imposed)",
    context: "disabled menu/select/command item label on the popover surface" },
];

export const DEFERRED_PAIRS = [
  { fg: "--border", bg: "--background", floor: 3, kind: "non-text",
    context: "divider / card outline on the page",
    reason: "clearing 3:1 needs L 0.925 -> ~0.669: every divider in the app becomes a mid-grey line, against the DESIGN.md section 1 light-chrome POV. Owner decision." },
  { fg: "--border", bg: "--card", floor: 3, kind: "non-text",
    context: "divider inside a card",
    reason: "the same single --border token as the row above, so it cannot be fixed independently of it; one decision covers both surfaces." },
  { fg: "--input", bg: "--background", floor: 3, kind: "non-text",
    context: "text-input boundary (the boundary that identifies the control)",
    reason: "the strongest 1.4.11 case of the deferred set, but the same visible chrome repaint. Owner decision." },
  { fg: "--ai-tint", bg: "--card", floor: 3, kind: "non-text",
    context: "AI card border",
    reason: "same class as --border; splitting it from that decision would fragment the look." },
  { fg: "--ring", bg: "--background", floor: 3, kind: "non-text",
    context: "focus ring",
    reason: "the indicator users see is composed in components (ring-ring/30 on Button, ring-ring/50 on Badge), so the token alone does not determine it; components are outside CAM-537's file surface." },
  // RETIRED by CAM-546 — `--primary` as text on `--card`.
  // It is not "still deferred": the second token CAM-537 asked for now exists
  // (`--primary-ink`) and every call site that rendered WORDS moved onto it, so
  // the pair is enforced above instead of tolerated here. `--primary` is no
  // longer used as text anywhere, which is what makes removing the row honest
  // rather than convenient — `__tests__/cam-546-*` re-checks that claim against
  // the real source tree, so it cannot rot back in unnoticed.
];

/** Resolve the surface a pair really sits on, applying an `overlay` tint if declared. */
export function resolvePairBackground(tokens, pair) {
  const base = resolveSurface(tokens, pair.bg);
  if (!pair.overlay) return base;
  const tint = resolveOver(tokens, pair.overlay.token, base);
  return compositeOver(tint, pair.overlay.alpha, base);
}

/** Measure one registry against the parsed token sets. */
export function measurePairs(pairs, tokenSets) {
  const rows = [];
  for (const [theme, tokens] of Object.entries(tokenSets)) {
    for (const pair of pairs) {
      const bg = resolvePairBackground(tokens, pair);
      // CAM-541: `fgAlpha` measures a Tailwind `text-x/NN` opacity modifier
      // (the fix applied to the assistant's secondary text) rather than the
      // token at its own full-opacity declared colour.
      const fg =
        pair.fgAlpha !== undefined
          ? resolveForeground(tokens, pair.fg, bg, pair.fgAlpha)
          : resolveOver(tokens, pair.fg, bg);
      const ratio = contrastRatio(fg, bg);
      rows.push({
        ...pair,
        theme,
        ratio,
        pass: ratio >= pair.floor,
        fgHex: toHex(fg),
        bgHex: toHex(bg),
        fgLabel: pair.fgAlpha !== undefined ? `${pair.fg}/${Math.round(pair.fgAlpha * 100)}` : pair.fg,
        bgLabel: pair.overlay
          ? `${pair.overlay.token}/${Math.round(pair.overlay.alpha * 100)} over ${pair.bg}`
          : pair.bg,
      });
    }
  }
  return rows;
}

/** Everything, from a CSS string. Exported so tests can recompute rather than trust. */
export function measureAll(css) {
  const { light, dark } = parseTokens(css);
  const sets = { light, dark };
  return {
    enforced: measurePairs(ENFORCED_PAIRS, sets),
    deferred: measurePairs(DEFERRED_PAIRS, sets),
  };
}

/* ── CAM-662 report-mode scan: opacity-for-de-emphasis + alpha-on-text ──────
   A NUMERIC guard (the rest of this file) cannot see a Tailwind CLASS STRING
   in a .tsx file — that is check-palette.mjs's job (lexical, over source
   files). This scan borrows that shape for exactly the two patterns the
   owner's CAM-662 ruling named:
     1. opacity used to DE-EMPHASIZE a disabled/inactive control
        (`disabled:opacity-50`, a JS `disabled && "opacity-50 …"` conditional,
        etc.) — components/ui/* is 0 by construction (this same story fixed
        every one); the ~10 known call sites OUTSIDE components/ui are
        exactly why this ships in REPORT MODE ONLY (`.claude/rules/ops.md`:
        never ship a blocking guard with a non-zero backlog).
     2. alpha directly on TEXT (`text-foreground/70`) and hairline/tint alpha
        on a fill (`border-border/60`, `bg-primary/10`) — both named
        explicitly as CAM-662 phase-2, out of this story's scope.
   This never blocks and never judges a hit good/bad — some are ALREADY
   reviewed/sanctioned (CAM-541's fgAlpha rows above; DESIGN.md's approved
   `bg-(primary|success|warning|info|destructive)/10` icon-chip fill). A
   lexical count cannot tell "sanctioned" from "backlog"; it can only make the
   total visible so it is never silently forgotten (report-mode -> clear the
   backlog to 0 -> only THEN consider blocking, per CAM-221). */

const TOKEN_COLOR_NAMES =
  "foreground|background|card-foreground|popover-foreground|primary(?:-ink|-foreground)?|secondary-foreground|muted-foreground|accent-foreground|destructive|success(?:-foreground)?|warning-foreground|info(?:-foreground)?|sidebar-foreground|ai-price|disabled-foreground";
const TOKEN_FILL_NAMES =
  "border|input|primary|secondary|accent|destructive|success|warning|info|muted|card|popover|foreground|ring|ai-tint|ai-surface|disabled";

/** A Tailwind utility whose variant chain names "disabled" and ends `:opacity-NN`. */
export const DISABLED_OPACITY_RE = /[^\s"'`]*disabled[^\s"'`]*:opacity-\d{1,3}\b/gi;
/** The JS-conditional shape (`disabled && "opacity-50 …"`). */
export const DISABLED_JS_OPACITY_RE = /\bdisabled\s*&&\s*["'`][^"'`]*opacity-\d{1,3}/g;
/** Alpha directly on a text-color token (CAM-662 phase-2). */
export const ALPHA_ON_TEXT_RE = new RegExp(`\\btext-(?:${TOKEN_COLOR_NAMES})\\/\\d{1,3}\\b`, "g");
/** Hairline/tint alpha on a border/background/ring fill (CAM-662 phase-2). */
export const HAIRLINE_TINT_ALPHA_RE = new RegExp(`\\b(?:border|bg|ring)-(?:${TOKEN_FILL_NAMES})\\/\\d{1,3}\\b`, "g");

const SCAN_DIRS = ["app", "components"];
const SCAN_EXTS = [".tsx", ".ts"];
const SCAN_EXCLUDE = new Set(["node_modules", ".next", "scripts", "__tests__"]);

/** Recursively list source files under `dir`, skipping the excluded folders. */
export function walkForScan(dir, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SCAN_EXCLUDE.has(entry)) continue;
    const abs = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkForScan(abs, results);
    else if (SCAN_EXTS.some((e) => abs.endsWith(e))) results.push(abs);
  }
  return results;
}

/** Scan `app/` + `components/` under `rootDir` for the three CAM-662 patterns. */
export function scanDeEmphasis(rootDir) {
  const files = SCAN_DIRS.flatMap((d) => walkForScan(path.join(rootDir, d)));
  const hits = { disabledOpacity: [], alphaOnText: [], hairlineTintAlpha: [] };
  for (const abs of files) {
    const rel = path.relative(rootDir, abs);
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const re of [DISABLED_OPACITY_RE, DISABLED_JS_OPACITY_RE]) {
        for (const m of line.matchAll(re)) {
          hits.disabledOpacity.push({ file: rel, line: i + 1, match: m[0] });
        }
      }
      for (const m of line.matchAll(ALPHA_ON_TEXT_RE)) {
        hits.alphaOnText.push({ file: rel, line: i + 1, match: m[0] });
      }
      for (const m of line.matchAll(HAIRLINE_TINT_ALPHA_RE)) {
        hits.hairlineTintAlpha.push({ file: rel, line: i + 1, match: m[0] });
      }
    });
  }
  return hits;
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function formatRow(r) {
  const verdict = r.pass ? "pass" : "FAIL";
  const ratio = `${r.ratio.toFixed(2)}:1`.padStart(7);
  return `  ${verdict}  ${ratio}  (floor ${String(r.floor).padEnd(3)} ${r.kind.padEnd(8)})  ${r.theme.padEnd(5)}  ${r.fgLabel} on ${r.bgLabel} — ${r.context}  [${r.fgHex} on ${r.bgHex}]`;
}

function main() {
  const verbose = process.argv.includes("--verbose");
  // Optional CSS path override. CI always runs `npm run check:contrast` with no
  // argument, so it always measures the real app/globals.css; the override
  // exists so the test suite can prove the guard FIRES on a deliberately-bad
  // token file without ever mutating the repo's own stylesheet.
  const override = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const cssPath = override ? path.resolve(override) : CSS_PATH;
  const css = readFileSync(cssPath, "utf8");
  const { enforced, deferred } = measureAll(css);
  const failures = enforced.filter((r) => !r.pass);

  console.log(`\ncheck-contrast — WCAG 2.1 token floors (app/globals.css)\n`);
  console.log(`ENFORCED (blocking): ${enforced.length} pairs — ${enforced.length - failures.length} pass, ${failures.length} fail`);
  for (const r of enforced) {
    if (verbose || !r.pass) console.log(formatRow(r));
  }

  const deferredFails = deferred.filter((r) => !r.pass);
  console.log(
    `\nDEFERRED (reported, never blocking): ${deferred.length} pairs — ${deferredFails.length} known failures.`
  );
  console.log(`  These are recorded in DESIGN.md section 8 item 11 and need an owner decision.`);
  for (const r of deferredFails) {
    console.log(formatRow(r));
    console.log(`         why deferred: ${r.reason}`);
  }

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} enforced pair(s) below the contrast floor. Fix the token in app/globals.css.\n`);
    process.exit(1);
  }
  console.log(`\n✓ every enforced pair clears its floor in both themes.\n`);

  // CAM-662 — REPORT MODE ONLY, never affects the exit code above. The
  // backlog is non-zero on purpose (opacity-for-de-emphasis outside
  // components/ui, plus all of phase-2) — printed loudly so it stays visible
  // rather than blocking a guard the backlog cannot yet clear (ops.md: never
  // ship blocking with a non-zero backlog).
  const hits = scanDeEmphasis(ROOT);
  const total = hits.disabledOpacity.length + hits.alphaOnText.length + hits.hairlineTintAlpha.length;
  console.log(`CAM-662 de-emphasis scan (report-only, never blocks): ${total} candidate(s) across app/ + components/`);
  console.log(`  opacity-for-de-emphasis (disabled-state): ${hits.disabledOpacity.length}`);
  console.log(`  alpha-on-text: ${hits.alphaOnText.length}`);
  console.log(`  hairline/tint alpha: ${hits.hairlineTintAlpha.length}`);
  if (verbose) {
    for (const [label, list] of Object.entries(hits)) {
      for (const h of list) console.log(`    [${label}] ${h.file}:${h.line}  ${h.match}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
