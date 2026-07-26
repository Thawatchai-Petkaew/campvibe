---
linear: CAM-539
feature: platform-hardening
epic: taxonomy-ui-foundation
persona: CAMPER
artifact: story
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-26
---
# Story — Image placeholder reads as a placeholder, not a broken image (CAM-539)

## Story
As a **Camper** browsing camps that have not uploaded a photo yet, I want the empty photo slot to look
like a slot waiting for a picture, so that I read "no photo yet" and keep browsing instead of thinking
the page failed to load.
Why: owner report (2026-07-26) — "ช่วยปรับ icon image fallback ให้ใช้สี ไม่โปรงใส่ ลด Gray scell แทน
เนื่องจากเส้นที่ทับกันจะดูพัง". The placeholder renders lucide `ImageOff`, which is the library's ERROR
glyph: a diagonal slash across a deliberately broken frame. Struck through at 40% opacity on a grey
frame, it reads as a rendering failure.

Scope: the fallback glyph's identity and colour inside `components/ui/image-with-fallback.tsx`, plus the
`DESIGN.md` record of the treatment. No layout, no sizing, no a11y wiring, no fade/LCP behaviour, no
caller is touched, no new token is introduced, no copy changes.
Depends on: CAM-537 (built `npm run check:contrast` and the exported colour maths this story measures with)

## AC
<!-- No AC row carries Thai copy: this story changes a glyph and a colour class only. The component
     renders no text in either state; its accessible name comes from the caller's `alt`, unchanged.
     The "user sees" column therefore describes the visual result, which is what this defect is about. -->
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camp card whose camp has no photo | Camper views the card | An unbroken picture frame glyph (rounded rectangle + sun + mountain) sits in the grey slot — no slash, no crossing strokes | No request is made; `showFallback` = true because `src` is empty | EC-1 |
| AC-2 | A camp photo whose URL 404s | The image fails to load | The same unbroken frame glyph replaces the photo, not a struck-through one | `errored` = true via `onError`; nothing is written | EC-2 |
| AC-3 | Light mode, either fallback case | Camper looks at the glyph | The glyph reads as a deliberate mark against its frame: **4.15:1** (was **1.63:1**, below the floor) | `text-muted-foreground` at full opacity on `bg-muted` | AC-4 |
| AC-4 | Dark mode, either fallback case | Camper looks at the glyph | The glyph reads the same way, no washed-out grey: **6.05:1** (was **2.15:1**, below the floor) | the same two tokens; `.dark` flips both automatically | AC-3 |
| AC-5 | Any fallback case, screen reader on | Camper reaches the element | Hears the caller's `alt`, once; the glyph itself announces nothing | wrapper keeps `role="img"` + `aria-label={alt}`; glyph keeps `aria-hidden="true"` | EC-3 |
| AC-6 | An image that loads normally (including the `priority` detail hero) | Camper opens the page | Unchanged: the photo fades in over its reserved frame, the hero renders opaque immediately | `loaded`/`imgRef.complete` path untouched | EC-4 |

## Rules
- BR-1 **The glyph must carry no self-intersecting stroke at 32px** (`w-8 h-8`). Measured from the lucide
  source: `ImageOff` is 6 nodes including a full-canvas diagonal `line` (2,2)→(22,22) laid across a frame
  that is deliberately SPLIT into two disjoint arcs to make room for it, plus a mountain line it crosses.
  `Image` is 3 nodes: one closed `rect` (rx 2), one `circle` fully inside it, one mountain `path` — zero
  intersections. This is the owner's "เส้นที่ทับกัน" (crossing strokes), measured rather than judged.
- BR-2 **The glyph colour carries no alpha.** A token at full opacity only. `/40` was the second half of
  the defect: it muddied every stroke crossing and dropped the mark below the contrast floor.
- BR-3 **Non-text floor = 3:1** (WCAG 2.1 SC 1.4.11). The glyph is a non-text graphic that carries the
  "no photo" information, so it is judged at 3:1, never at the 4.5:1 body-text floor. `text-muted-foreground`
  on `bg-muted` measures 4.15:1 light / 6.05:1 dark — clears the floor in both themes with margin.
