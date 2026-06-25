---
linear: CAM-182
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-25
---
# Design — Quest UI: Approval Notification + Approval Card (CAM-182)

## User job

The owner of the CampVibe platform is watching the `/status/map` scene. When there are gates (approval tasks) waiting for them, two UI pieces signal that fact:

1. **Notification bubble (`.you-alert`)** — a small pill that hovers above the "You" character.
2. **Approval card (`ApprovalCard`)** — a glass panel in the left HUD stack listing what needs approval.

The job: make both feel like a **quest alert system** — higher visual weight, clearer hierarchy, more game-y depth — without touching the approval logic, engine, or data contract.

## Flow

Scene loads → gates.length > 0 → notification bubble appears above "You" (animated) AND Approval card appears in the left stack (expanded) → owner taps notification OR the primary card button → existing modal opens (unchanged) → owner approves → state updates (unchanged).

No new routes. No new data shape. No change to when things appear/disappear.

---

## Part 1 — Notification bubble redesign (`.you-alert`)

### Current problems

| Problem | Severity |
|---|---|
| `font-size: 11px` — below readable threshold for a game alert marker | Important |
| `padding: 5px 11px` — cramped; total height is borderline at 44px | Important |
| `&#9873;` Unicode glyph instead of a lucide icon | Critical (violates §7 icon policy) |
| `.adot` is a 7px DOM div used as an icon — invisible to screen readers AND to the icon system | Critical |
| No copy in `locales/` — `รอตรวจสอบ {N}` is hardcoded in JSX | Critical |

### Recommended redesign

**Icon (option A — recommended): `ClipboardCheck` from lucide-react, size 15, strokeWidth 2.**

Rationale: conveys "there is a task that needs your sign-off" — reads as "quest objective ready to check off". More purposeful than generic `BellRing` (noisy), more clear than `Sparkles` (decorative), more accurate than `ShieldAlert` (threat framing). `Gift` is reserved for the delivery-gift flow (CAM-171).

See Owner choices at end of document for alternatives.

**Sizes + spacing:**

| property | current | redesigned |
|---|---|---|
| font-size | 11px | 13px |
| font-weight | 700 | 800 (or 700 if 800 unavailable in the scene font) |
| padding | 5px 11px | 7px 14px |
| gap (icon + text) | 6px | 7px |
| border-radius | 11px | 13px |
| icon | `&#9873;` glyph + 7px dot | `ClipboardCheck` size=15 strokeWidth=2 |
| min-height | 44px | 44px (preserved) |
| min-width | 44px | 44px (preserved) |

**Surface + glow:**

Preserve the existing amber gradient `linear-gradient(180deg,#ffcf86,#ff9d3c)` — it is correct for this scene's SCENE_CSS (the palette check exempts `app/status/**`). Add a stronger outer glow and a tighter inset to make it read as "lit up / live":

- `box-shadow`: `0 0 0 1.5px rgba(255,180,84,.55), 0 10px 28px -4px rgba(255,150,52,.7)`  
  — the `1.5px` ring is the "quest highlight ring"; the outer shadow is deeper than the current `0 8px 22px -3px`.
- Inset top highlight (already present via border): bump `border` to `1.5px solid rgba(255,220,130,.75)`.

**Animation:**

- Reuse existing `alertPulse` (vertical translate, 1.9s) on the whole bubble — no change.
- Remove `.adot` + its `pdot3` animation entirely (the ring effect is replaced by the stronger outer glow + the icon).
- `prefers-reduced-motion: reduce` — `alertPulse` is already gated in the `@media (prefers-reduced-motion: no-preference)` block in SCENE_CSS. The glow is a `box-shadow` (static, no animation) — holds steady at full opacity under reduced motion. No flashing.

**Caret tail:**

Keep the existing `::after` downward caret pointing at the "You" sprite. Bump caret color to `#ff9d3c` to match the redesigned gradient base (already matches, no change needed).

**Copy:**

Current hardcoded JSX: `{gates.length} รอตรวจสอบ`

