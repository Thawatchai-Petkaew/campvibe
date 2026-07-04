---
linear: CAM-228
feature: design-system-v2
epic: ui-consistency-hardening-clear-system-drift-guards (CAM-221)
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-27
---
# Design — A8 Designer-Judgment Drift (CAM-228)

## Decision Brief

This brief resolves the 8 remaining `check:ds` WARN instances so the guard can flip to blocking.
It does NOT change visible UI for any item — every decision preserves the rendered look.
Frontend implements component edits and guard allowlist. No new component code here.

---

## Decision Table

| # | Guard item | File(s) | Decision | Exact frontend action | Guard allowlist rule |
|---|---|---|---|---|---|
| 1a | R5a — `bg-foreground/50` avatar hover scrim | `app/profile/page.tsx:231` | **(c) accept + allowlist** — this is an image-overlay scrim on a circular avatar button, not a CTA. `bg-foreground/50` at half-opacity over an image is the correct light/dark-adaptive scrim idiom. Replacing it with any other token would require a custom overlay color. | No code change needed. | Add profile avatar scrim to allowlist: `app/profile/page.tsx` line bearing `bg-foreground/50 opacity-0 group-hover:opacity-100` — pattern: image overlay scrim, approved intentional use. |
| 1b | R5a — `bg-foreground/60 text-background` gallery count chip | `components/CampgroundDetailClient.tsx:442` | **(c) accept + allowlist** — this is a translucent dark caption badge overlaid on a photo (`backdrop-blur-sm`). `bg-foreground/60` is the correct adaptive scrim for text legibility on any photo in light or dark mode. It is not a CTA; it has no click target. | No code change needed. | Add gallery scrim chip to allowlist: `components/CampgroundDetailClient.tsx` line bearing `bg-foreground/60 text-background` — pattern: photo overlay caption chip, approved intentional use. |
| 2 | R5a+R5b — AmenitiesModal Close button (`bg-foreground hover:bg-foreground/90 text-background`) | `components/AmenitiesModal.tsx:88` | **(a) use existing `secondary` variant** — the secondary variant (`bg-secondary text-secondary-foreground`) is the correct dismissal-action style: neutral, full-width capable, and already in the system. The `bg-foreground text-background` idiom on a full-width footer button is unnecessary contrast inversion — it visually competes with a primary action and adds no hierarchy benefit for a close/dismiss. `outline` is also acceptable if a bordered style is preferred, but `secondary` is the leaner choice. | `AmenitiesModal.tsx:88` — replace `className="w-full bg-foreground hover:bg-foreground/90 text-background text-base font-medium"` with `variant="secondary"` (keep `size="lg"` and `className="w-full"`). Drop the manual color classNames entirely. | None — no allowlist entry needed once the inline color override is removed. |
| 3 | R5b — ghost-primary tint buttons (`variant="ghost" className="text-primary hover:bg-primary/5"`) | `app/bookings/page.tsx:252`, `app/dashboard/page.tsx:217` | **(c) accept + allowlist the `/5` hover pattern** — a ghost button with `text-primary` text and `hover:bg-primary/5` hover fill is a distinct, intentional role: a low-chrome "view details / see all" link-style action that stays on brand without the full primary fill. The ghost base variant uses `hover:bg-muted` which does not communicate the primary intent. This pattern appears identically in two product-utility surfaces (bookings + dashboard), confirming it is deliberate. Adding a new variant for a single-line hover tweak would over-engineer the system; allowlisting is the lean choice. | No code change needed — keep `variant="ghost" className="text-primary hover:bg-primary/5 ..."` as-is in both files. | Add to guard allowlist R5b: lines with `variant="ghost"` AND `text-primary` AND `hover:bg-primary/5` are approved — pattern: "ghost-primary" link-action on utility/dashboard surfaces. Allowlist regex: line matches `variant="ghost"` + `hover:bg-primary/5`. |
| 4 | R5a+R5b (and potentially R5b guard) — icon-chip tint backgrounds `bg-primary/10`, `bg-success/10`, `bg-warning/10`, `bg-info/10` | `app/dashboard/page.tsx` stat cards, host pages, layout-client active state | **(c) accept + allowlist** — these are small icon-chip background fills, not CTA surfaces. The `/10` opacity tint is a consistent, deliberate system pattern: tinted icon chip = the semantic color at low opacity to convey status without heavy saturation. Tokenizing as `--accent-subtle` etc. would touch many files and add tokens for a single opacity step that is already expressible via Tailwind's opacity modifier. The lean decision is to ratify the pattern in DESIGN.md and allowlist in the guard. No token addition is warranted. | No code change needed. Update `DESIGN.md` §3 to ratify the icon-chip pattern (done in this brief — see Token/DESIGN.md notes below). | Add to guard allowlist R5b: `bg-(primary|success|warning|info|destructive)/10` used as an icon-chip background (small icon container, not a Button or Badge className) is an approved pattern. Guard should skip lines where the match is inside a `<div` / `<span` icon-chip (not inside `<Button` or `<Badge`). Alternatively, since R5b currently triggers on `<Button`/`<Badge` lines only, the icon-chip usages on `<div`/`<span` may already be outside the rule scope — verify in the guard scan. If they do not currently trigger, no allowlist addition is needed beyond the DESIGN.md ratification. |
| 5 | Textarea `rounded-2xl` primitive radius | `components/ui/textarea.tsx` | **(c) accept — primitive, already excluded** — `rounded-2xl` on a textarea is the correct popover/content-area radius for a tall multi-line field. `rounded-full` would look wrong on a tall field; `rounded-3xl` is for card/modal shells. The guard already excludes `components/ui/**`, so this never appears in the report. Confirm: not a guard issue. | No action needed. | No allowlist needed — `components/ui/**` is excluded. |
| 6 | Checkbox `rounded-[5px]` primitive | `components/ui/checkbox.tsx` | **(c) accept — primitive, already excluded** — `rounded-[5px]` is the Radix/shadcn checkbox control micro-radius (standard for a 16px checkbox square). The guard excludes `components/ui/**`, so this does not appear in the report. The blocking rule `rounded-[Npx]` only applies to consumer files. Confirm: not a guard issue. | No action needed. | No allowlist needed — `components/ui/**` is excluded. |
| 7 | Tabs variant radii (`rounded-full`, `rounded-2xl` in TabsList/TabsTrigger) | `components/ui/tabs.tsx` | **(c) accept — primitive, already excluded** — these are primitive-internal radius values matching the role-scale (list pill = `rounded-full`, vertical list = `rounded-2xl`, trigger = `rounded-full`). The guard excludes `components/ui/**`. Confirm: not a guard issue. | No action needed. | No allowlist needed — `components/ui/**` is excluded. |

