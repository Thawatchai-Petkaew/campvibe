---
linear: CAM-60
feature: bookings-trips
epic: camper-pre-trip-my-bookings (CAM-24)
persona: camper
artifact: design
owner: ux-designer
status: Backlog
version: v1
updated: 2026-06-23
---
# Design — Status label การจองแปลเป็นภาษาไทย (CAM-60)

## Flow

Camper logs in → opens `/bookings` → sees list of booking cards → each card has a status `Badge` overlaid on the camp image (top-left, `absolute top-4 left-4`) → badge shows the localised label in the active language (th or en) with a semantic color variant.

Flow is display-only. No interaction on the badge itself. The badge renders as part of the existing booking card layout.

## Status → label → variant table (the four mappings locked in)

| `Booking.status` | Thai label (th) | English label (en) | Badge variant | Color intent | i18n key |
|---|---|---|---|---|---|
| `PENDING` | รอยืนยัน | Pending | `warning` | yellow | `bookings.statusPending` |
| `CONFIRMED` | ยืนยันแล้ว | Confirmed | `success` | green | `bookings.statusConfirmed` |
| `CANCELLED` | ยกเลิกแล้ว | Cancelled | `muted` | gray | `bookings.statusCancelled` |
| `COMPLETED` | เข้าพักแล้ว | Completed | `info` | blue | `bookings.statusCompleted` |
| unknown / future | raw `status` string | raw `status` string | `muted` | gray | — (no key, render raw) |

Note on current code: `statusVariant()` in `app/bookings/page.tsx` (line 38) maps only 3 statuses and sends CANCELLED to `destructive` (red). This must change: CANCELLED maps to `muted` (gray) per AC#3. The `destructive` variant is reserved for error/delete actions, not a neutral past-state.

## Badge variant decision: `warning` and `info` do NOT exist — must be added

Audit of `components/ui/badge.tsx` (the full variant map as of 2026-06-23):
- Existing variants: `default`, `secondary`, `destructive`, `success`, `muted`, `outline`, `ghost`, `link`
- `warning` — ABSENT
- `info` — ABSENT

Audit of `app/globals.css`:
- Existing semantic tokens: `--success` / `--success-foreground`, `--destructive`, `--muted` / `--muted-foreground`, `--primary`, `--secondary`, etc.
- `--warning` / `--warning-foreground` — ABSENT
- `--info` / `--info-foreground` — ABSENT

**Decision: add `--warning`, `--warning-foreground`, `--info`, `--info-foreground` tokens to `app/globals.css` (light + `.dark`), update `DESIGN.md` token table, then add `warning` and `info` variants to `badge.tsx`.** No hardcoded hex is permitted at any step.

### Required new tokens (Frontend adds these in `app/globals.css`)

Token values are specified as OKLCH, consistent with the existing teal-tinted palette. The exact values below are the Designer's specification; Frontend must use them verbatim.

**Light (`:root`):**

| CSS custom property | OKLCH value | Approx visual |
|---|---|---|
| `--warning` | `oklch(0.769 0.188 70.08)` | amber/yellow-orange |
| `--warning-foreground` | `oklch(0.148 0.004 228.8)` | dark navy (same as `--foreground`) |
| `--info` | `oklch(0.511 0.130 237.0)` | blue |
| `--info-foreground` | `oklch(0.984 0.014 180.72)` | near-white (same as `--primary-foreground`) |

**Dark (`.dark`):**

| CSS custom property | OKLCH value | Approx visual |
|---|---|---|
| `--warning` | `oklch(0.879 0.169 91.605)` | lighter amber (chart-1 hue, readable on dark bg) |
| `--warning-foreground` | `oklch(0.148 0.004 228.8)` | dark navy |
| `--info` | `oklch(0.637 0.143 237.0)` | lighter blue |
| `--info-foreground` | `oklch(0.148 0.004 228.8)` | dark navy |

Note: `--warning` in light reuses the chart-2 OKLCH hue (70.08) which is distinctly yellow-amber. `--info` uses hue 237 (blue), clearly distinct from teal (hue ~186–197). These do not conflict with any existing token.

### Required new badge variants (Frontend adds to `badge.tsx`)

