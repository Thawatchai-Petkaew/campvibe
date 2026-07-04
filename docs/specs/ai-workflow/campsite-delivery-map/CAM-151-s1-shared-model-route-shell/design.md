---
linear: CAM-151
feature: ai-workflow
epic: campsite-delivery-map (CAM-150)
persona: platform
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-06-24
---
# Design — S1 shared model + route shell (CAM-151)

## Nature of this story

S1 is a **refactor + an empty route shell** — there is no user-facing feature yet. The visible surface is only:

1. `/status` rendering exactly as before (the extraction must be invisible to the user).
2. `/status/map?token=…` painting a **night-scene shell** + a loading placeholder, with no characters and no overlays (those arrive in S2–S5).

There is no new interactive component, no new flow, no new token. The full scene/overlay design lives in the mockup (`design/campvibe-campsite.html`) + spec (`design/campsite-status-adaptation-spec.md`) and is realized story-by-story.

## Design-system exemption (recorded, deliberate)

`/status` and `/status/map` are **internal ops dashboards**, not public CampVibe surfaces. Per the same exemption already granted to `/status`, they are **exempt from the public OKLCH design-token rule**: their look is fixed by design and intentionally immune to the `.dark` theme. The CSS is self-contained in `campsite-assets.ts` and injected via `dangerouslySetInnerHTML`, exactly as `/status` does with `dashboard-assets.ts`.

This is why `npm run check:palette` / `check:ds` apply to the public app, not to these ops pages; the scene's hex palette is the mockup's palette, carried over verbatim. This exemption is the same decision `/status` carries — S1 does not widen it, it inherits it.

## Night-scene shell (the only visible surface in S1)

The shell reuses the dashboard's night palette so the map reads as a sibling of `/status`:

| Element | Treatment |
|---|---|
| Background | Fixed full-bleed vertical gradient `#060b1a → #0a142b → #0e2742 → #123a40 → #163f3a` (night sky into forest horizon). `position: fixed; inset: 0; z-index: 0`. |
| Aurora | Soft blurred radial glow (emerald/blue/green), `mix-blend-mode: screen`, low opacity — ambient only. **`prefers-reduced-motion: reduce` → no animation** (the guard is already wired in the shell so S3's motion respects it). |
| Stars | Empty `.map-stars` container (populated client-side later); static. |
| Loading placeholder | Centered glass card (`--glass` fill, blur, hairline border) with the copy **"กำลังโหลดแผนที่แคมป์"** while the lazy scene hydrates. |
| Gate box | When the token is missing/wrong: a centered glass `.gatebox` with heading "Protected dashboard" + the hint to add `?token=YOUR_TOKEN`. |

All copy that the user reads is Thai and plain — no technical jargon, no em-dash separators.

## States

| State | What the user sees |
|---|---|
| **default (`/status`)** | Unchanged — identical to before the refactor. |
| **loading (`/status/map`)** | Night-scene background + glass card "กำลังโหลดแผนที่แคมป์" until the client scene hydrates. |
| **empty / no data** | The model is empty (0 stories) → the shell still paints; the scene (S2) shows a calm "You" with no gate badge. (At S1 the scene is a stub.) |
| **error** | Fetch failed → glass placeholder "โหลดข้อมูลไม่ได้: …" instead of the scene; the background shell still paints. |
| **gate (no/wrong token)** | The `.gatebox` "Protected dashboard" card; no data is fetched. |

## a11y

- The background scene wrapper is `aria-hidden="true"` (decoration); the meaningful content (placeholder/gate copy) is real text, readable by a screen reader.
- The reduced-motion guard is present at the shell level from S1, so the ambient aurora does not animate when the user opts out — the later motion work (S3) extends the same guard rather than inventing one.
- Full keyboard/SR coverage of characters, gate, and overlays is **S7's** scope; S1 only needs the shell copy to be readable.

## Design gate checklist (S1 scope)

- [x] Internal-ops exemption from public OKLCH tokens is inherited from `/status`, not newly created — CSS self-contained in `campsite-assets.ts`.
- [x] Night-scene shell reuses the dashboard night palette (sibling consistency).
- [x] All user-visible copy is plain Thai, no jargon, no em-dash.
- [x] `prefers-reduced-motion: reduce` guard present at the shell from S1.
- [x] No new public design token introduced; no change to `DESIGN.md` token table.
- [x] No characters/overlays in S1 (correctly deferred to S2–S5).

## Links

`story.md` · `tech.md` · `../feature.md` · `design/campvibe-campsite.html` · `design/campsite-status-adaptation-spec.md` · `app/status/map/campsite-assets.ts` · `DESIGN.md` (internal-ops exemption)

## Changelog

- v1 (2026-06-24) — design artifact authored; recorded the refactor+shell nature, the inherited internal-ops token exemption, the night-scene shell, and the reduced-motion guard present from S1.
