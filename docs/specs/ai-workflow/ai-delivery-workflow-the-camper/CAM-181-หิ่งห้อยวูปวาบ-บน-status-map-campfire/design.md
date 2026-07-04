---
linear: CAM-181
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-25
---
# Design — หิ่งห้อยวูปวาบ บน /status/map campfire scene (CAM-181)

## Flow

This story has no user flow — it is a purely decorative ambient layer on the
existing `/status/map` scene. No interaction, no navigation, no new screen.
The fireflies are present from page load and run silently in the background.

## Context: scene layer model (read before building)

The scene is a FIXED dark-night campfire aesthetic, self-contained inside
`SCENE_CSS` in `campsite-scene.tsx`. It is immune to the `.dark` Tailwind
toggle. The existing layer stack (z-index, all within `.map-wrap`):

| Layer | z-index | Notes |
|---|---|---|
| `.map-bg` (forest background `<img>`) | 0 | Full-viewport cover |
| `.map-viewport` / `.map-stage` | 5 | Fixed fit-canvas |
| `.scout-layer` | 30 | Characters (agents + You) |
| `.delivery-gift` wrapper | 1300 | Gift box above everything |
| `.hud-topbar`, `.hud-left-panels`, `.hud-right-panels` | 22–23 (fixed) | Separate stacking context |

The campfire glyph sits at approximately canvas 50 % x, 52 % y (from the
`DebugRoutes` keep-out circle: `cx={50} cy={54} r={7}`).

## Recommended design spec

### Layer placement

Add `.firefly-layer` as a direct child of `.map-stage`, inserted in the JSX
BEFORE `.scout-layer` (DOM order = below characters).

```
position: absolute;
inset: 0;
pointer-events: none;
z-index: 10;         /* above .map-bg (0), below .scout-layer (30) */
overflow: hidden;
```

z-index 10 places the fireflies between the background forest and the agent
characters. They float through the tree line and clearing as ambient depth,
never occluding any interactive element or HUD text.

### Firefly count

**Recommended: 8 fireflies** (subtle, not distracting). Positioned using
absolute `%` coordinates chosen to scatter across the upper forest / tree-line
area (y: 5–45 %) and the mid-clearing edges (y: 45–68 %), deliberately
avoiding:

- Dead-centre campfire glow zone: x 43–57 %, y 47–60 % (keep clear).
- HUD left-panel zone: x 0–22 %, y 8–95 % (panels are fixed, outside
  `.map-stage`, so fireflies underneath are fine — but avoid x < 5 % for
  tidiness).
- Top-bar row: y 0–5 % (keep clear).

Suggested scatter positions (% of `.map-stage` canvas, tunable by Frontend):

| id | x % | y % | notes |
|---|---|---|---|
| ff-1 | 18 | 12 | upper-left tree area |
| ff-2 | 32 | 22 | left mid-forest |
| ff-3 | 62 | 10 | upper-right tree canopy |
| ff-4 | 74 | 28 | right mid-forest |
| ff-5 | 85 | 48 | right clearing edge |
| ff-6 | 28 | 55 | left clearing edge |
| ff-7 | 44 | 18 | upper-centre tree line |
| ff-8 | 68 | 62 | lower-right, near agents |

### Each firefly: size and color

**Size (recommended): 3 px diameter** (`width: 3px; height: 3px;
border-radius: 50%;`)

Two color options for the owner to choose (see "Owner picks at G2"):

**Option A — warm amber/gold (recommended):**
Matches the existing campfire tokens (`--amber: #FFB454`,
`--amber-glow: rgba(255,150,52,.6)`). Keeps the palette coherent.
```
background: #FFB454;
box-shadow: 0 0 4px 2px rgba(255,180,84,0.7), 0 0 8px 4px rgba(255,150,52,0.3);
```

**Option B — soft yellow-green (real firefly):**
More naturalistic. Distinct from the campfire color, so fireflies read as
separate organisms rather than sparks.
```
background: #d4f54a;
box-shadow: 0 0 4px 2px rgba(200,240,60,0.65), 0 0 8px 4px rgba(160,220,30,0.25);
```

