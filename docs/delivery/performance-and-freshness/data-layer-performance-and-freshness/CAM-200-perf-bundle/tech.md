# CAM-200 PERF-BUNDLE — JS Bundle Code-Split Plan

**status:** In Progress (G2 Design)
**date:** 2026-06-27
**role:** Architect (Tech Lead)

---

## 1. Measured Baseline (before any fix)

Measurement method: `npm run build` (Turbopack production build) + chunk size analysis via `page_client-reference-manifest.js` + `zlib.compress` for gzip estimate. Bundle analyzer HTML was not produced (`.next/analyze/` absent from this build run — the manifest-based approach is the authoritative source).

Lighthouse staging metrics (CAM-199 post-build, as provided):
- LCP: 2.3s (target met)
- TBT: 610ms (target ≤200ms — RED)
- Main-thread: 3.2s
- "Reduce unused JavaScript": 689 KiB flagged
- Performance score: 82

**Home route (`/`) initial JS — measured chunks (gzipped via zlib level-9):**

| Chunk | Raw | Gzip | Contents |
|---|---|---|---|
| `0y_b0mzhz0ap3.js` | 726 KB | **173 KB** | lucide-react full barrel — **1414 icons** bundled |
| `3_5lu0x-599rg.js` | 69 KB | 23 KB | IntersectionObserver / InfiniteScrollGrid runtime |
| `2njnzefkmlu4g.js` | 75 KB | **21 KB** | react-day-picker (DayPicker) + date-fns |
| `2j4yirn24r_qo.js` | 58 KB | 17 KB | Radix Dialog + Popover primitives |
| `12w0ni8197cpe.js` | 57 KB | 14 KB | shared framework chunk |
| `1ntn7efqc-iiw.js` | 53 KB | 12 KB | shared framework chunk |
| `04q6rx5979jkh.js` | 34 KB | 9 KB | sonner (Toaster — layout-level, keep) |
| `0av_-cpt5rw5s.js` | 35 KB | 11 KB | lucide subset (additional icons) |
| `2t3yflj4hk7af.js` | 29 KB | 9 KB | framework |
| `2x49jlnlz7fj9.js` | 27 KB | 6 KB | framework + next-auth hooks |
| `32-dn7ihsxr6p.js` | 25 KB | 7 KB | framework |
| `2qmoz--709mvk.js` | 22 KB | 7 KB | FilterModal + Dialog reference |
| `0lqce85rs6fy-.js` | 16 KB | 6 KB | framework |
| `1zum3eqsk36g8.js` | 14 KB | 5 KB | next-auth SessionProvider |
| **TOTAL** | **1247 KB** | **327 KB** | |

CSS (all routes, render-blocking):
- `00w12yzbqajbf.css`: 122 KB raw / **18 KB gzip** — Tailwind v4 utility output (framework-level)
- `0n8kzvw2z_6as.css`: 10 KB raw / 2 KB gzip
- `301scgxx65jqc.css`: 7 KB raw / 1 KB gzip
- Total CSS: ~22 KB gzip (within 50 KB budget — leave)

**Budget target:** < 200 KB gzipped per route. Baseline is 327 KB — **127 KB over budget**.

---

## 2. Root Cause Analysis

### Root cause 1 (CRITICAL): lucide-react wildcard import in FilterModal

`/components/FilterModal.tsx` line 28:
```ts
import * as LucideIcons from "lucide-react";
```

This single import forces the bundler (Turbopack) to include all 1414 icons from the lucide-react barrel into the initial client bundle. This produces the 726 KB raw / 173 KB gzip chunk.

FilterModal uses this import only for one dynamic lookup (line 424):
```ts
return LucideIcons[iconName] || LucideIcons.HelpCircle;
```

The `iconName` string comes from the `MasterData.icon` field in the DB. The complete set of icon names that can ever appear is the seed data — **40 unique icons** (Anchor, Armchair, Bath, Bed, Binoculars, Box, Car, Coffee, Droplet, Droplets, Fan, Fish, Flame, Footprints, GlassWater, Layers, Lightbulb, Mountain, Music, Palmtree, PawPrint, Plug, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Snowflake, Store, Table2, Tent, Trash, Trash2, Trees, Umbrella, Utensils, UtensilsCrossed, Waves, Wifi, Zap, HelpCircle). The rest (1374 icons) are dead weight.

