---
linear: CAM-184
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-25
---
# Design — Interactive Approve/Reject + Detail Modal + Visual Polish on /status/map (CAM-184)

## Scope lock

This design is derived from the **owner-approved wireframes A/B/C** in `/Users/tawatchaipetkaew/.claude/plans/option-2-virtual-cosmos.md` (CAM-184 section). All choices marked "owner-approved" are locked. Frontend must not deviate from this file without raising a new gate.

---

## User job (from AC)

The platform owner is on `/status/map?token=…` and sees a gate pending. They need to:
1. Recognise a gate is waiting (notification above "You").
2. Open a gate detail to read the issue description and write an optional reason.
3. Approve (confirm step) or Send back (ส่งกลับ) — both via one-tap from the scene.
4. See the gate clear from the map within ~15 s (SSE/pulse reconcile).

Flow: notification `.you-alert` (smaller, no overlap) → click → **GateDetailModal** → Approve (confirm inline) or ส่งกลับ → close + reconcile removes the gate card.
Alternatively: **ApprovalCard** row click → same **GateDetailModal**. Footer "อนุมัติทั้งหมด" → confirm all.

---

## Part 1 — ApprovalCard visual redesign

### 1a. Background — amber-tinted transparent glass (owner-approved)

The card must use **amber-tinted transparent glass** (not the deep green-glass of the summary card).

```css
/* .hud-appr-card */
background: linear-gradient(160deg, rgba(40,26,6,.42), rgba(11,30,24,.54));
backdrop-filter: saturate(180%) blur(28px);
-webkit-backdrop-filter: saturate(180%) blur(28px);
border: 1.5px solid rgba(255,190,80,.32);
box-shadow:
  0 10px 32px rgba(0,0,0,.44),
  0 0 18px rgba(255,160,52,.12),            /* outer amber warmth */
  inset 0 1px 0 rgba(255,220,130,.14),      /* top glass highlight */
  inset 0 0 0 1px rgba(255,190,80,.08);     /* inner amber volume */
```

The amber `rgba(40,26,6,.42)` base is the key change: it shifts the glass from the pure forest-dark into a warm amber-tinted dark that reads as "the approval surface". The existing `apprCardGlow` animation (from CAM-182) continues to pulse the border.

Collapsed mini: same `background` + `backdrop-filter` — the amber-tinted glass must hold in both expanded and collapsed states.

### 1b. Remove `.hud-appr-badge` (priority badge) — owner-approved

Delete the `<span className="hud-appr-badge">` element and the `.hud-appr-badge` CSS block entirely. The heading carries the visual weight instead.

### 1c. Heading — eye-catching amber (compensates for badge removal)

```css
/* .hud-appr-heading */
font-size: 12px;          /* up from 11.5px */
font-weight: 800;         /* up from 700 */
letter-spacing: .07em;
text-transform: uppercase;
color: #FFB454;           /* --amber: full opacity, up from rgba(255,190,80,.7) */
```

The heading reads `รออนุมัติ {N} รายการ` and must now carry full visual weight since the badge column is gone. The `--amber` value `#FFB454` is the scene token from `SCENE_CSS :root`.

### 1d. Gate rows — clickable buttons (open GateDetailModal)

Each `.hud-appr-item` becomes a `<button type="button">` that fires `onOpenDetail(gate.id)`. The existing `ExternalLink` icon link remains as a secondary affordance on the right.

```css
/* .hud-appr-item — now a button */
display: flex;
align-items: center;
gap: 8px;
padding: 7px 8px;
border-radius: 11px;
background: rgba(255,190,80,.09);
border: 1px solid rgba(255,190,80,.18);
width: 100%;
text-align: left;
cursor: pointer;
min-height: 44px;        /* tap target floor */
transition: background 120ms, border-color 120ms;
```

States for each row button:

