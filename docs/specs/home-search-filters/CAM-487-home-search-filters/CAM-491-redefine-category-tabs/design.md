---
linear: CAM-491
feature: home-search-filters
epic: CAM-487-home-search-filters
persona: CAMPER
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-25
---
# Design — Redefine Home category tabs to real filterable dimensions (CAM-491)

## User job
A camper on the Home page taps a category tab to narrow the camp list to a real
attribute (camp type or terrain) and **sees actual results**, instead of tapping
GLAMP / LAKE / VIEW / BAOT and hitting an always-empty list.

**Flow:** Home (`/`) → tap a tab in `CategoryBar` → tab writes ONE category param
to the `/?` query string → `app/page.tsx` re-renders → `buildCampSiteWhere` maps
the param to a `where` that hits data that exists → `CatalogResults` shows camps
(or the shared empty state if a valid tab genuinely has none).

## The bug being fixed (diagnosed)
Current tabs (`components/CategoryBar.tsx:22-31`) all push their code as `type=`,
which `campSiteType` (exact-equality) only holds as `CAGD`/`CACP`. So `GLAMP`,
`LAKE`, `FOREST`, `VIEW`, `BAOT` return **0 results, always** — they are
terrain/access/feature dimensions wrongly aimed at `campSiteType`. Fix = redefine
the tab set so each tab drives the param whose backing field actually exists
(`type` for campSiteType, `terrain` for Terrain codes, `access` for Access codes).

## Real MasterData backing (verified in `prisma/seed.ts`)
- `Campground type` (→ param `type`, campSiteType exact match): `CAGD`, `CACP`.
- `Terrain` (→ param `terrain`, `options.some.code`, CSV multi): `BEAC`, `FORE`, `RIVE`, `MTNS`.
- `Access type` (→ param `access`, `options.some.code`, CSV multi): `BAOT`, `DRIV`, `HIKE`, `WALK`.

## 1. New tab set (recommended)
Keep **ทั้งหมด / All** as the default (no param). Seven tabs total = the owner's
2026-07-25 set (Campground/Car-camping type + Beach/Forest/Mountain/River terrain).

| # | Label TH | Label EN | locale key | Param | Value | lucide icon |
|---|----------|----------|-----------|-------|-------|-------------|
| 1 | ทั้งหมด | All | `all` | (none) | — | `Mountain` |
| 2 | ลานกางเต็นท์ | Campground | `campground` | `type` | `CAGD` | `Tent` |
| 3 | แคมป์ด้วยรถ | Car camping | `carCamping` | `type` | `CACP` | `Caravan` |
| 4 | ชายหาด | Beach | `beach` | `terrain` | `BEAC` | `Palmtree` |
| 5 | ป่า | Forest | `forest` | `terrain` | `FORE` | `Trees` |
| 6 | ภูเขา | Mountain | `mountain` | `terrain` | `MTNS` | `Mountain` |
| 7 | ริมน้ำ | Riverside | `riverside` | `terrain` | `RIVE` | `Waves` |

**Info (optional 8th tab):** `BAOT` (เข้าถึงด้วยเรือ / Boat access → param `access`,
value `BAOT`) has real backing camps (Railay, etc.). Left OUT of the recommended
set to match the owner's explicit list; add only if the owner wants it. If added,
it drives `access=BAOT`, **never** `type=`.

Every recommended tab maps to a dimension with real backing camps today; CAM-492
expands data to fully back every code in parallel.

## 2. Param-mapping table (Frontend implements exactly)
Rule (**Critical**): a tab must **NEVER** emit a `type=` value that isn't a real
`campSiteType` (only `CAGD`/`CACP`). Terrain tabs emit `terrain=`; access tabs
(if any) emit `access=`.