New: use locale key `map.you_alert.label` → TH `{N} รอตรวจสอบ` / EN `{N} pending`.  
The popover hint `{N} gate รอการอนุมัติ — กดปุ่ม ⚑` must also be cleaned: remove the `⚑` glyph from the hint text; replace with plain Thai: `{N} gate รอการอนุมัติ — กดเพื่อดูรายละเอียด` (already close to current; just strip the glyph).

**States — `.you-alert`:**

| State | Spec |
|---|---|
| default | Amber gradient pill + `ClipboardCheck` icon + count + text, outer glow ring static |
| hover | Already covered by parent `<button>` pointer; pill itself has `cursor:pointer` |
| focus-visible | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` (already present — keep) |
| active | `opacity: 0.85` (brief press feedback via `active:opacity-85` on parent button) |
| loading | Not applicable — the bubble only renders when `hasGates` is already resolved |
| error | Not applicable — bubble is absent when gates = [] |
| empty | Not rendered when `gates.length === 0` — existing `{hasGates && ...}` guard |
| disabled | Not applicable — the whole "You" button handles disabled state |
| reduced-motion | No `alertPulse` animation; glow holds steady; static text label visible |

**a11y:**

- The `<span className="you-alert">` is `aria-hidden="true"` (the `<button>` parent carries `aria-label`). No change needed to aria — the parent button already has the accessible name.
- The `ClipboardCheck` icon inside is `aria-hidden="true"` (decorative; label is on the button).
- Tap target: parent `<button>` is already `minWidth:44` `minHeight:44` — the pill inherits. Preserved.
- Focus ring: already on parent button via `focus-visible:outline` in SCENE_CSS. Preserved.

**Contrast:** amber gradient on dark navy background — not measured precisely but the existing amber is used throughout the scene at higher weight than body text (it is a graphic UI element, not body text). Large-text/graphic threshold applies (3:1). The `#241402` dark text on `#ffcf86`–`#ff9d3c` gradient exceeds 4.5:1 (standard passes; exact ratio not measured — mark as not measured until axe run on Staging).

---

## Part 2 — Approval card redesign (`ApprovalCard` / `.hud-appr-*`)

### Current problems

| Problem | Severity |
|---|---|
| Heading 10.5px, item title 11.5px, badge 9.5px — all below readable density for a "game board" | Important |
| `border: 1px solid rgba(255,190,80,.18)` — nearly invisible amber border; no depth | Important |
| No animated glow on the card — feels flat compared to the teal `.hud-card.active` card | Suggestion |
| Button `background: rgba(255,190,80,.12)` — too faint to read as a primary action | Important |
| `AlertTriangle` icon (warning/danger framing) — mismatches an approval task which is neutral/positive | Suggestion |
| Button tap target: `padding:9px 14px` with `font-size:12px` — total height ~36px, below 44px | Critical |
| Collapsed mini-state button `padding:5px 12px` — ~28px tall, well below 44px | Critical |

### Recommended redesign

**Icon:** Replace `AlertTriangle` with `ClipboardCheck` (size 13 in heading, size 12 in items/button) — same lucide icon as the notification for visual coherence; signals "review and approve" rather than "warning". See Owner choice B below for alternative.

**Card surface — stronger glass + amber depth:**

```
.hud-appr-card:
  border: 1.5px solid rgba(255,190,80,.32)           (up from .18)
  box-shadow:
    0 10px 32px rgba(0,0,0,.44),                     (deeper base)
    inset 0 1px 0 rgba(255,220,130,.14),             (top glass highlight — slightly stronger)
    inset 0 0 0 1px rgba(255,190,80,.08)             (inner amber volume glow)
```

**Top accent stripe:** Add a 2px top border accent to the card header area:

```
.hud-appr-head::before:
  content: ""
  position: absolute; top: 0; left: 0; right: 0; height: 2px
  background: linear-gradient(90deg, rgba(255,180,84,.0), rgba(255,180,84,.6), rgba(255,180,84,.0))
  border-radius: 18px 18px 0 0
```