| State | Spec |
|---|---|
| default | `background: rgba(255,190,80,.09)`, border `.18` opacity |
| hover | `background: rgba(255,190,80,.16)`, border `.28` opacity |
| focus-visible | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` |
| active | `opacity: 0.88` + `transform: scale(0.98)` (motion allowed only) |
| disabled | `opacity: 0.45; cursor: not-allowed` (while a submit is in-flight) |
| loading | Spinner replaces `ExternalLink` icon; button `disabled` |
| empty | Not rendered (card hidden when gates = []) |
| error | Row stays; error surfaced in the GateDetailModal |

The `aria-label` on each row button: `aria-label="ดูรายละเอียด {gate.id}"`. The `ExternalLink` secondary link keeps `aria-label="เปิด {gate.id} ใน Linear"`.

### 1e. Footer button — "อนุมัติทั้งหมด" + confirm step

Text changes from "ดูและอนุมัติทั้งหมด" to **"อนุมัติทั้งหมด"** (drop "ดู"). See Part 5 for confirm-step UX.

```css
/* .hud-appr-btn */
padding: 11px 14px;
min-height: 44px;
font-size: 12.5px;
font-weight: 700;
background: rgba(255,190,80,.18);
border: 1.5px solid rgba(255,190,80,.32);
border-radius: 13px;
box-shadow: inset 0 1px 0 rgba(255,220,130,.18);
color: rgba(255,200,80,.9);
```

Hover (amber glow — same as CAM-182):
```css
background: rgba(255,190,80,.26);
border-color: rgba(255,190,80,.50);
box-shadow: 0 0 10px rgba(255,160,52,.2), inset 0 1px 0 rgba(255,220,130,.22);
```

Focus-visible:
```css
outline: 2px solid rgba(91,233,176,.8);
outline-offset: 2px;
```

### 1f. Amber crown stripe — keep from CAM-182

`.hud-appr-head::before` (the 2px gradient crown) is unchanged. It must be present on the amber-tinted card.

### 1g. All 8 states — ApprovalCard

| State | Spec |
|---|---|
| default (expanded) | Amber-tinted glass + crown stripe + `apprCardGlow` animation + clickable rows + footer CTA |
| default (collapsed) | Mini row: amber-tinted glass (same bg) + heading + count + "อนุมัติทั้งหมด" button (36px min — acceptable compact) |
| hover (row / button) | Brighter amber bg + stronger border; described per element above |
| focus-visible | Teal `outline: 2px solid rgba(91,233,176,.8)` on whichever element is focused |
| active | `scale(0.98)` + `opacity: 0.88` on button/row (motion allowed) |
| loading | Spinner in CTA, rows disabled (while approve-all in flight) |
| empty | Card not rendered (`gates.length === 0` guard unchanged) |
| error | Error surfaces in GateDetailModal; card stays, CTA re-enables |
| disabled | Rows + CTA `opacity:.45; cursor:not-allowed` while any fetch in-flight |
| reduced-motion | No `apprCardGlow`, no `scale` on active; amber glass + border hold statically |

---

## Part 2 — GateDetailModal (new component)

### 2a. Modal surface — scene-glass treatment

Mirror `.hud-modal-box` exactly for surface tokens:

```css
/* .hud-gate-modal-box */
width: min(520px, 94vw);
max-height: 86vh;
overflow-y: auto;
background: rgba(11,30,24,.68);
backdrop-filter: saturate(195%) blur(34px);
-webkit-backdrop-filter: saturate(195%) blur(34px);
border: 1px solid rgba(255,190,80,.22);   /* amber-tinted border, not pure teal */
border-radius: 22px;
box-shadow:
  0 32px 72px rgba(0,0,0,.64),
  inset 0 1px 0 rgba(255,220,130,.12);    /* amber top highlight */
padding: 22px 24px 26px;
color: rgba(223,234,245,.9);
```

The border uses amber tint (`rgba(255,190,80,.22)`) rather than the teal `rgba(150,240,195,.13)` used on the KanbanModal — this visually binds the modal to the amber approval theme.

Scrim (backdrop):
```css
/* .hud-modal-backdrop (reuse existing class) */
background: rgba(4,8,22,.72);
```

Animation (reuse existing `modalIn`):
```css
@media (prefers-reduced-motion: no-preference) {
  .hud-gate-modal-box { animation: modalIn 200ms cubic-bezier(0.23,1,0.32,1) both; }
}
```

### 2b. Layout per wireframe C

```
┌── .hud-gate-modal-box ─────────────────────────────────────────────────────┐
│  .hud-gate-modal-head                                                        │
│  ┌─ .hud-gate-modal-icon ─┐  .hud-gate-modal-titles             [close ✕]   │
│  │  Square (amber bg)     │  .hud-gate-modal-key  (CAM-171)                 │
│  │  CheckSquare 18px      │  .hud-gate-modal-title (decoded title, 2 lines) │
│  └────────────────────────┘                                                  │
│  .hud-gate-modal-meta-row                                                    │
│  สถานะ: รอคุณ · ขั้น: Ship · บทบาท: DevOps                                   │
│  ─────────────────────────────────────────────────────────────────────────── │
│  .hud-gate-modal-desc                                                        │
│  <description text from Linear — pre-wrap, scrollable if long>              │
│  ─────────────────────────────────────────────────────────────────────────── │
│  .hud-gate-modal-reason-label  "เหตุผล (ถ้าจะส่งกลับ)"                        │
│  .hud-gate-modal-textarea      (optional, not required for Approve)          │
│  .hud-gate-modal-actions                                                     │
│  [ ✔ อนุมัติ ]   [ ↩ ส่งกลับ ]   ↗ เปิด Linear (ghost link)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Header:**