### Root cause 2 (HIGH): SearchModal imported statically in Navbar

`/components/Navbar.tsx` imports `SearchModal` statically. `SearchModal` imports `Calendar` from `@/components/ui/calendar`, which imports `DayPicker` from `react-day-picker` and `format` from `date-fns`. These are only needed when the user clicks the search bar — never at first paint.

Chain: `Navbar.tsx` → `SearchModal.tsx` → `ui/calendar.tsx` → `react-day-picker` (75 KB raw / 21 KB gzip).

### Root cause 3 (LOW): LoginModal + RegisterModal statically imported

`Navbar.tsx` also statically imports `LoginModal` and `RegisterModal`. These are interaction-only (button click). Their individual weight is small but they contribute to the Dialog/Radix chunk being eagerly loaded.

`InfiniteScrollGrid.tsx` also statically imports `LoginModal` (shown on wishlist click by non-logged-in users).

### CSS: framework-level, no cheap win

The 122 KB raw / 18 KB gzip CSS chunk is the Tailwind v4 utility output for the entire app. CSS code-splitting at this level would require scoping Tailwind to per-route utility sets — framework-level change, out of scope for this story. Total CSS 22 KB gzip is within budget. Leave it.

---

## 3. Component Boundary Audit (first paint vs interaction-only)

| Component | Visible at first paint? | Action needed |
|---|---|---|
| `Navbar` | YES — renders immediately | Keep eager; lazy its modals |
| `CategoryBar` | YES — interactive tabs | Keep eager |
| `FilterSortBar` | YES — thin layout wrapper | Keep eager |
| `SortDropdown` | YES — desktop only, select | Keep eager |
| `InfiniteScrollGrid` | YES — catalog grid | Keep eager |
| `CampgroundCard` | YES — SSR cards, wishlist toggle | Keep eager |
| `EmptyState` | YES — may show on first paint | Keep eager (server component) |
| **`FilterModal`** | NO — opens on filter button click; manages own `isOpen` state internally | Lazy + fix wildcard import |
| **`SearchModal`** | NO — opens on search bar click | Lazy |
| **`LoginModal`** | NO — opens on login/wishlist click | Lazy (in Navbar + InfiniteScrollGrid) |
| **`RegisterModal`** | NO — opens on signup click | Lazy |
| `NotificationCenter` | CONDITIONAL — only for authenticated users | Optional lazy (small weight) |
| `HostOnboardingFab` | CONDITIONAL — non-host logged-in only | Optional lazy (small weight) |

Key confirmation: `FilterModal` controls its own open state via `useState(false)` + `Dialog open={isOpen} onOpenChange={setIsOpen}` + `DialogTrigger` — no external `isOpen` prop is passed from page.tsx. Lazy loading it with `next/dynamic` is clean.

---

## 4. Code-Split Plan (ranked by impact)

### Action A — Fix FilterModal wildcard lucide import [CRITICAL]

**File:** `components/FilterModal.tsx`

**Change:** Replace `import * as LucideIcons from "lucide-react"` with a named import map of the 40 DB icons + HelpCircle fallback.