| Tab | On click: set | On click: delete (mutual-exclude the other category params) |
|-----|---------------|-------------------------------------------------------------|
| ทั้งหมด | — | `type`, `terrain`, `access` (clear category dimension) |
| ลานกางเต็นท์ | `type=CAGD` | `terrain`, `access` |
| แคมป์ด้วยรถ | `type=CACP` | `terrain`, `access` |
| ชายหาด | `terrain=BEAC` | `type`, `access` |
| ป่า | `terrain=FORE` | `type`, `access` |
| ภูเขา | `terrain=MTNS` | `type`, `access` |
| ริมน้ำ | `terrain=RIVE` | `type`, `access` |

**BR — one category dimension at a time.** The tab bar is a single-select
control, so selecting a tab clears the *other* category params it does not own
(keeps `keyword`, `province`, `min/max`, `guests`, `facilities`, etc. untouched —
only `type`/`terrain`/`access` are the tab's territory). This prevents a stale
`type=CAGD` sticking under a newly-tapped `terrain=BEAC`.

**BR — active-tab detection.** Read the param the tab owns:
- `all` active ⇔ none of `type`/`terrain`/`access` is set.
- a `type` tab active ⇔ `type` === its value.
- a `terrain` tab active ⇔ `terrain` === its single value (exact, no comma).
  If `terrain` is a multi-value CSV set via FilterModal (e.g. `BEAC,FORE`), NO
  single tab is active — `all` is not active either; the bar shows nothing
  highlighted, which is correct (the selection came from the modal, not the bar).

## 3. States (8) — reuse the existing `CategoryBar` underline-tab styling
The tab *button* itself has no async dependency; the async surface is the
**results grid below**, which already has its loading/empty/error handled.

| State | Behavior |
|-------|----------|
| default | `border-transparent text-muted-foreground`, icon `stroke-1`. |
| hover | `text-foreground border-border`, icon `stroke-2` (existing `group-hover`). |
| **focus** | **Critical gap in current code — add.** Current `CategoryBar` button has NO visible focus ring. Frontend MUST add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md` (WCAG 2.1 AA, DESIGN.md §5 `ring-ring`). |
| active/selected | `border-foreground text-foreground`, icon `stroke-2`. Not color-only — the underline + weight change carry the state too (color-not-only ✓). |
| disabled | **N/A** (tabs are always enabled). Stated with reason, per DESIGN.md. |
| loading | Tab bar (chrome) stays visible on click. The route transition streams the results grid behind its existing `<Suspense>` → `CampgroundGridSkeleton` (chrome renders instantly, section-level skeleton only — `.claude/rules/loading.md`). No loader is added to the tab bar itself. |
| empty | When a valid tab genuinely has no matches, the grid renders the **existing** `components/EmptyState.tsx` with `emptyState.noResults` = TH `ไม่พบผลลัพธ์ที่ตรงกัน` / EN `No exact matches` + `emptyState.adjustFilters` + `emptyState.clearFilters`. No new copy needed. (Rare once CAM-492 backs every code.) |
| error | Results fetch failure surfaces in `CatalogResults` via the existing error surface (ErrorBanner pattern) — **out of `CategoryBar` scope**, noted for completeness. |

**Responsive / mobile:** keep the existing horizontal-scroll row
(`overflow-x-auto no-scrollbar`, `gap-8`, `min-w-[64px]` per tab). 7 tabs scroll
horizontally on narrow screens — no wrap, no change to the layout idiom.

**Tap target:** each tab is `min-w-[64px]` wide and ~60px tall (icon `h-6` + gap +
`text-xs` + `pb-3`), meeting ≥44px by construction. **Not independently
measured** — Frontend to confirm on render.

**Contrast:** uses existing `text-muted-foreground` / `text-foreground` /
`border-foreground` token pairings already in the system (assumed AA per
DESIGN.md tokens). **Not re-measured** for this change — no new color introduced.

## 4. Interaction with FilterModal / SearchModal — flag
Tabs and `FilterModal` write to the **same `/?` query string**. Known pre-existing
bug: `FilterModal` does **not hydrate from the URL** — the init `useEffect` is a
commented-out stub (`components/FilterModal.tsx:142-162`), and on "Show" it
rebuilds every param from its (empty) local state, so **reopening the modal wipes
a param the tab just set** (e.g. tap ริมน้ำ → `terrain=RIVE`, open modal, tap Show →
`terrain` deleted). This is a real, visible conflict once both controls are used
together.

**Recommendation: DEFER the FilterModal hydration fix to a sibling story.**
- CAM-491 is a single-surface change (`CategoryBar.tsx` + `locales/`). The
  hydration fix touches a different component and needs its own reverse mapping
  (param → section id, e.g. `terrain` → `'Terrain'` section) plus its own AC and
  tests — that is a separate atomic story, not this diff (STOP RULE 3: don't
  touch a file outside this dispatch's surface).
- Flagging the risk: **Important** — until the sibling story lands, a camper who
  taps a tab and then opens+applies FilterModal loses the tab selection. Acceptable
  short-term because each control works correctly on its own; the loss only occurs
  on combined use. Create the sibling story (`fix FilterModal URL hydration`) under
  the same epic CAM-487.

## 5. Design Gate class
**Standard reuse (`standard`).** No new screen, flow, token, or component:
- Reuses the existing `CategoryBar` underline-tab pattern (only the tab data +
  param routing change) and the existing `EmptyState` for the empty result.
- No palette/token change → `check:palette` + `check:ds` stay green.
- The ONE net-new UI requirement is the **focus ring** (a11y fix, tokened
  `ring-ring`) — a correction to an existing gap, not a new pattern.

Routes through the pre-authorized standard G2 class **provided** the focus-ring
a11y fix lands; if it is skipped, the story fails the Design Gate (§5 "missing
focus state" = Critical, blocks merge).

## Locale changes (Frontend, TH + EN in `locales/translations.json`)
Replace the stale `categories` keys (`glamping`/`lakefront`/`views`/`boatAccess`)
with the new set. Keys + verbatim copy:

| key | TH | EN |
|-----|-----|-----|
| `all` | ทั้งหมด | All |
| `campground` | ลานกางเต็นท์ | Campground |
| `carCamping` | แคมป์ด้วยรถ | Car camping |
| `beach` | ชายหาด | Beach |
| `forest` | ป่า | Forest |
| `mountain` | ภูเขา | Mountain |
| `riverside` | ริมน้ำ | Riverside |

Thai copy passes the rules: no em-dash separator, no technical jargon, plain
human terms. Remove the four now-unused keys in BOTH language blocks (grep for
other consumers of `categories.glamping|lakefront|views|boatAccess` first —
expected only `CategoryBar`).

## a11y (WCAG 2.1 AA)
- **Visible focus ring** on every tab button (`ring-ring`) — the one required
  addition (see States/focus).
- State is not color-only: active carries an underline + icon-weight change.
- Tap target ≥44px (by construction; confirm on render).
- Contrast via existing tokens (not re-measured; no new color).
- Consider `role="tablist"`/`aria-selected` on the bar OR keep plain buttons with
  an accessible name from the visible label — Frontend's call; each tab already
  has a text label, so it has an accessible name.

## Reference + anti-slop
Reference: Airbnb-style category rail (the pattern `CategoryBar` already
implements). Anti-slop criteria that MUST pass: token-only (no floating hex/px),
clear hierarchy (active underline + weight), holds the CampVibe tone, reuses the
system component rather than inventing one, focus ring present.

## Out of scope
- FilterModal URL hydration (→ sibling story under CAM-487).
- Backing every code with data (→ CAM-492, parallel).
- Any change to `buildCampSiteWhere` (it already supports `type`/`terrain`/`access` correctly).

## Links
`DESIGN.md` (§2 tokens, §5 states, §6 Design Gate) · `.claude/rules/loading.md`
(results skeleton) · `components/CategoryBar.tsx` · `lib/campsite-filters.ts` ·
`components/EmptyState.tsx` · `prisma/seed.ts` (MasterData codes).

## Changelog
- v1 (2026-07-25) — created