```css
/* .hud-gate-modal-head */
display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px;

/* .hud-gate-modal-icon */
width: 40px; height: 40px; border-radius: 10px; flex: none;
background: rgba(255,190,80,.18);
border: 1px solid rgba(255,190,80,.28);
display: flex; align-items: center; justify-content: center;
color: #FFB454;
/* icon: lucide CheckSquare, size 18 */

/* .hud-gate-modal-key */
font-family: var(--mono); font-size: 11px; color: #FFB454; font-weight: 700;
letter-spacing: .04em; margin-bottom: 3px;

/* .hud-gate-modal-title */
font-family: 'Outfit','Anuphan',system-ui,sans-serif;
font-size: 15px; font-weight: 700; color: #F1F6FB; line-height: 1.3;
```

Close button: `min-width: 44px; min-height: 44px` icon button (lucide `X`, 18px). Reuse `.hud-modal-close` class.

**Meta row:**

```css
/* .hud-gate-modal-meta */
font-size: 11.5px; color: rgba(223,234,245,.55);
display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
margin-bottom: 14px;
```

Meta pills: สถานะ / ขั้น / บทบาท separated by `·` in muted text. Values in slightly brighter `rgba(223,234,245,.8)`.

**Separator line:**

```css
/* .hud-gate-modal-sep */
height: 1px; background: rgba(255,190,80,.14); margin: 12px 0;
```

**Description block:**

```css
/* .hud-gate-modal-desc */
font-size: 12.5px; line-height: 1.6; color: rgba(223,234,245,.78);
white-space: pre-wrap; word-break: break-word;
max-height: 160px; overflow-y: auto;
scrollbar-width: thin; scrollbar-color: rgba(255,190,80,.2) transparent;
margin-bottom: 14px;
/* Loading state: skeleton pulse (2 lines) */
/* Empty state: "ไม่มีคำอธิบาย" in rgba(223,234,245,.35) italic */
```

**Reason textarea:**

```css
/* .hud-gate-modal-reason-label */
font-size: 11px; font-weight: 600; color: rgba(223,234,245,.55);
margin-bottom: 6px; display: block;

/* .hud-gate-modal-textarea */
width: 100%; border-radius: 10px;
background: rgba(255,255,255,.04); border: 1px solid rgba(255,190,80,.22);
color: rgba(223,234,245,.88); font-size: 12.5px; line-height: 1.5;
padding: 9px 11px; resize: vertical; min-height: 64px; max-height: 140px;
outline: none; font-family: inherit;
transition: border-color 120ms;

/* .hud-gate-modal-textarea:focus */
border-color: rgba(255,190,80,.5);
box-shadow: 0 0 0 2px rgba(255,190,80,.12);

/* .hud-gate-modal-textarea::placeholder */
color: rgba(223,234,245,.3);
```

`aria-label="เหตุผลในการส่งกลับ"` on the textarea. Placeholder: `เพิ่มเหตุผล (ไม่บังคับ)`.

**Action row:**

```css
/* .hud-gate-modal-actions */
display: flex; align-items: center; gap: 8px; margin-top: 16px; flex-wrap: wrap;
```

Three elements:
1. **อนุมัติ button** (primary amber): see confirm-step in Part 5.
2. **ส่งกลับ button** (secondary): see below.
3. **เปิด Linear link** (ghost): `<a href={gate.url} target="_blank" rel="noopener noreferrer">`.

