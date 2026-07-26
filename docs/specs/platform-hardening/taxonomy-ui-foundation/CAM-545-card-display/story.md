## Story
As a **Camper** browsing in Thai, I want the camp card to show the province name and price honestly in my chosen language, so that I can trust what I'm reading before I open a camp.
Why: three real defects found by the owner testing the live site in Thai — an English-only location line with a hardcoded `Thailand` literal, a price that hides the top of a real range, and a favourite-icon contrast claim that had never been measured.
Scope: `components/CampgroundCard.tsx` (render + copy) · the card's location/price data seam (`lib/read-models/camp-card.ts`, `app/wishlist/page.tsx`'s own select) · `locales/translations.json` copy keys. Does NOT touch `lib/campsite-filters.ts`'s province equality match, `prisma/schema.prisma`, or any token/`app/globals.css` value.
Depends on: CAM-531 (province dropdown reads `Location.province` — the field this story must not disturb) · CAM-537 (dark-mode `--primary` contrast fix — the token this story measures, not changes)

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A Thai-language user views a card for a camp whose `Location` links to a `ThailandLocation` row | The card renders | `นราธิวาส, ประเทศไทย` (the Thai province name + the Thai word for the country — never the English pair, never the literal `Thailand`) | Card display resolves the province text from `Location.thaiLocation.provinceName`; `Location.province` itself is read-only here, unchanged | EC-1 |
| AC-2 | An English-language user views the same card | The card renders | `Narathiwat, Thailand` (unchanged from before — English province + English country word, now sourced from a locale key instead of a hardcoded string) | Same underlying data; only the JSX literal moved into `locales/translations.json` | — (mirrors AC-1, no failure twin) |
| AC-3 | A camp has only `priceLow` set (no real range) | The card renders | `฿500 /คืน` | Price line carries the `/คืน` separator; single-price path unchanged in substance | EC-2 |
| AC-4 | A camp has `priceLow = 500` and `priceHigh = 1000` (host set a real range) | The card renders | `฿500-1,000 /คืน` | `priceHigh` is read by the card query and rendered for the first time; the price reads as an honest range, not a truncated "from" price | EC-2 |
| AC-5 | A camp is free (`priceLow` is `null` or `0`) | The card renders | `ฟรี` | Unchanged free-camp path; no `/คืน` suffix is shown for a free camp | — |
| AC-6 | The active (saved) wishlist heart icon renders over a photo, dark theme | Contrast is measured against the design system's own defined surfaces for this token (`--card`, `--background` — the same surfaces CAM-537 already registered for `--primary`) | (no visible copy change — a measured verification, not a user-facing string) | `--primary` measures 3.28:1 (`--card`) / 3.73:1 (`--background`) in dark, 5.39:1 in light — both clear the WCAG 1.4.11 3:1 non-text floor; `--secondary` measures worse in every case (1.10-1.32:1) — no token or component change made | — |

## Rules
- BR-1 TH-mode province text = `Location.thaiLocation.provinceName` when the camp's location links to a `ThailandLocation` row; falls back to the raw `Location.province` value (unchanged, whatever is stored) when no link exists — never a client-side Thai/English lookup table.
- BR-2 EN-mode province text = `Location.province` (unchanged pre-existing value/behavior).
- BR-3 The country word is `campground.countryName` (`ประเทศไทย` TH / `Thailand` EN) from `locales/translations.json` — never a hardcoded literal in JSX (proves AC-1/AC-2).
- BR-4 `Location.province` is NEVER changed, renamed, or reshaped by this story — `lib/campsite-filters.ts`'s exact-equality province filter and CAM-531's province dropdown both depend on its current stored value (English).
- BR-5 Price renders as a range (`{low}-{high} /คืน`) only when `priceHigh` is present AND `priceHigh > priceLow`; otherwise renders as a single price (`{low} /คืน`) from `priceLow` alone (proves AC-3/AC-4/EC-2).
- BR-6 A free camp (`priceLow` `null` or `<= 0`) renders `common.free` (`ฟรี`) with no `/คืน` suffix — no range logic runs (proves AC-5).
- BR-7 The `/คืน` (TH) / `/night` (EN) separator is the locale key `common.perNight` — never hardcoded in JSX (proves AC-3/AC-4).

## Edge cases
- EC-1 IF a `CampSite`'s `Location` has no `thaiLocationId` (unlinked) THEN the TH-mode province text falls back to the raw `Location.province` value rather than throwing or blanking the line (BR-1).
- EC-2 IF `priceHigh` is `null`, `undefined`, or `<= priceLow` THEN the card renders the single-price form — never a degenerate/inverted range like `1,000-500` (BR-5).
- EC-3 IF the camp is free THEN no `/คืน` suffix renders alongside `ฟรี` (BR-6) — this is a change from the pre-existing behavior (which showed `ฟรี คืน`), made because the same price block is being restructured anyway.

## Data
- `Location.thaiLocation` (existing relation → `ThailandLocation.provinceName`) — now READ (not written) by the card's Prisma select. `CampSite.priceHigh` (existing `Decimal?` column, already written by the host form) — now READ and rendered by the card for the first time. No schema change; no migration.

## Seams & refs
- Reuse: `lib/read-models/camp-card.ts`'s `campCardSelect` is the single seam feeding the catalog grid, the wishlist grid, and (transitively, unaffected) `lib/read-models/ai-camp-card.ts` — extended additively (new `location.thaiLocation` sub-select + `priceHigh`), never mutated in a way that drops an existing key. `app/wishlist/page.tsx` carries its OWN hand-rolled select (by design, per CAM-193 test comment) — extended the same additive way there too, since it is a real caller of the same `CampgroundCard` component. `lib/campsite-filters.ts`'s `buildCampSiteWhere` province equality match is UNCHANGED (not in this story's file surface) — confirmed by grep, no edits.
- Refs: CAM-531 (province dropdown reads `Location.province`, same field this story must not disturb) · CAM-537 (`--primary` dark-mode contrast fix, the exact token AC-6 measures) · ADR-002 (money as `Decimal`, serialized to `number` for the client) — pointers only, no implementation here.

## Out of scope
- `components/CampgroundDetailClient.tsx` has the SAME hardcoded `, Thailand` bug at two call sites (its own address line + a detail-page location row) — that file is outside this story's allowed surface (only `CampgroundCard.tsx` was in scope) → needs its own follow-up ticket.
- A "starting from" (lowest-price-only) copy variant was considered and rejected in favor of showing the real range — see Rules BR-5 rationale: `priceHigh` is a concrete host-set upper bound, not a synthetic derived minimum, so showing the full range is more honest than truncating it.

## Self-verify
- AC-1, AC-2 → unit (`buildLocationText` pure-function tests + `campCardSelect`/wishlist-select shape assertions + `grep -c 'Thailand' components/CampgroundCard.tsx` → 0)
- AC-3, AC-4, AC-5 → unit (`buildCardPriceDisplay` pure-function tests covering single/range/free/boundary cases, asserting the `/คืน` copy verbatim)
- AC-6 → unit (numeric contrast measurement reusing `scripts/check-contrast.mjs`'s real maths against the actual `app/globals.css` tokens — never an asserted-not-computed ratio)
- Story-specific: `lib/campsite-filters.ts` untouched (not in the diff) · `Location.province`'s stored value/shape unchanged · full suite re-run as the last act (grep for `Thailand`/`card--`/price-string pins across `__tests__/` + `e2e/`)
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