This gives the card a visible "golden crown" — readable as "this is the quest board" without being garish.

**Card glow animation (pending state):**

New `@keyframes appr-card-glow` in HUD_CSS:

```
@keyframes appr-card-glow {
  0%,100% { box-shadow: 0 10px 32px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,220,130,.14), inset 0 0 0 1px rgba(255,190,80,.08); border-color: rgba(255,190,80,.32); }
  50%      { box-shadow: 0 10px 32px rgba(0,0,0,.44), 0 0 18px rgba(255,160,52,.22), inset 0 1px 0 rgba(255,220,130,.22), inset 0 0 0 1px rgba(255,190,80,.16); border-color: rgba(255,190,80,.52); }
}
```

Applied with `animation: appr-card-glow 2.8s ease-in-out infinite` when card is expanded.

`prefers-reduced-motion: reduce` — wrap in `@media (prefers-reduced-motion: no-preference)`. Static elevated border holds at 50% keyframe values without movement.

**Typography bumps:**

| element | current | redesigned |
|---|---|---|
| `.hud-appr-heading` font-size | 10.5px | 11.5px |
| `.hud-appr-title` font-size | 11.5px | 12.5px |
| `.hud-appr-badge` font-size | 9.5px | 10.5px |
| `.hud-appr-mini` font-size | 12px | 12px (unchanged — already readable in mini) |

**Item rows — slightly more warmth:**

```
.hud-appr-item:
  background: rgba(255,190,80,.09)       (up from .06)
  border: 1px solid rgba(255,190,80,.18) (up from .12)
  border-radius: 11px                    (up from 10px — minor, keeps the row slightly softer)
  padding: 7px 8px                       (up from 6px — more breathing room)
```

**Priority badge — warmer fill:**

```
.hud-appr-badge:
  background: rgba(255,190,80,.28)       (up from .20)
  color: rgba(255,210,80,.95)            (up from .90)
  padding: 3px 8px                       (up from 2px)
```

**Primary action button — game-y CTA:**

```
.hud-appr-btn:
  padding: 11px 14px                     (up from 9px — brings to ~44px)
  min-height: 44px                       (explicit tap floor)
  background: rgba(255,190,80,.18)       (up from .12)
  border: 1.5px solid rgba(255,190,80,.32) (up from 1px .20)
  font-size: 12.5px                      (up from 12px)
  border-radius: 13px                    (up from 12px — keeps the pill feel)
  box-shadow: inset 0 1px 0 rgba(255,220,130,.18)  (subtle glass top)
```

Hover:
```
.hud-appr-btn:hover:
  background: rgba(255,190,80,.26)
  border-color: rgba(255,190,80,.50)
  box-shadow: 0 0 10px rgba(255,160,52,.2), inset 0 1px 0 rgba(255,220,130,.22)
```

Focus-visible:
```
.hud-appr-btn:focus-visible:
  outline: 2px solid rgba(91,233,176,.8)
  outline-offset: 2px
```

**Collapsed mini-state button — fix the tap target:**

```
.hud-appr-mini .hud-appr-btn (inline override):
  min-height: 36px    (up from ~28px; can't reach 44px without breaking the mini layout)
```

Note: the inline override in the collapsed JSX (`style={{ padding: "5px 12px" }}`) is the culprit. Replace with `padding: "8px 14px"` and `minHeight: 36`. The mini state is a secondary CTA (the full card is one tap away); 36px is acceptable for a secondary inline action in a compact HUD. 44px preferred — flag for owner approval.

**States — `ApprovalCard`:**

| State | Spec |
|---|---|
| default (expanded) | Glass card + amber border + top accent stripe + glow animation + item rows |
| default (collapsed) | Compact mini row — heading + count label + "ดู" button |
| hover (button) | Brighter amber bg + stronger border + outer amber glow |
| focus-visible (button) | Teal `outline: 2px solid rgba(91,233,176,.8); outline-offset:2px` |
| active (button) | `opacity: 0.88` brief press; button scales `scale(0.97)` if motion allowed |
| loading | Not applicable — card only renders when gate data is resolved |
| error | Not applicable — card is absent when gates = [] |
| empty | Not rendered when gates = [] — existing guard in scene unchanged |
| disabled | Not applicable |
| reduced-motion | No `appr-card-glow` animation; static elevated border, no scale on active |