```css
/* .hud-gate-btn-approve (primary) */
display: inline-flex; align-items: center; gap: 7px;
padding: 11px 18px; border-radius: 12px; min-height: 44px;
background: rgba(255,190,80,.22); border: 1.5px solid rgba(255,190,80,.40);
color: rgba(255,200,80,.95); font-size: 13px; font-weight: 700;
box-shadow: inset 0 1px 0 rgba(255,220,130,.20);
cursor: pointer; transition: background 120ms, border-color 120ms, box-shadow 120ms;
/* icon: lucide Check, size 15 */

/* hover */
background: rgba(255,190,80,.32); border-color: rgba(255,190,80,.60);
box-shadow: 0 0 12px rgba(255,160,52,.25), inset 0 1px 0 rgba(255,220,130,.24);

/* focus-visible */
outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px;

/* disabled (while submitting) */
opacity: 0.5; cursor: not-allowed;
```

```css
/* .hud-gate-btn-reject (secondary) */
display: inline-flex; align-items: center; gap: 7px;
padding: 11px 16px; border-radius: 12px; min-height: 44px;
background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
color: rgba(223,234,245,.72); font-size: 13px; font-weight: 600;
cursor: pointer; transition: background 120ms, border-color 120ms;
/* icon: lucide CornerDownLeft, size 15 */

/* hover */
background: rgba(255,255,255,.11); border-color: rgba(255,255,255,.22);
color: rgba(223,234,245,.92);

/* focus-visible */
outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px;

/* disabled (while submitting) */
opacity: 0.5; cursor: not-allowed;
```

```css
/* .hud-gate-link-linear (ghost anchor) */
margin-left: auto;    /* pushes to far right */
display: inline-flex; align-items: center; gap: 5px;
font-size: 11.5px; font-weight: 600;
color: rgba(223,234,245,.45); text-decoration: none;
padding: 6px 10px; border-radius: 8px; min-height: 44px;
transition: color 120ms, background 120ms;
/* icon: lucide ExternalLink, size 13 */

/* hover */
color: rgba(91,233,176,.8); background: rgba(91,233,176,.07);

/* focus-visible */
outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px;
```

### 2c. All 8 states — GateDetailModal

| State | Spec |
|---|---|
| default (open, data loaded) | Scene-glass amber-tinted modal; header + meta + description + textarea + action row all visible |
| hover | Per-element hover spec above (row/button/link) |
| focus-visible | Teal ring `2px solid rgba(91,233,176,.8); offset: 2px` on every control; focus-trapped inside modal |
| active | Approve/Reject buttons `scale(0.97)` + `opacity: 0.88` (motion allowed) |
| loading (data fetch) | Description block shows 2-line skeleton pulse; action buttons present but approve disabled until data resolves |
| error (fetch failed) | Description block shows `ดึงข้อมูลไม่ได้ กรุณาลองใหม่` in `rgba(255,120,90,.8)` with a Retry link; actions still functional (approve without detail) |
| empty (no description) | Description block shows `ไม่มีคำอธิบาย` in `rgba(223,234,245,.35)` italic; rest of modal normal |
| disabled | Both Approve + ส่งกลับ buttons `opacity:.5; cursor:not-allowed` while submit is in-flight; textarea read-only |
| closed | Modal unmounts; focus returns to the triggering row button or notification |
| reduced-motion | No `modalIn` scale animation; modal appears instantly; no `scale` on button press |

### 2d. a11y — GateDetailModal

- `role="dialog" aria-modal="true" aria-label="รายละเอียดงานรออนุมัติ"` on the modal box.
- **Focus trap**: on open, focus moves to the first focusable element (close button or Approve button). Tab cycles within the modal. Shift+Tab cycles backward. `Esc` closes and returns focus to the trigger.
- Close button: `aria-label="ปิด"` + `min-width: 44px; min-height: 44px`.
- Approve button: accessible name is its visible text `อนุมัติ` (or `ยืนยันอนุมัติ?` during confirm — see Part 5).
- ส่งกลับ button: accessible name `ส่งกลับ`.
- เปิด Linear link: `aria-label="เปิดใน Linear (เปิดแท็บใหม่)"` + `target="_blank" rel="noopener noreferrer"`.
- Textarea: associated `<label>` (or `aria-label="เหตุผลในการส่งกลับ"`).
- Contrast: `rgba(223,234,245,.9)` on `rgba(11,30,24,.68)` dark glass — not measured; mark "not measured, to be verified with axe on Staging". `#FFB454` on dark glass for icon/key — not measured.
- Tap target: all interactive controls ≥44px min-height/min-width.