- BR-4 **No new token.** `muted-foreground` is the role `DESIGN.md` §2 already assigns to "placeholder";
  it is the correct semantic AND it clears the floor, so adding a token would be unjustified surface.
  `--primary` was measured and rejected (2.79:1 dark — below the floor).
- BR-5 **A ratio in a spec, PR, or doc must come from code that was run** (`.claude/rules/performance.md`
  metric honesty applied to a11y). Every number here is recomputed from the real `app/globals.css` by the
  maths CAM-537 exported from `scripts/check-contrast.mjs`; none is hardcoded or eyeballed.

## Edge cases
- EC-1 IF `src` is absent (empty string, `null`, `undefined`) THEN the fallback branch renders and keeps its
  `--fallback-placeholder` testid, exactly as before (BR-1)
- EC-2 IF a present `src` fails to load THEN `onError` sets `errored` and the same fallback renders — the
  errored and no-src cases deliberately share ONE visual, because to a camper both mean "no photo here" (BR-1)
- EC-3 IF the caller passes no `alt` THEN the wrapper stays `aria-hidden="true"` with no `role`, so a purely
  decorative slot is not announced; this behaviour is unchanged by this story (AC-5)
- EC-4 IF the image is already complete on mount (cached/SSR, `onLoad` never fires) THEN the `imgRef.current.complete`
  reconcile still reveals it — this story must not perturb the fade/LCP path (AC-6)
- EC-5 IF a future edit reintroduces an alpha suffix on the glyph's colour class THEN the regression test fails,
  because it asserts the absence of an alpha modifier rather than the presence of one exact string (BR-2)

## Data
- No entity, field, or row is touched. This story changes one import, one JSX element's glyph and colour
  class, and a documentation record. · migration: none

## Seams & refs
- Reuse: `ImageWithFallback` is the ONE place every image fallback in the app is rendered — camp card, detail
  hero, album, and `LogoUpload` all route through it, so the fix lands once and no caller is patched. lucide
  exports `Image as ImageIcon`, so the glyph is imported under its alias and does not collide with the
  `Image` already imported from `next/image` in the same file.
- Refs: `DESIGN.md` §2 (token roles) · §5 (the 8 states — this IS the empty state) · §6 (design gate) ·
  §7 (lucide-only, DS-5) · CAM-537 `scripts/check-contrast.mjs` (the exported maths) · WCAG 2.1 SC 1.4.11
- Sibling pins: three existing suites assert the literal string `ImageOff` against this file
  (`cam-194-perf4-next-image`, `cam-218-err-1-error-state`, `ir1-image-resilience`). They pin "a fallback icon
  exists", using the then-current icon name as the proxy. Retargeting the name preserves each assertion's
  intent; dropping them would lose real coverage.

## Out of scope
- The glyph's SIZE (`w-8 h-8`) and the frame's `bg-muted` fill — both are unchanged. The owner asked to
  reduce the grey READING, which is a contrast problem, not a size or fill problem.
- A camping-specific mark (tent/mountain) — considered and rejected in `design.md`: this one component also
  backs `LogoUpload`, where a tent would be wrong.
- The `--border` / `--input` / `--ring` contrast failures listed in `DESIGN.md` §8 item 11 — untouched, still
  owner decisions from CAM-537.

## Self-verify
- AC-1, AC-2, AC-5 → unit: fallback renders for both no-src and errored, keeps its testid, keeps `role`/
  `aria-label`/`aria-hidden` (`__tests__/cam-539-image-placeholder.test.ts`)
- AC-3, AC-4 → unit: the ratio is RECOMPUTED from the real `app/globals.css` at test time via the CAM-537
  exports and compared to the 3:1 floor; no expected ratio is hardcoded
- AC-6 → covered by the untouched CAM-393 fade suite plus a pin that the fade/LCP path is not perturbed
- Story-specific: `grep ImageOff components/ui/image-with-fallback.tsx` = 0 · no alpha modifier on the glyph's
  colour class · `check:ds` + `check:palette` + `check:contrast` green · FULL suite green as the last act
- Gate = /quality-gate · Done = AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-26) — created