**a11y:**

- `role="complementary" aria-label="งานรออนุมัติ"` already on the card wrapper — keep.
- Primary button: `type="button"` already present — keep.
- `ClipboardCheck` icons inside the button are `aria-hidden="true"` (decorative). Button text `ดูและอนุมัติทั้งหมด` is the accessible name — sufficient.
- Tap target: expanded button → `min-height:44px` explicit. Collapsed "ดู" button → 36px (see note above).
- Contrast: amber text `rgba(255,210,80,.95)` on dark glass `rgba(11,30,24,.60)` — not measured; graphic/large-text threshold. Item title `rgba(223,234,245,.8)` on dark glass — not measured. Both use scene-specific rgba values (palette check exempts `app/status/**`). Mark as not measured until axe run.
- Link row `aria-label="เปิดใน Linear"` already present on the `ExternalLink` anchor — keep.
- Collapse toggle `ChevronToggle` has `label` prop wired — keep.

---

## Tokens + animation mapping

All values below are **scene-scoped SCENE_CSS / HUD_CSS rgba** (inside `app/status/**` which is exempt from `npm run check:palette`). No `app/globals.css` tokens are referenced or changed. No new globals tokens needed.

| variable | value | role |
|---|---|---|
| `--amber` | `#FFB454` | icon + text accent color |
| `--amber-glow` | `rgba(255,150,52,.6)` | outer glow on notification bubble |
| `rgba(255,190,80,…)` | scene amber tint | card border, item bg, button bg |
| `rgba(91,233,176,.8)` | scene teal | focus ring on both elements |
| `rgba(11,30,24,.60)` | scene dark glass | card background |
| `rgba(255,220,130,…)` | warm highlight | card inset top + button inset top |

**Existing keyframes reused:**

- `alertPulse` — notification bubble vertical float (unchanged).
- `hud-card-glow` — referenced as the model for the new `appr-card-glow` (same structure).

**New keyframe:**

- `appr-card-glow` — amber pulsing glow on `.hud-appr-card` when expanded (2.8s ease-in-out infinite, `prefers-reduced-motion: no-preference` only).

---

## Copy (locales)

| key | TH | EN |
|---|---|---|
| `map.you_alert.label` | `{N} รอตรวจสอบ` | `{N} pending` |
| `map.approval_card.heading` | `รออนุมัติ {N} รายการ` | `{N} awaiting approval` |
| `map.approval_card.mini_label` | `{N} รายการรออนุมัติ` | `{N} pending` |
| `map.approval_card.cta` | `ดูและอนุมัติทั้งหมด` | `Review and approve all` |
| `map.approval_card.mini_cta` | `ดู` | `View` |
| `map.you_popover.hint_gates` | `{N} gate รอการอนุมัติ — กดเพื่อดูรายละเอียด` | `{N} gates awaiting approval — tap to view` |

Note: the `/status/map` scene uses inline Thai copy today (not yet wired to `locales/`). These keys are the correct target for a future i18n pass. For this story, the copy strings are specified here and hardcoded in the scene per the existing pattern — a follow-up i18n story should extract them.

---

## Anti-slop audit

| Check | Pass? |
|---|---|
| No free hex outside scene-scoped CSS | Pass — all values inside SCENE_CSS / HUD_CSS (exempt from check:palette) |
| No `&#9873;` glyph, no DOM-dot-as-icon | Redesign replaces both with `ClipboardCheck` lucide |
| No purple gradients / generic shadows | Amber palette only, scene-consistent |
| No card-on-card nesting | Card is a single glass panel, no nested card |
| Layout has clear hierarchy | Top accent + heading + items + primary CTA — clear top-to-bottom quest board read |
| Holds the night-scene aesthetic | Dark glass + amber warm + teal focus ring — consistent with existing scene tokens |
| No emoji in UI | No emoji anywhere |