---

## Part 3 — Notification `.you-alert` — smaller + suppress popover + remove green line

### 3a. Smaller sizes (owner-approved)

| property | current (CAM-182) | CAM-184 target |
|---|---|---|
| font-size | 13px | 12px |
| BellRing / icon size | 15px | 13px |
| padding | 7px 14px | 5px 11px |
| gap | 7px | 6px |
| min-height | 44px | 44px (preserve tap target) |
| min-width | 44px | 44px (preserve tap target) |
| border-radius | 13px | 12px |

The `min-height: 44px` and `min-width: 44px` are NON-NEGOTIABLE for tap target compliance. The outer dimensions cannot shrink below 44px; only the internal text/padding shrinks.

```css
/* .you-alert — updated */
font-size: 12px;
padding: 5px 11px;
gap: 6px;
border-radius: 12px;
min-height: 44px;
min-width: 44px;
/* everything else from CAM-182 unchanged */
```

```css
/* .you-alert svg (icon) */
width: 13px; height: 13px;
```

The icon choice from CAM-182 (owner-picked: `BellRing`) is used in the code; this spec reduces its rendered size only. If the owner chose `ClipboardCheck`, reduce that to 13px instead.

### 3b. Suppress `.popover` while a gate is pending (owner-approved)

When the scout has a gate, the hover popover (character name/role/hint) must NOT show. The notification is the priority surface and the clickable target.

Implementation rule:

```css
/* In SCENE_CSS — add immediately after existing .popover rules */
.scout.has-gate .popover {
  display: none;
  pointer-events: none;
}
```

Frontend applies class `has-gate` to `.scout.you` whenever `gates.length > 0`. The `display: none` is absolute — no fade, no partial opacity. When gates clear, the class is removed and the popover reverts to normal hover behaviour.

This is the overlap fix. No fragile `bottom` offset arithmetic is needed.

**Focus ring on `.you-alert` is NOT suppressed.** The `focus-visible` outline on the notification itself is teal (`rgba(91,233,176,.8)`) and must remain — it is the keyboard affordance for the notification, not the popover.

### 3c. Remove the green border lines near the notification (owner-approved)

The teal-green `--line` / `--line-2` borders on `.popover`, `.badge`, and `.pop-role` read as an unwanted colour association with the amber notification when both are in close proximity.

Changes:

| Element | Current border | Change |
|---|---|---|
| `.popover` | `border: 1px solid var(--line-2)` i.e. `rgba(150,240,195,.16)` | Change to `rgba(255,255,255,.10)` (neutral dark-glass border) |
| `.pop-role` | `border: 1px solid var(--line)` i.e. `rgba(150,240,195,.12)` | Change to `rgba(255,255,255,.08)` (neutral) |
| `.badge` | `border: 1px solid rgba(150,240,195,.13)` | Change to `rgba(255,255,255,.10)` (neutral) |

These three borders lose their teal tint and become a neutral dark-glass border. This is a "remove the green line" not a colour-to-amber change — keep them neutral, not amber.

**The focus ring is NOT changed.** `.you-alert:focus-visible { outline: 2px solid rgba(91,233,176,.8) }` stays teal — that is the WCAG focus affordance, not a decorative border.

**The `--line` and `--line-2` CSS variables themselves are NOT deleted** — they are used by other scene elements. Only the three specific borders listed above are re-assigned.

---

## Part 4 — Board awaiting cards alignment

### 4a. `.hud-card.awaiting` — confirm existing treatment

The KanbanModal board card already has:
```css
.hud-card.awaiting {
  border-color: rgba(255,150,52,.45);
  background: linear-gradient(160deg, rgba(255,150,52,.09), rgba(91,233,176,.04));
}
```

This is correct. **No change needed** to `.hud-card.awaiting`.

### 4b. `.hud-kc.gate` — align StatusBoard to amber-transparent (owner-confirmed)

The StatusBoard right-panel card `.hud-kc.gate` currently has:
```css
.hud-kc.gate {
  border-color: rgba(255,150,52,.45);
  background: linear-gradient(160deg, rgba(255,150,52,.09), rgba(91,233,176,.04));
}
```

This already matches the KanbanModal `.hud-card.awaiting` gradient. The alignment is done. **Confirm no change is needed**, unless Frontend finds a divergence in the JSX rendering path (in which case, apply the same gradient: `border-color: rgba(255,150,52,.45)` + `background: linear-gradient(160deg, rgba(255,150,52,.09), rgba(91,233,176,.04))`).