Note: neither color uses a Tailwind semantic token because this layer lives
entirely inside `SCENE_CSS` — a self-contained dark-scene CSS block that
already uses hardcoded scene-local variables (`--amber`, `--text`, etc.) and
is exempt from `check:palette` by the explicit exclusion in
`DESIGN.md §0 point 4`: `(except app/globals.css, app/status/**)`. Both hex
values remain within the scene-local token set.

### Twinkle animation ("วูปวาบ")

Pure CSS, opacity only. Each firefly fades: `0 → 0.9 → 0` with a different
duration and delay so they blink out of sync.

```css
@keyframes fireflyTwinkle {
  0%, 100% { opacity: 0; }
  50%       { opacity: 0.9; }
}
```

Assign per-firefly via `animation-duration` and `animation-delay`:

| id | duration | delay |
|---|---|---|
| ff-1 | 3.2s | 0.0s |
| ff-2 | 4.1s | 0.7s |
| ff-3 | 2.8s | 1.4s |
| ff-4 | 5.0s | 0.3s |
| ff-5 | 3.6s | 2.1s |
| ff-6 | 4.4s | 0.9s |
| ff-7 | 2.9s | 1.7s |
| ff-8 | 3.8s | 0.5s |

Duration range: 2.8–5.0s. All use `ease-in-out` (natural fade).
These ranges land comfortably outside the DESIGN.md `120–250ms` motion
rule — that rule applies to interactive UI transitions (button presses,
modal open/close). Ambient decorative animation is exempt and follows its
own pacing to feel naturalistic.

**Drift: not recommended for this story.** The owner's phrasing
"วูปวาบเล็กๆ" (small twinkle) means pure blink, not movement. Drift adds
a separate `translateX/Y` keyframe cycle which multiplies animation complexity
and risks visual busyness. Keep it as pure twinkle (opacity only). Drift can
be added as a follow-on if the owner wants more life after seeing the result.

### Reduced-motion handling

Wrap the entire `@keyframes fireflyTwinkle` and `.firefly` animation
assignment inside `@media (prefers-reduced-motion: no-preference)`.

Under `prefers-reduced-motion: reduce`, fireflies render at a fixed
`opacity: 0.3` with no animation — faint static dots, present but not
flashing. This is safer than hiding entirely (the dots add ambient warmth even
without motion).

```css
/* Default (reduced-motion fallback): static faint dots */
.firefly {
  opacity: 0.3;
  /* no animation */
}

@media (prefers-reduced-motion: no-preference) {
  .firefly {
    opacity: 0; /* start hidden; animation drives it */
    animation: fireflyTwinkle var(--ff-dur, 3.5s) ease-in-out var(--ff-delay, 0s) infinite;
  }
  @keyframes fireflyTwinkle {
    0%, 100% { opacity: 0; }
    50%       { opacity: 0.9; }
  }
}
```

Each firefly sets `--ff-dur` and `--ff-delay` via inline style for minimal
repetition: `style="--ff-dur:3.2s;--ff-delay:0s"`.

## States

This is a decorative, non-interactive layer. The 8-state checklist collapses to
the states that are meaningful for ambient CSS elements:

| State | Behaviour |
|---|---|
| default | Fireflies blink at their assigned duration/delay cycle. |
| hover | `pointer-events:none` — no hover state. |
| focus | Not focusable — `pointer-events:none`, not in tab order. |
| active | n/a |
| loading | Fireflies are CSS-only, no loading state. Present from first paint. |
| error | n/a — decorative layer, no error surface. |
| empty | n/a |
| disabled (`prefers-reduced-motion: reduce`) | Static at `opacity:0.3`, no animation. |

## Components and tokens

No `components/ui/*` component is used — the firefly layer is pure CSS inside
`SCENE_CSS`, consistent with all other decorative elements in the scene
(aura-ring, glow, speech bubble, badge).

Scene-local tokens used:

| Token | Value | Usage |
|---|---|---|
| `--amber` | `#FFB454` | Firefly fill (Option A only) |
| `--amber-glow` | `rgba(255,150,52,.6)` | Glow box-shadow base (Option A) |

No new design tokens are required. The two hex values for Option B
(`#d4f54a`, `rgba(200,240,60,0.65)`) are scene-local if chosen, in the same
pattern as the existing `--amber` scene variable.