---

## Owner approves at G2

### Recommended design (default)

**Notification:** `ClipboardCheck` icon (size 15) + 13px bold text + 7px 14px padding + stronger outer amber glow ring + existing `alertPulse` float. DOM dot removed. Copy stays `{N} รอตรวจสอบ`.

**Approval card:** `ClipboardCheck` icon (heading + button) + slightly larger type (11.5/12.5px) + stronger amber border (1.5px, 32% opacity) + top accent stripe (gradient crown) + `appr-card-glow` ambient pulse + bigger button tap target (min-height 44px). No layout change, no data change.

---

### Option A — Notification icon

| | Icon | Rationale |
|---|---|---|
| **A1 (recommended)** | `ClipboardCheck` size 15 | "task ready to sign off" — quest objective framing; pairs with approval card |
| A2 | `BellRing` size 15 | generic alert — clear but reads as "notification" not "task" |
| A3 | `ShieldAlert` size 15 | authority/security framing — accurate but slightly threatening |

**Owner picks one.** Default: A1.

---

### Option B — Approval card icon

| | Icon | Rationale |
|---|---|---|
| **B1 (recommended)** | `ClipboardCheck` (same as notification) | visual coherence — both pieces read as one system |
| B2 | `ListChecks` | emphasises the list of items to review; slightly more editorial |
| B3 | keep `AlertTriangle` | existing — minimal change, preserves familiarity |

**Owner picks one.** Default: B1.

---

### Option C — Card glow intensity

| | Glow | Visual feel |
|---|---|---|
| **C1 (recommended)** | Subtle: `appr-card-glow` peaks at `0 0 18px rgba(255,160,52,.22)` | "live quest board" — noticeable but not distracting |
| C2 | Lively: peak `0 0 28px rgba(255,150,52,.38)` | stronger "something needs you NOW" — more urgent |
| C3 | None | static border only — matches current, safest for distraction-sensitive use |

**Owner picks one.** Default: C1.

---

### Option D — Accent color on card header stripe

| | Stripe | Visual feel |
|---|---|---|
| **D1 (recommended)** | Amber-only gradient crown | pure amber brand coherence |
| D2 | Amber-to-teal gradient | connects the approval card visually to the teal delivery card above it |
| D3 | No stripe | minimal; depth comes from glow alone |

**Owner picks one.** Default: D1.

---

## a11y summary (WCAG 2.1 AA)

- Tap target: notification parent button 44x44 (preserved). Card expanded CTA 44px min-height (new). Card mini CTA 36px (below floor — flagged, see note above).
- Focus ring: `outline: 2px solid rgba(91,233,176,.8); outline-offset:2px` on both interactive elements (existing pattern, preserved + extended to card button).
- Color not the only signal: amber color always paired with text label and icon.
- aria-label: parent button on notification has accessible name. Card has `role="complementary" aria-label="งานรออนุมัติ"`. Button accessible name from text.
- Keyboard: parent button already keyboard-focusable. Card button `type="button"` already keyboard-operable.
- Contrast: not measured — to be verified with axe on Staging (scene is dark glass, exempt from global palette check, verify manually).
- reduced-motion: all animations gated in `@media (prefers-reduced-motion: no-preference)`. Static states hold correctly.

---

## Reference

- Existing working pattern: `.hud-card.active` (teal glow card in left panel) — model for `appr-card-glow` structure.
- Existing amber in scene: `badgeGlow` keyframe on `scout.working .badge` — same animation pattern extended to the card.
- Anti-slop: no new component invented; uses existing `ClipboardCheck` from lucide-react (§7 lucide-only policy).

## Links

`../../epic.md` · `DESIGN.md` · `app/status/map/campsite-scene.tsx` · `app/status/map/campsite-overlays.tsx`

## Changelog

- v1 (2026-06-25) — created; Part 1 notification redesign + Part 2 approval card redesign; 4 owner choice dimensions (A/B/C/D)