```ts
// BEFORE (line 28) — pulls ALL 1414 icons
import * as LucideIcons from "lucide-react";

// AFTER — only the 40 icons that MasterData.icon can ever reference
import {
  Anchor, Armchair, Bath, Bed, Binoculars, Box, Car, Coffee,
  Droplet, Droplets, Fan, Fish, Flame, Footprints, GlassWater,
  Layers, Lightbulb, Mountain, Music, Palmtree, PawPrint, Plug,
  ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Snowflake,
  Store, Table2, Tent, Trash, Trash2, Trees, Umbrella, Utensils,
  UtensilsCrossed, Waves, Wifi, Zap, HelpCircle,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Anchor, Armchair, Bath, Bed, Binoculars, Box, Car, Coffee,
  Droplet, Droplets, Fan, Fish, Flame, Footprints, GlassWater,
  Layers, Lightbulb, Mountain, Music, Palmtree, PawPrint, Plug,
  ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Snowflake,
  Store, Table2, Tent, Trash, Trash2, Trees, Umbrella, Utensils,
  UtensilsCrossed, Waves, Wifi, Zap, HelpCircle,
};

// Replace the getIconComponent function (line 421-425)
function getIconComponent(iconName: string | null): LucideIcon | null {
  if (!iconName) return null;
  return ICON_MAP[iconName] ?? HelpCircle;
}
```

Also remove the `// @ts-ignore` comment — no longer needed.

**Expected saving:** ~162 KB gzip (the 726 KB / 173 KB chunk collapses to ~32 KB uncompressed / ~11 KB gzip for only the 84 icons actually used across the whole home route).

**Risk:** LOW. Named imports are functionally identical. Lucide tree-shakes perfectly with named imports. If a new MasterData icon is added to the DB that is not in ICON_MAP, it falls back to HelpCircle — same behavior as before (the wildcard would have found it, but the fallback is acceptable and the set is controlled). If the icon set grows, add to ICON_MAP; it is a one-line change.

**SSR concern:** None — FilterModal is `"use client"` and the icon map is client-side only. No hydration impact.

---

### Action B — Lazy-load SearchModal [HIGH]

**File:** `components/Navbar.tsx`

**Change:** Replace static import with `next/dynamic`:

```ts
// BEFORE
import { SearchModal } from "./SearchModal";

// AFTER
import dynamic from "next/dynamic";
const SearchModal = dynamic(() => import("./SearchModal").then(m => ({ default: m.SearchModal })), {
  ssr: false,
  loading: () => null,
});
```

`ssr: false` — correct because SearchModal uses `useSearchParams` and `useRouter` (client-only hooks). It is never needed for server rendering. `loading: () => null` — the modal is closed at first paint so showing nothing is correct.

**Expected saving:** ~21 KB gzip (eliminates the react-day-picker + date-fns chunk from initial bundle). The Calendar component (DayPicker) will load only when the user opens the search bar.

**Risk:** LOW. SearchModal is always `isOpen=false` at first paint. The dynamic import resolves before the user can click (preloaded by the browser on idle). Behavior after click is identical.

**SEO concern:** None — the search modal contains no content that crawlers need. Camp listing content is server-rendered in `CatalogResults` (SSR). SearchModal is purely an interaction trigger.

---

### Action C — Lazy-load FilterModal [MEDIUM]

**File:** `components/FilterSortBar.tsx` (renders `<FilterModal />` as a child) or `app/page.tsx` where `FilterModal` is passed as a child to `FilterSortBar`.

Check `app/page.tsx` — `FilterModal` is imported statically and rendered inside `FilterSortBar` as a child. Change at `app/page.tsx`:

```ts
// BEFORE (app/page.tsx)
import { FilterModal } from "@/components/FilterModal";

// AFTER
import dynamic from "next/dynamic";
const FilterModal = dynamic(() => import("@/components/FilterModal").then(m => ({ default: m.FilterModal })), {
  ssr: false,
  loading: () => null,
});
```