Both board representations must be visually identical for a gate card.

---

## Part 5 — Confirm step UX for Approve

### Spec (owner-approved: confirm before approve, no new dep, token-only, a11y)

**Inline morph approach (chosen):**

1. User presses "อนุมัติ" (in ApprovalCard footer or GateDetailModal).
2. The button text morphs in-place to **"ยืนยัน?"** and the button background brightens (stronger amber).
3. A dismiss timer of ~3s auto-reverts the button back to "อนุมัติ" if no second tap (prevents accidental confirm hanging open).
4. A second press of "ยืนยัน?" submits `POST /api/status/approve`.
5. During the POST: button shows a lucide `Loader` spinner (16px, `animate-spin`), `disabled`, text hidden.
6. On success: button becomes `Check` icon + "อนุมัติแล้ว" text (green-ish: `rgba(91,233,176,.95)`) for ~1.5s, then the modal closes / card removes.
7. On error: button reverts to "อนุมัติ", an inline error chip appears below the action row.

**For "อนุมัติทั้งหมด" (ApprovalCard footer, approve-all):** same morph — button becomes **"ยืนยัน? ({N} รายการ)"**, then submits each gate sequentially.

**CSS additions (inline morph, no extra element):**

```css
/* .hud-gate-btn-approve.confirm */
background: rgba(255,190,80,.36);
border-color: rgba(255,190,80,.68);
box-shadow: 0 0 14px rgba(255,160,52,.3), inset 0 1px 0 rgba(255,220,130,.26);
color: #FFB454;

/* .hud-gate-btn-approve.success */
background: rgba(91,233,176,.14);
border-color: rgba(91,233,176,.30);
color: rgba(91,233,176,.95);
box-shadow: none;
```

**a11y for confirm step:**
- When button morphs to "ยืนยัน?", add `aria-label="ยืนยันการอนุมัติ"` to ensure screen reader reads the intent, not just the visible text question mark.
- The morph must preserve `min-height: 44px` and `min-width: 44px`.
- Focus must stay on the button through the morph (do not move focus).
- Keyboard: Enter or Space triggers the second confirm.

**No new modal, no new dep.** Pure state in the component (`confirmPending: boolean`), cleared on a 3s timeout.

---

## Tokens (scene-scoped — exempt from `check:palette`)

All values are inside `app/status/map/` CSS strings (SCENE_CSS / HUD_CSS). No `app/globals.css` token changes required.

| Token / value | Role in CAM-184 |
|---|---|
| `#FFB454` (`--amber`) | Heading, icon fill, gate key, approve button text confirm state |
| `rgba(255,190,80,.09–.36)` | Row bg, button bg, icon container bg, confirm-state bg |
| `rgba(255,190,80,.22–.68)` | Row border, button border, modal border, confirm-state border |
| `rgba(40,26,6,.42)` | Amber-tinted glass base for ApprovalCard (NEW — scene-local only) |
| `rgba(11,30,24,.68)` | Modal box background (unchanged, mirrors KanbanModal) |
| `rgba(91,233,176,.8)` | Focus ring (all controls) |
| `rgba(91,233,176,.95)` | Success-state button text |
| `rgba(91,233,176,.14/.30)` | Success-state button bg/border |
| `rgba(255,255,255,.10)` | Neutral border for popover / badge / pop-role (replaces teal `--line`) |
| `rgba(255,220,130,.12–.26)` | Inset top highlight on modal + button |
| `rgba(255,150,52,.09)` | Board awaiting card gradient start (unchanged) |

No new OKLCH tokens added to `app/globals.css`. No `DESIGN.md` token table update needed.

---

## Icons (lucide only — CAM-184 additions)

| Element | Icon | Size | Note |
|---|---|---|---|
| GateDetailModal header icon | `CheckSquare` | 18px | Amber fill amber bg; `aria-hidden="true"` |
| GateDetailModal close button | `X` | 18px | `.hud-modal-close` class; `aria-label="ปิด"` |
| Approve button | `Check` | 15px | `aria-hidden="true"` |
| Approve button (success) | `Check` | 15px | Same icon, color changes |
| Approve button (loading) | `Loader` | 16px | `animate-spin`; replace icon + hide text |
| ส่งกลับ button | `CornerDownLeft` | 15px | `aria-hidden="true"` |
| เปิด Linear link | `ExternalLink` | 13px | `aria-hidden="true"` |

