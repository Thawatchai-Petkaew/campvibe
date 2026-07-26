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

import { readFileSync } from "node:fs";
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
      const fg = resolveOver(tokens, pair.fg, bg);
      const ratio = contrastRatio(fg, bg);
      rows.push({
        ...pair,
        theme,
        ratio,
        pass: ratio >= pair.floor,
        fgHex: toHex(fg),
        bgHex: toHex(bg),
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

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function formatRow(r) {
  const verdict = r.pass ? "pass" : "FAIL";
  const ratio = `${r.ratio.toFixed(2)}:1`.padStart(7);
  return `  ${verdict}  ${ratio}  (floor ${String(r.floor).padEnd(3)} ${r.kind.padEnd(8)})  ${r.theme.padEnd(5)}  ${r.fg} on ${r.bgLabel} — ${r.context}  [${r.fgHex} on ${r.bgHex}]`;
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