`ssr: false` — FilterModal uses `useSearchParams`, `useRouter`, and client state. Correct. `loading: () => null` — the filter button still renders (it is inside FilterModal's own `DialogTrigger`). The button itself renders after the dynamic chunk loads (on idle, nearly instant). If there is a flash of missing filter button, add a skeleton/placeholder.

**Expected incremental saving (beyond Action A):** ~10–15 KB gzip (FilterModal component code itself, the `getFilterOptions` server action reference, and any Dialog primitives not shared with other routes). The Dialog chunk (`2j4yirn24r_qo.js`, 17 KB gzip) will still load because other components (Navbar modals) use Dialog — this saving is partial.

**Risk:** MEDIUM. The filter button is rendered via `DialogTrigger` inside FilterModal. When FilterModal loads lazily, the trigger renders after the chunk arrives. This causes a brief (< 100ms on fast connection) flash where the filter button is absent. Mitigate with a `loading` prop that renders a skeleton button matching the trigger's dimensions. Frontend to decide on the UX for the loading fallback.

---

### Action D — Lazy-load LoginModal + RegisterModal [LOW, incremental]

**File:** `components/Navbar.tsx` and `components/InfiniteScrollGrid.tsx`

```ts
// Navbar.tsx
const LoginModal = dynamic(() => import("./LoginModal").then(m => ({ default: m.LoginModal })), {
  ssr: false, loading: () => null,
});
const RegisterModal = dynamic(() => import("./RegisterModal").then(m => ({ default: m.RegisterModal })), {
  ssr: false, loading: () => null,
});

// InfiniteScrollGrid.tsx
const LoginModal = dynamic(() => import("@/components/LoginModal").then(m => ({ default: m.LoginModal })), {
  ssr: false, loading: () => null,
});
```

`ssr: false` — both modals use client hooks (useSession, usePathname, useRouter). Correct.

**Expected incremental saving:** ~5–10 KB gzip. LoginModal and RegisterModal are lightweight (basic lucide icons + Dialog). The main saving is deferring their Dialog and form code.

**Risk:** LOW. Both are interaction-only (button click in Navbar, heart click in InfiniteScrollGrid). `loading: () => null` is correct since the trigger buttons are outside these components.

---

## 5. What to Leave Unchanged (and Why)

| Component/Chunk | Reason to Leave |
|---|---|
| `Navbar` shell | Renders the visible nav immediately — must be eager |
| `InfiniteScrollGrid` | Renders the SSR-seeded catalog grid — must be eager |
| `CampgroundCard` | Renders SSR cards with wishlist toggle — must be eager |
| `CategoryBar` | Visible interactive tabs — must be eager |
| `SortDropdown` | Visible on desktop — must be eager |
| `NotificationCenter` | Small weight (no heavy deps, only basic lucide icons + Radix Dropdown) — optional lazy, low ROI |
| `HostOnboardingFab` | Very small (Store + ArrowRight icons + Button) — optional lazy, negligible ROI |
| `ThemeToggle` | Tiny, no heavy deps — leave eager |
| `sonner` (Toaster) | Layout-level, 9 KB gzip, already deferred to layout boundary |
| CSS chunks | Framework-level (Tailwind v4 output) — no cheap win, 22 KB gzip within budget |
| `CatalogResults` | Server component — no client bundle impact |

**SEO / SSR guard:** CampgroundCard, CatalogResults, and the Navbar shell must NOT use `ssr: false` — they affect first-paint HTML that crawlers and Lighthouse see. Only modals (hidden at first paint) use `ssr: false`.

---

## 6. Projected After-Fix Bundle

Estimated home route First Load JS after Actions A + B + C + D:

| What changes | Saving (gzip est.) |
|---|---|
| Action A: lucide barrel → named imports | ~162 KB |
| Action B: lazy SearchModal → defer DayPicker | ~21 KB |
| Action C: lazy FilterModal → defer component code | ~12 KB |
| Action D: lazy Login/RegisterModal | ~8 KB |
| **Total estimated saving** | **~203 KB gzip** |

Before: 327 KB gzip
After (estimated): ~124 KB gzip

This is an estimate, not a measured result. The actual saving depends on chunk sharing across routes (shared chunks may not reduce per-route size if other routes keep them). Frontend must re-run `npm run build` after implementing and measure the new chunk manifest. Label any unverified numbers as "potential" until re-measured.

**Performance target:** < 200 KB gzipped (budget). 124 KB estimated is within budget. TBT should improve significantly since the main-thread work of parsing 726 KB of JS is eliminated from first paint.

---

## 7. SSR / SEO Safety Verification

The SSR catalog cards (the LCP content) are rendered by `CatalogResults` — an async Server Component. It is never touched by any of these changes. The Lighthouse LCP (2.3s, already green) is unaffected.

None of the lazy-loaded components (FilterModal, SearchModal, LoginModal, RegisterModal) contain content that:
- Crawlers need to index
- Contributes to LCP element
- Affects CLS (they render as overlays over existing layout, not inline)

`ssr: false` is correct for all four because each uses client-side hooks (`useSearchParams`, `useRouter`, `useSession`). Setting `ssr: false` removes the server render attempt that would fail anyway.

---

## 8. CSS Assessment

Lighthouse flagged 2 render-blocking CSS chunks (~19.7 KB + 1.6 KB). These correspond to the Tailwind v4 output (18 KB gzip) and route-specific CSS (2 KB + 1 KB gzip). Total CSS is 22 KB gzip — within the 50 KB budget.

Splitting Tailwind v4 CSS per-route requires Tailwind config changes that are framework-level and would risk regressions across all routes. The JS bundle is the dominant drag (327 KB JS vs 22 KB CSS). Leave CSS as-is.

---

## 9. Open Trade-offs (raise at G2)

**Trade-off 1: FilterModal button flash with lazy loading (Action C)**

If FilterModal is lazy-loaded, the filter button (rendered via `DialogTrigger` inside FilterModal) is absent until the chunk arrives. Two options:

- Option A: Render a placeholder button (skeleton) in the `loading` prop that matches the trigger dimensions — no visible flash, but requires duplicating the button markup.
- Option B: Accept a brief absence of the filter button on first load (< 100ms on fast connection, invisible on staging). Simpler implementation.

Impact: Option A protects CLS; Option B risks a minor layout shift when the button appears. Human decision needed.

**Trade-off 2: Action A alone vs Actions A+B+C+D**

Action A alone (fix the wildcard import) delivers ~162 KB of the ~203 KB total saving and has the lowest risk. If time is constrained:
- MVP: Action A only — eliminates the dominant bottleneck. Estimated bundle after: ~165 KB gzip.
- Full: Actions A+B+C+D — hits the budget target. Estimated bundle after: ~124 KB gzip.

**Trade-off 3: ICON_MAP maintenance**

With named imports, adding a new icon for a new MasterData entry requires a code change in FilterModal. Currently a DB admin can add a new icon name without touching code. Options:
- Accept the maintenance cost (recommended: the set is small and controlled).
- Build a separate lazy-loaded icon resolver (over-engineering for 40 icons).

---

## 10. Guard (regression prevention)

Once implemented, add a bundle size guard in CI to prevent the wildcard import from re-appearing:

```ts
// __tests__/bundle-guard.test.ts
it("FilterModal must not import * from lucide-react", () => {
  const src = readFileSync("components/FilterModal.tsx", "utf-8");
  expect(src).not.toContain("import * as LucideIcons");
  expect(src).not.toContain("import * as Lucide");
});
```

Also add a build-time check: after `npm run build`, assert the largest chunk in `.next/static/chunks/` is < 200 KB (raw). The current 726 KB chunk is the only one above this threshold.

---

## Appendix: Import Graph (Home Route)

```
app/page.tsx (Server Component)
  ├── Navbar (client) ──────────────────────────────────────────────
  │     ├── SearchModal [static → LAZY target] → ui/calendar → react-day-picker
  │     ├── LoginModal  [static → LAZY target]
  │     ├── RegisterModal [static → LAZY target]
  │     ├── NotificationCenter [static — lightweight, leave]
  │     ├── HostOnboardingFab [static — lightweight, leave]
  │     └── ThemeToggle [static — tiny, leave]
  ├── CategoryBar (client) — lucide named imports only
  ├── FilterSortBar (client) — thin wrapper
  │     └── FilterModal [child, static in page.tsx → LAZY target]
  │           └── import * as LucideIcons ← ROOT CAUSE 1
  ├── SortDropdown (client) — lucide named imports only
  └── Suspense → CatalogResults (Server Component, SSR)
        └── InfiniteScrollGrid (client)
              ├── CampgroundCard (client)
              └── LoginModal [static → LAZY target]
```