All icons from `lucide-react`. No emoji. No tabler icons (lucide-only for this scene per existing pattern).

---

## Copy (locales)

The `/status/map` scene currently uses inline Thai copy per existing pattern. The following keys are specified for this story. They may be hardcoded inline following the existing scene convention; a dedicated i18n extraction story should wire them to `locales/` in a follow-up.

| key | TH | EN |
|---|---|---|
| `map.approval_card.cta` | `อนุมัติทั้งหมด` | `Approve all` |
| `map.approval_card.cta_confirm` | `ยืนยัน? ({N} รายการ)` | `Confirm? ({N} items)` |
| `map.gate_modal.title_fallback` | `รายละเอียด` | `Detail` |
| `map.gate_modal.meta_status` | `สถานะ` | `Status` |
| `map.gate_modal.meta_stage` | `ขั้น` | `Stage` |
| `map.gate_modal.meta_role` | `บทบาท` | `Role` |
| `map.gate_modal.no_desc` | `ไม่มีคำอธิบาย` | `No description` |
| `map.gate_modal.desc_error` | `ดึงข้อมูลไม่ได้ กรุณาลองใหม่` | `Could not load details, please retry` |
| `map.gate_modal.reason_label` | `เหตุผล (ถ้าจะส่งกลับ)` | `Reason (if sending back)` |
| `map.gate_modal.reason_placeholder` | `เพิ่มเหตุผล (ไม่บังคับ)` | `Add reason (optional)` |
| `map.gate_modal.btn_approve` | `อนุมัติ` | `Approve` |
| `map.gate_modal.btn_approve_confirm` | `ยืนยัน?` | `Confirm?` |
| `map.gate_modal.btn_approve_success` | `อนุมัติแล้ว` | `Approved` |
| `map.gate_modal.btn_reject` | `ส่งกลับ` | `Send back` |
| `map.gate_modal.btn_linear` | `เปิด Linear` | `Open in Linear` |
| `map.gate_modal.close` | `ปิด` | `Close` |
| `map.gate_modal.aria_label` | `รายละเอียดงานรออนุมัติ` | `Gate detail` |

Thai copy rules: no em-dash as separator (commas/spaces used), no technical jargon (`API`, `webhook`, etc.) in user-visible strings.

---

## Error pattern

Per `form-patterns.md`:
- **GateDetailModal fetch error** (GET issue detail fails): inline error block inside `.hud-gate-modal-desc` area — not a floating ErrorBanner (this is a HUD scene, not a standard form). Text: `ดึงข้อมูลไม่ได้ กรุณาลองใหม่` with a retry button.
- **Approve POST error**: inline error chip below `.hud-gate-modal-actions` in `rgba(255,100,80,.8)` text. The Approve button reverts from "อนุมัติแล้ว" back to "อนุมัติ". No toast (no sonner in the scene).
- **ส่งกลับ POST error**: same inline chip below action row.
- **Approve-all partial error** (some gates fail): chip below ApprovalCard footer "อนุมัติสำเร็จ {X}/{N}" in amber text; failed gates remain in the list.

---

## Design Gate checklist (pre-merge)

