# CAM-661 verification — measured results

Real Chromium (Playwright `regression` project), real dev server (`next dev`,
local Postgres `campvibe_e2e_cam661`, seeded host `hoster@campvibe.com`),
real Tailwind v4 build, real `:root`/`.dark` cascade, real Radix components
opened via real clicks. No hand-typed colour values — every number below
comes from a real `getComputedStyle` read or a real Canvas 2D
`source-over` composite (`getImageData`), run in-browser.

Run: `PW_REGRESSION=1 E2E_PORT=<free-port> npx playwright test e2e/regression/cam-661-overlay-luminance.spec.ts --project=regression`
Result: **12/12 passed**.

## 1. Overlay darkens real content (bg-card), both themes

WCAG relative luminance, `bg-card` alone vs `bg-card` + the live overlay's
own computed colour, composited via the real browser canvas.

| Component | Theme | card colour (computed) | overlay colour (computed, live) | backdrop-filter | lum(card) | lum(card+overlay) | darker? |
|---|---|---|---|---|---|---|---|
| Dialog | light | `lab(100 0 0)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 1.000000 | 0.538161 | yes (-46.2%) |
| Dialog | dark | `lab(9.32863 -1.87989 -2.1017)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 0.010431 | 0.008073 | yes (-22.6%) |
| Sheet | light | `lab(100 0 0)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 1.000000 | 0.538161 | yes (-46.2%) |
| Sheet | dark | `lab(9.32863 -1.87989 -2.1017)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 0.010431 | 0.008073 | yes (-22.6%) |
| AlertDialog | light | `lab(100 0 0)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 1.000000 | 0.538161 | yes (-46.2%) |
| AlertDialog | dark | `lab(9.32863 -1.87989 -2.1017)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` | `blur(8px)` | 0.010431 | 0.008073 | yes (-22.6%) |

`backdrop-filter` support in the test browser (Chromium via Playwright):
**supported** (`CSS.supports("backdrop-filter", "blur(1px)")` → `true` in
every run) — `blur(8px)` was measured directly on the live overlay node in
all 6 rows above, not inferred from source.

## 2. Cross-component consistency ("all three overlays paint the same")

Dialog / Sheet / AlertDialog overlays, opened sequentially in one session,
computed colour + blur compared byte-for-byte:

| Theme | Dialog | Sheet | AlertDialog | identical? |
|---|---|---|---|---|
| light | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` / `blur(8px)` | same | same | yes |
| dark | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` / `blur(8px)` | same | same | yes |

## 3. Theme-invariance (the exact CAM-661 fix claim)

Dialog overlay's own computed colour, light vs dark theme, same session:

| light | dark | identical? |
|---|---|---|
| `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` / `blur(8px)` | `oklab(0.147999 -0.00263609 -0.0030061 / 0.25)` / `blur(8px)` | yes |

This is the direct proof the old bug is gone: `--overlay` has no `.dark`
override, so its computed value cannot differ between themes — unlike the
pre-fix `bg-foreground/15`, which tracked `--foreground` (near-black in
light, near-white in dark).

## 4. Prove-It — historical `bg-foreground/15` bug, reproduced live (no component file touched)

`--foreground` was never removed (still used for text colour), so the
pre-fix scrim class still resolves today. Compositing it the same way as
the shipped `bg-overlay/25`:

| Theme | lum(card alone) | lum(card + OLD `bg-foreground/15`) | lum(card + FIXED `bg-overlay/25`) | old class | fixed class |
|---|---|---|---|---|---|
| light | 1.000000 | 0.706829 | 0.538161 | darkens (correct here) | darkens |
| dark | 0.010431 | **0.042771 (LIGHTER than card alone)** | 0.008073 | **lightens — reproduces the reported "white film" bug** | darkens |

This confirms the measurement technique has real teeth: fed the
historically-broken colour it fails exactly the way CAM-661's reported bug
did (`ตอนนี้ดูแปลก ๆ กรณีที่ใส่เป็นสีขาวแทน ตอนที่เปิด Modal`); fed the live,
shipped colour it passes, in both themes.

## Honesty notes

- All luminance/colour numbers above are real measured values from this
  run — nothing estimated or hand-typed.
- The "darker over plain `--background`" case (not tabulated above) is
  real but much smaller in dark theme, because `--overlay` was
  deliberately set equal to dark's own `--background` value (see
  `app/globals.css` CAM-661 comment) — the darkening a user actually
  perceives comes from the overlay covering real UI surfaces (cards, nav,
  panels), which is what this suite measures via `bg-card`.
- Dev server (`next dev`) was used, matching the existing
  `e2e/regression` harness convention (BR-2, upload dev-fallback path) —
  Tailwind's compiled tokens do not differ between dev and a production
  build.
