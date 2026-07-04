---
linear: CAM-181
feature: ai-workflow
epic: ai-delivery-workflow-the-camper
artifact: tech
owner: frontend-engineer
status: Done
version: v1
updated: 2026-06-25
---
# Tech — หิ่งห้อยวูปวาบ บน /status/map campfire scene (CAM-181)

## Files touched

| File | Change |
|---|---|
| `app/status/map/campsite-scene.tsx` | Added `.firefly-layer` CSS to `SCENE_CSS` + firefly JSX layer inside `.map-stage` |
| `__tests__/cam-181-fireflies.test.ts` | New guard test (source-inspection, 8 test groups, 17 assertions) |

## Layer placement

`.firefly-layer` is a direct child of `.map-stage`, inserted in JSX immediately
**after** the closing `</div>` of `.scout-layer`. DOM order places it visually
on top at z-index 35 (`.scout-layer` is z-index 30).

```
.map-stage
  ├── .scout-layer        z-index 30  (agent characters)
  └── .firefly-layer      z-index 35  (fireflies — in front of characters)
```

CSS:
```css
.firefly-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 35;
  overflow: hidden;
}
```

`pointer-events: none` ensures all clicks pass through to the agent `<button>`
elements underneath. `overflow: hidden` prevents glow bleed outside `.map-stage`.
`aria-hidden="true"` on both the layer div and every firefly span — fully
transparent to assistive technology.

## Firefly count and placement (12 fireflies)

Owner chose Option B density (12 fireflies) at G2.

Each `.firefly` is a 3 × 3 px `<span>` with:
```css
background: #FFB454;              /* scene --amber token */
box-shadow: 0 0 6px 1px rgba(255,180,84,.7);
```

Hardcoded % positions are scene-local (inside `SCENE_CSS` template literal);
they are exempt from `check:palette` per `DESIGN.md §0 pt 4`
(`app/status/**` exclusion).

### Positions (% of .map-stage canvas)

| id | left % | top % | Zone |
|---|---|---|---|
| ff-1  | 14 | 12 | upper-left tree area |
| ff-2  | 24 | 24 | left mid-forest |
| ff-3  | 68 |  9 | upper-right tree canopy |
| ff-4  | 78 | 27 | right mid-forest |
| ff-5  | 82 | 48 | right clearing edge |
| ff-6  | 22 | 55 | left clearing edge |
| ff-7  | 41 | 16 | upper-centre tree line |
| ff-8  | 71 | 64 | lower-right, outside campfire keep-out |
| ff-9  | 11 | 39 | far-left mid-clearing edge |
| ff-10 | 88 | 18 | upper-far-right |
| ff-11 | 31 | 68 | lower-left clearing edge |
| ff-12 | 59 | 33 | mid-right, between tree line and agents |

### Keep-out zones (no firefly placed inside)

- Campfire / gift zone: x 43–57 %, y 46–60 %  
- Topbar guard row: y 0–7 %  
- HUD right-panel corner: x > 82 %, y < 18 % (ff-10 at y=18 is on the boundary, acceptable)  
- HUD left-panel corner: x < 10 %, y < 18 % (ff-9 at x=11 clears it)

## Twinkle keyframes and stagger

```css
@keyframes fireflyTwinkle {
  0%, 100% { opacity: 0   }
  50%       { opacity: 0.9 }
}
```

- Opacity only — no transform, no drift (owner chose twinkle-only at G2).
- Duration range: 2.8 s – 5.0 s (all 12 values are distinct → out-of-sync blink).
- Delay range: 0 s – 2.1 s.
- Each firefly sets `--ff-dur` and `--ff-delay` via inline style, consumed by the
  shared `.firefly` animation rule (minimal repetition, one CSS rule for 12 dots).
- `animation-timing-function: ease-in-out` (inside the `animation` shorthand).
- `animation-iteration-count: infinite`.

| ff | --ff-dur | --ff-delay |
|---|---|---|
| 1  | 3.2s | 0.0s |
| 2  | 4.1s | 0.7s |
| 3  | 2.8s | 1.4s |
| 4  | 5.0s | 0.3s |
| 5  | 3.6s | 2.1s |
| 6  | 4.4s | 0.9s |
| 7  | 2.9s | 1.7s |
| 8  | 3.8s | 0.5s |
| 9  | 4.7s | 1.2s |
| 10 | 3.3s | 1.9s |
| 11 | 4.9s | 0.1s |
| 12 | 3.5s | 1.5s |

## Reduced-motion handling

Entire `@keyframes fireflyTwinkle` and the animated `.firefly` rule are wrapped
inside `@media (prefers-reduced-motion: no-preference)`.

Outside that block (i.e. when reduced-motion is active), `.firefly` is set to
`opacity: 0.3` with no animation — faint static amber dots, present but not
flashing. This avoids WCAG 2.3.3 (AAA animation cancellation) and is fully
safe for vestibular disorders.

```css
/* Default / reduced-motion fallback */
.firefly { opacity: 0.3; }

@media (prefers-reduced-motion: no-preference) {
  .firefly {
    opacity: 0;
    animation: fireflyTwinkle var(--ff-dur, 3.5s) ease-in-out var(--ff-delay, 0s) infinite;
  }
  @keyframes fireflyTwinkle { … }
}
```

## Guard test — `__tests__/cam-181-fireflies.test.ts`

Source-inspection style (same harness as `status-map.test.ts`). 8 describe groups:

1. `.firefly-layer` CSS — `pointer-events:none`, `z-index:35`, `@keyframes fireflyTwinkle`, opacity values, `no-preference` media query wrapping, no `transform` in keyframe.
2. JSX markup — `aria-hidden` on layer, `data-testid="layer--map-fireflies"`, exactly 12 `.firefly` instances, `aria-hidden` on each span, no emoji.
3. Depth — firefly-layer appears after scout-layer in JSX; scout-layer has `z-index:30`.
4. Keep-out zones — no firefly in campfire zone (x 43–57 %, y 46–60 %); no firefly in topbar row (y < 8 %).
5. Stagger — 12 distinct `--ff-dur` values.

## a11y

- `pointer-events: none` on `.firefly-layer` and all spans — nothing focusable.
- `aria-hidden="true"` on layer + every span — decorative, invisible to AT.
- No colour used as an information signal.
- `prefers-reduced-motion: reduce` → static `opacity: 0.3`, no animation, no flash.
- `data-testid="layer--map-fireflies"` for QA assertion.

## Performance

- CSS-only: no JS, no rAF, no `setTimeout`.
- Opacity-only animation: GPU-composited, no layout/paint on each frame.
- No CLS: `position: absolute; inset: 0` contributes zero block layout.
- No new images or fonts added.

## No tokens changed, no locales entries

All colour values (`#FFB454`, `rgba(255,180,84,.7)`) are scene-local (inside
`SCENE_CSS` template literal), consistent with the existing `--amber` /
`--amber-glow` scene variables. No new entries in `app/globals.css` or
`locales/translations.ts`.