No `locales/` entries are needed — this is a purely visual layer with no
user-facing copy.

## a11y

- `pointer-events: none` on `.firefly-layer` and all `.firefly` children.
  Nothing is focusable or interactive.
- The `.firefly-layer` div carries `aria-hidden="true"` (decorative, no
  semantic meaning).
- Each `.firefly` span carries `aria-hidden="true"`.
- No color is used as an information signal — purely decorative.
- `prefers-reduced-motion: reduce` handled: no flashing under the OS setting.
- Tap target: not applicable (pointer-events:none throughout).
- Contrast: not applicable (no text or information-bearing element).
- WCAG 2.1 AA: no violations introduced. The layer is fully transparent to
  assistive technology.

## Performance

- CSS-only: no JS, no rAF, no `setTimeout`. Zero runtime cost beyond the
  initial paint of 8 tiny `<span>` elements.
- No layout-triggering properties animated (opacity only).
- No CLS: the layer is `position:absolute; inset:0; pointer-events:none;` —
  it contributes no block layout.
- Image budget: not applicable (no images added).
- The `overflow: hidden` on `.firefly-layer` prevents any glow bleed outside
  `.map-stage`.

## Owner picks at G2

The recommended option is marked [REC].

**Color — what color are the fireflies?**

- (A) Warm amber/gold `#FFB454` [REC] — matches the campfire; the scene reads
  as a unified warm-light night. Fireflies feel like live sparks or glowing
  insects in the campfire's family.
- (B) Soft yellow-green `#d4f54a` — more naturalistic firefly color. Distinct
  from the campfire; fireflies read as separate living creatures against the
  warm amber fire. More contrast with the background.

**Density — how many fireflies?**

- (A) Subtle: 8 [REC] — tasteful ambient; does not compete with the agents
  or the HUD panels.
- (B) Lively: 12 — more visible life in the forest; slightly busier.

**Motion — twinkle only vs twinkle + drift?**

- (A) Twinkle only (opacity) [REC] — faithful to "วูปวาบเล็กๆ"; minimal
  complexity; safe performance.
- (B) Twinkle + slight drift (opacity + slow translateX/Y, ~8–12 px over 6–9s)
  — more lifelike; slightly more complex CSS; adds a second keyframe cycle per
  firefly.

**Depth — ambient background vs foreground click-through?**

- (A) Behind characters: z-index 10, below `.scout-layer` (z-index 30) [REC]
  — fireflies appear to float in the tree-line and clearing behind the agents.
  Reads as environmental depth.
- (B) In front (click-through): z-index 35, above `.scout-layer` — fireflies
  drift in front of characters. More dramatic; risks visual noise around the
  agent badges and status popups.

## Design Gate checklist

- [ ] Token-only: all color values are scene-local tokens (`--amber`) or
  explicitly Option B scene-local hex — exempt from `check:palette` per
  `DESIGN.md §0 point 4` (`app/status/**` exclusion).
- [ ] No component invented outside the system — layer is pure CSS, consistent
  with existing SCENE_CSS decorative elements.
- [ ] `pointer-events:none` throughout; `aria-hidden="true"` on layer and
  each dot — no a11y regression.
- [ ] `prefers-reduced-motion: reduce` handled — static `opacity:0.3`,
  no flashing.
- [ ] No JS, no rAF — zero runtime budget impact.
- [ ] No CLS — `position:absolute; inset:0` contributes no block layout.
- [ ] No copy added — no `locales/` entries needed.
- [ ] No new design tokens added to `app/globals.css` or `DESIGN.md` —
  scene-local only.
- [ ] Anti-slop: dots are 3 px CSS circles, no emoji, no icon library,
  no invented component.
- [ ] `npm run lint` and `npm run typecheck` pass (SCENE_CSS is a template
  literal string; type is `string`, no TS impact).
- [ ] Screenshot vs Brief: 8 fireflies visible in the tree/clearing area,
  none overlapping the campfire glow or HUD panels.

## Links

`../../feature.md` · `DESIGN.md` · `app/status/map/campsite-scene.tsx`
(SCENE_CSS block, `.scout-layer` insertion point)

## Changelog

- v1 (2026-06-25) — created