---

## Guard target after frontend applies this brief

After item 2 (AmenitiesModal) is fixed and items 1a/1b/3 are allowlisted:

- R5a: 0 real violations (the 4 profile/CampgroundDetail scrim hits → allowlisted; AmenitiesModal Close → variant swap removes the bg-foreground classname).
- R5b: 0 real violations (bookings/dashboard ghost-primary → allowlisted).
- R1/R2/R3/R4/R6/R7/R8: already 0.
- Items 4/5/6/7: already 0 or outside guard scope.

`npm run check:ds` reports 0 after the allowlist is applied and the AmenitiesModal className is removed.

---

## DESIGN.md additions (this file, no globals.css token needed)

No new token is required. One ratification note is added to DESIGN.md §3 (Component contracts) to make the icon-chip tint pattern a named, intentional idiom rather than undocumented drift. The addition also records the ghost-primary pattern.

See the "DESIGN.md delta" section below.

---

## DESIGN.md delta (add to §3 — Other components, after the status-label Badge row)

Add the following rows to the "Other components" table in §3:

```
| icon-chip background (stat cards, active nav item) | `<div>` / `<span>` carrying the icon | `bg-(primary|success|warning|info|destructive)/10` — tinted 10% fill; pair with matching `text-(color)-foreground` icon; NOT a Button/Badge className | ❌ do not use on clickable Button or Badge (use variant instead) |
| ghost-primary link-action (utility surfaces) | `<Button variant="ghost">` | add `className="text-primary hover:bg-primary/5"` — use only on low-chrome "view / go" actions on product-utility pages (dashboard, bookings list); NOT on public/marketing pages | ❌ do not use as a primary CTA or on brand/marketing surfaces (use `default` or `link` variant instead) |
```

Also add a **"Image-overlay scrim"** note to §2 Color rules:

```
- `bg-foreground/50` or `bg-foreground/60` over an image (avatar hover scrim, gallery caption chip) is an approved intentional use of `bg-foreground` at opacity — this is the correct light/dark-adaptive overlay idiom. Not a CTA. Not flagged by the DS guard.
```

---

## States

This story has no new interactive states — it is a mechanical variant swap and allowlist. The AmenitiesModal Close button changing from `bg-foreground` to `secondary` variant:

| State | secondary variant behavior (no change needed) |
|---|---|
| default | `bg-secondary text-secondary-foreground` |
| hover | `hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]` |
| focus | `focus-visible:ring-ring/30` (inherited from Button base) |
| active | `active:scale-95` (inherited) |
| disabled | `disabled:opacity-50` (inherited) |
| loading | spinner inside button (not applicable here — it's a close action) |
| empty | N/A |
| error | N/A |

---

## a11y

- AmenitiesModal Close: `secondary` variant on a full-width `size="lg"` button = `h-12`, tap target 48px, WCAG 2.1 AA tap target satisfied.
- `secondary` token on white background: `--secondary` is `oklch(0.967 0.001 286.375)` with `--secondary-foreground` `oklch(0.21 0.006 285.885)` — contrast is not measured here (mark: **not measured**; existing token pair is part of the system and was approved at design-system-v2 token definition). Visually: near-white background with dark-navy text = high contrast, consistent with all other secondary buttons in the app.
- Ghost-primary buttons (no change): existing `text-primary` on `background` — `--primary` OKLCH `0.511 0.096 186.391` on white `1 0 0` — **not measured**; `primary` token is the brand teal used throughout; consistent with all other primary-text elements.
- Icon-chip scrim overlay (no change): `bg-foreground/60 text-background` on a dark photo — opacity overlay means actual contrast depends on the underlying image, which is acceptable for decorative photo captions. The count text is supplementary (the full gallery is accessible via the button).

---

## Components used

- `Button` (`components/ui/button.tsx`) — item 2 swap to `variant="secondary"`.
- No new components.

---

## Copy

No copy changes. No new i18n keys.

---

## Links

- `../../epic.md`
- `../../feature.md`
- `/Users/tawatchaipetkaew/Claude/Projects/CAMPVIBE/DESIGN.md` §2 §3 §5
- `story.md` (AC rows 1–5)
- `components/ui/button.tsx` — secondary variant definition
- CAM-221 (epic) · CAM-223 (guard setup) · CAM-226 (A3 mechanical sweep that deferred these)

## Changelog

- v1 (2026-06-27) — initial design brief; decisions for all 8 remaining guard instances