Following the exact pattern of the existing `success` and `destructive` variants (10% fill, foreground color, 30% border, focus ring at 20%/40% dark):

```
warning:
  "bg-warning/10 text-warning-foreground border-warning/30 focus-visible:ring-warning/20 dark:bg-warning/20 dark:focus-visible:ring-warning/40 [a]:hover:bg-warning/20"

info:
  "bg-info/10 text-info border-info/30 focus-visible:ring-info/20 dark:bg-info/20 dark:focus-visible:ring-info/40 [a]:hover:bg-info/20"
```

Note on `info` text: `text-info` (the token itself) is used, paralleling `text-success` and `text-destructive` which reference the base token, not the foreground. This means the badge text will be the `--info` color on the `--info/10` fill — consistent with the success/destructive pattern. The `--info-foreground` token remains available for filled (non-tinted) uses in future components.

### DESIGN.md token table update (Designer-owned — must be synced by Frontend at same time)

Add two rows to the §2 Color table:

| token | light | dark | use for | do not use for |
|---|---|---|---|---|
| `warning` / `warning-foreground` | `0.769 0.188 70.08` / `0.148 0.004 228.8` | `0.879 0.169 91.605` / `0.148 0.004 228.8` | pending/awaiting states, caution signals | error (use destructive) |
| `info` / `info-foreground` | `0.511 0.130 237.0` / `0.984 0.014 180.72` | `0.637 0.143 237.0` / `0.148 0.004 228.8` | completed/informational states, neutral signals | primary actions (use primary) |

## Shared util — `lib/booking-status.ts` (critical seam for CAM-61)

Frontend MUST build the status → `{labelKey, variant}` mapping in a standalone util at `lib/booking-status.ts`, not inline in `app/bookings/page.tsx`. CAM-61 (booking detail page) will import this same util so the mapping is defined exactly once.

The util signature Frontend should implement:

```ts
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
export type BadgeVariant = "warning" | "success" | "muted" | "info";

export interface BookingStatusMeta {
  labelKey: string; // key into the translations object, e.g. "statusPending"
  variant: BadgeVariant;
}

export function getBookingStatusMeta(status: string): BookingStatusMeta {
  // known statuses return the mapped meta; unknown → fallback muted with no key
}
```

The `page.tsx` then reads: `const { labelKey, variant } = getBookingStatusMeta(booking.status)` and passes `variant` to `<Badge>` and `t.bookings[labelKey]` (or the raw `booking.status` for fallback) as the text child.

## States (8)

The badge is non-interactive (display only), so hover/active/focus/disabled are specified as they apply to the badge in context.

