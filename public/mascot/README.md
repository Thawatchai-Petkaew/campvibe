# CampVibe Mascot — Asset Placement Guide

## What goes here

Transparent PNG files for the CampVibe mascot character. These are served as static
assets at `/mascot/<filename>` and referenced by the `ErrorState` component (CAM-218).

Transparent PNGs work on both light and dark backgrounds — no `-dark` variant is needed.
Missing files degrade gracefully: the `ImageWithFallback` wrapper shows the `ImageOff`
lucide icon until the PNGs are in place.

---

## Image → filename mapping

Drop each attached image into this directory with the exact filename shown below.

| Filename | Pose (from the 7 attached images) | Used by variant |
|---|---|---|
| `thinking.png` | Thinking / scratching head | `not-found` (404) |
| `coding.png` | Sitting cross-legged with laptop | `error` (unexpected / 500) |
| `waving.png` | Waving | `forbidden` (403) |
| `walking.png` | Walking with laptop side-view | `generic` (catch-all) |

The remaining 3 poses (back-view backpack, standing, sitting in camp chair with laptop)
are reserved for future variants. You may leave them here for reference or future use.

---

## Recommended export settings

- Format: PNG with transparency (alpha channel preserved)
- Minimum width: 400px (the component renders at max 280px / 180px compact — 2x retina headroom)
- Background: transparent (works on both `background` light and `card` dark surfaces)
- No white matte, no shadow baked in

---

## After placing the files

No code change needed — `ErrorState` already references these paths. Reload the page
and the mascot will appear. The `ImageOff` fallback icon disappears once the file resolves.