- [ ] ApprovalCard background is amber-tinted glass (`rgba(40,26,6,.42)` base + amber border) in both expanded and collapsed states.
- [ ] `.hud-appr-badge` element is absent (priority badge removed) in JSX and CSS.
- [ ] Heading color is `#FFB454` at full opacity, weight 800.
- [ ] Each gate row is a `<button>` with `min-height: 44px` + `aria-label`.
- [ ] Footer CTA text is "อนุมัติทั้งหมด" (not "ดูและอนุมัติทั้งหมด").
- [ ] GateDetailModal renders with scene-glass background (`rgba(11,30,24,.68)`) + amber-tinted border (`rgba(255,190,80,.22)`).
- [ ] GateDetailModal has `role="dialog" aria-modal="true" aria-label="รายละเอียดงานรออนุมัติ"`.
- [ ] Focus trap is active inside GateDetailModal (Tab cycles within, Esc closes, focus returns to trigger).
- [ ] Close button is `min-width: 44px; min-height: 44px`.
- [ ] All action buttons ≥44px min-height.
- [ ] Approve confirm-step morphs button in-place to "ยืนยัน?" with `aria-label="ยืนยันการอนุมัติ"`, auto-reverts after ~3s.
- [ ] `.you-alert` font-size is 12px, icon is 13px, padding is 5px 11px, min-height/min-width hold at 44px.
- [ ] `.scout.has-gate .popover { display: none; pointer-events: none }` rule present and fires when `gates.length > 0`.
- [ ] `.popover` border is `rgba(255,255,255,.10)` (not `var(--line-2)`).
- [ ] `.pop-role` border is `rgba(255,255,255,.08)` (not `var(--line)`).
- [ ] `.badge` border is `rgba(255,255,255,.10)` (not `rgba(150,240,195,.13)`).
- [ ] `.you-alert:focus-visible` outline remains teal (unchanged).
- [ ] `.hud-card.awaiting` and `.hud-kc.gate` use matching amber gradient treatment.
- [ ] All icons are from `lucide-react`. No emoji anywhere.
- [ ] No hardcoded hex/px outside scene-scoped CSS strings (all inside `app/status/map/`).
- [ ] `@media (prefers-reduced-motion: no-preference)` wraps all new animations.
- [ ] All copy follows Thai rules (no em-dash separator, no jargon).
- [ ] `npm run lint` + `npm run typecheck` green.
- [ ] Contrast of `#FFB454` and `rgba(223,234,245,.9)` on dark glass — mark "not measured; verify with axe on Staging".

---

## a11y summary (WCAG 2.1 AA)

| Check | Spec |
|---|---|
| Keyboard operable | All new buttons/links keyboard-focusable; focus-trap in modal; Esc closes |
| Focus ring | `outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px` on every control (teal, consistent with scene) |
| Tap target ≥44px | All interactive controls: row buttons `min-height: 44px`, modal close `44px`, action buttons `min-height: 44px`, notification `min-height/width: 44px` |
| Accessible names | Row buttons `aria-label="ดูรายละเอียด {id}"`, close `aria-label="ปิด"`, Linear link `aria-label="เปิดใน Linear (เปิดแท็บใหม่)"`, confirm `aria-label="ยืนยันการอนุมัติ"`, modal `aria-label="รายละเอียดงานรออนุมัติ"` |
| Color not only signal | All amber elements paired with text or icon; success state pairs color with "อนุมัติแล้ว" text + Check icon |
| Contrast | Not measured — to be verified with axe on Staging (scene exempt from `check:palette`, dark glass + amber/white text; expected to pass at graphic-UI threshold) |
| Screen reader | Icons `aria-hidden="true"`, modal `role="dialog" aria-modal="true"`, popover suppression does not affect landmark structure |
| Reduced motion | All new keyframes wrapped in `@media (prefers-reduced-motion: no-preference)`; static states hold |

---

## Reference wireframes

- **Wireframe A** — Notification (smaller, suppressed popover, no green border): `/Users/tawatchaipetkaew/.claude/plans/option-2-virtual-cosmos.md` CAM-184 §A.
- **Wireframe B** — ApprovalCard (amber-transparent, no badge, clickable rows, "อนุมัติทั้งหมด"): same file §B.
- **Wireframe C** — GateDetailModal (scene-glass, header/meta/desc/textarea/actions): same file §C.

Anti-slop criteria that must pass at the design gate:
- No floating hex outside scene-scoped CSS.
- No purple gradients, no default shadows.
- No card-on-card nesting (modal is a single glass panel, not a card inside a card).
- Layout has clear hierarchy: amber crown → heading → gate list → primary CTA.
- Amber theme is coherent: notification, card, modal, and board awaiting cards all speak the same amber language.
- No emoji anywhere in JSX or CSS.

---

## Links

`../../epic.md` (CAM-150) · `DESIGN.md` · `story.md` (CAM-184) · `app/status/map/campsite-scene.tsx` (`.you-alert`, `.popover`, `.badge`, `.pop-role`, SCENE_CSS tokens) · `app/status/map/campsite-overlays.tsx` (`.hud-appr-*`, `.hud-card.awaiting`, `.hud-kc.gate`, HUD_CSS) · `/Users/tawatchaipetkaew/.claude/plans/option-2-virtual-cosmos.md` (wireframes A/B/C — locked)

## Changelog

- v1 (2026-06-25) — created; amber-transparent card + GateDetailModal + notification resize + popover suppress + green-line neutralise + confirm-step + board alignment.