| State | What the user sees |
|---|---|
| **default** | Badge rendered with the correct variant color + localised text label, positioned `absolute top-4 left-4` over the card image |
| **hover** | Badge has no hover change (non-interactive); the card itself has `hover:shadow-md transition-shadow` (existing) |
| **focus** | Badge is non-focusable (it is a `<span>`, not a button); no focus ring required — the status is also readable as plain text |
| **active** | N/A (non-interactive) |
| **loading** | While bookings are loading, the badge does not render (the `LoadingSpinner` state is already handled by the existing page loading branch) |
| **error** | If `status` is unknown/future value, badge renders raw string in `muted` variant (AC#9 fallback) — no crash, no thrown error |
| **empty** | No bookings → no badge rendered (existing empty state with `Tent` icon handles this) |
| **disabled** | N/A (non-interactive) |

## i18n — copy keys in `locales/translations.json`

Frontend adds the following keys to the `bookings` section of BOTH the `en` and `th` objects in `locales/translations.json`. The Thai copy below is verbatim from AC Rules.

**Thai (`th.bookings`):**

```json
"statusPending": "รอยืนยัน",
"statusConfirmed": "ยืนยันแล้ว",
"statusCancelled": "ยกเลิกแล้ว",
"statusCompleted": "เข้าพักแล้ว"
```

**English (`en.bookings`):**

```json
"statusPending": "Pending",
"statusConfirmed": "Confirmed",
"statusCancelled": "Cancelled",
"statusCompleted": "Completed"
```

No em-dash separators. No technical jargon. All copy is plain, action-oriented Thai.

## Components and tokens used

- **Component:** `Badge` from `components/ui/badge.tsx` with new `warning` and `info` variants (existing `success` and `muted` variants already available)
- **Radius:** `rounded-xl` — Badge already has this in its base `cva` class (correct per §2 decision matrix: "inner element / badge / small inset → `rounded-xl`")
- **Tokens referenced:** `--warning`, `--warning-foreground`, `--info`, `--info-foreground` (new, added by this story), `--success`, `--success-foreground` (existing), `--muted`, `--muted-foreground` (existing)
- **No new component invented.** The mapping util (`lib/booking-status.ts`) is a plain TypeScript file, not a UI component.
- **Icons:** none added for the badge label. Text conveys the status; color reinforces it. No icon needed (lean).
- **Existing positioning:** `absolute top-4 left-4` with `ring-2 ring-card shadow-sm` stays unchanged.

## a11y

- **Color not the only signal:** the badge renders the localised text label (e.g. "รอยืนยัน") as visible text inside the badge. Status is conveyed by text first, color second. This satisfies WCAG 2.1 SC 1.4.1 (Use of Color) and the AC#a11y requirement without adding an `aria-label` — the visible text is the accessible name. No extra aria attribute is needed.
- **Contrast (not measured — token-based):** The badge uses a 10%-fill tint with the token's foreground text on it. For `warning`: `text-warning-foreground` is `oklch(0.148…)` dark navy on `bg-warning/10` which is near-white amber tint — **not measured with a tool**; the tint pattern (10% fill) used by `success` and `destructive` variants passes in practice. Frontend must verify with axe before merge.
- **Touch target:** the badge is non-interactive; tap target rule (≥44px) does not apply.
- **Focus ring:** badge is a `<span>` (non-focusable). No focus ring required. The `focus-visible` ring defined in the variant cva only triggers if the badge is used as an anchor (`[a]`), which it is not here.
- **Screen reader:** the localised text content of the badge is readable by screen readers directly. No `aria-hidden` or `aria-label` change required.

## No-CLS note

The badge is positioned absolutely over an image. Its size is constrained by `text-xs font-medium whitespace-nowrap` (already in the base cva). Switching from the raw English string to a Thai label changes the badge width slightly (e.g. "CONFIRMED" → "ยืนยันแล้ว" is roughly similar width). Because the badge is `absolute` it does not participate in document flow and cannot cause layout shift. CLS risk: none.

## Design gate checklist

- [x] Token-only: no hardcoded hex/px — new tokens specified as OKLCH; badge variants use `bg-warning/10`, `text-warning-foreground`, etc. from the token layer
- [x] `warning` and `info` variants do not exist and must be added — specified with exact OKLCH values for light and dark, following the existing success/destructive pattern
- [x] CANCELLED changes from `destructive` → `muted` (current behavior violates semantic intent; destructive = delete/error, not past-neutral)
- [x] All 4 AC status → variant mappings locked in this brief
- [x] Unknown status falls back to `muted` with raw string, no crash (AC#9)
- [x] i18n: all 4 keys in `locales/translations.json` (th + en), verbatim Thai from AC Rules, no em-dash, no jargon
- [x] a11y: status conveyed by visible text label, not color alone — satisfies SC 1.4.1; contrast not measured with tool (mark: **not measured**)
- [x] No-CLS: absolute-positioned badge, no layout shift risk
- [x] Shared util `lib/booking-status.ts` specified so CAM-61 reuses the same mapping without duplication
- [x] Token changes must land in both `app/globals.css` (OKLCH + `.dark`) and `DESIGN.md` token table at the same time — Frontend must not split these across separate commits

## Links

`../../feature.md` · `DESIGN.md` · `story.md` (AC#1–9, Rules) · `components/ui/badge.tsx` · `app/bookings/page.tsx` (line 38 `statusVariant`, line 149 Badge render) · `locales/translations.json` (section `bookings`)

## Changelog

- v1 (2026-06-23) — created; audited badge.tsx and globals.css; confirmed `warning` and `info` absent; specified new tokens + variants; locked 4-status table; specified shared util seam for CAM-61
