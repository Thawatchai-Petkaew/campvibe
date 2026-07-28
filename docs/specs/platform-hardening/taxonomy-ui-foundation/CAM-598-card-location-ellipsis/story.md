## Story
As a **Camper**, I want the assistant's location line to keep all its detail on one line and end in "…" when it's too long, so that a camp with a long district/province name never pushes the card's layout around or spills its text onto extra lines.
Why: owner decision 2026-07-28, "การ์ดแชท 3 ระดับ โอเคแล้ว แต่ถ้าเกิน 1 บรรทัดใช้ ..." — keep all three location levels (sub-district, district, province), but cut the line with an ellipsis when it does not fit. Not a request for less information — a request for the SAME information, laid out safely.
Scope: the location row on both assistant cards (`AiChatCampCard`, the result card; `AiChatDetailCard`, the floating detail pane) stays on one visible line and truncates with a native ellipsis instead of wrapping, at mobile widths (320/390px). No location level dropped, no font-size change, no new component.
Depends on: CAM-597 (`buildLocationText`, the same localized "sub-district, district, province" string this story lays out); CAM-450 (`AiChatDetailCard`'s terrain/access enrichment onto the same row).

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A result card's location text is short enough to fit the card's width | The card renders at 320px or 390px | The full text is visible on one line, e.g. `เมืองนครราชสีมา, นครราชสีมา` | No truncation applied; `line-clamp-1` never engages because content already fits | EC-1 |
| AC-2 | A result card's location text (all 3 levels) is longer than the card's available width | The card renders at 320px or 390px | The text stays on ONE line and ends in `…` — never wraps onto a second line, never widens the card | `AiChatCampCard`'s location span stays on one line (`line-clamp-1`, already shipped); no data is dropped from the underlying string | EC-2 |
| AC-3 | A detail card's location row carries the location text plus terrain plus access-type plus a distance figure | The camper opens the detail pane at 320px or 390px | All 4 parts read on ONE line, e.g. `ในเมือง, เมืองนครราชสีมา, นครราชสีมา · ภูเขาและป่าเขาสูง · รถเข้าถึงได้ทุกสภาพอากาศ · ~259 กม. จาก กทม. (โดยประมาณ)`, ending in `…` when it doesn't fit | `AiChatDetailCard` joins `locationParts` + the distance string into ONE `line-clamp-1` span (was: 2 separate spans inside a `flex-wrap` row that wrapped onto 2-3 visible lines) | EC-3 |
| AC-4 | Any of the above | The camper resizes or the text is very long | No location level (sub-district/district/province) or the terrain/access/distance parts are removed to make it fit — only the CSS visual box clips, the underlying text still carries every part | The full string is always present in `textContent`/the DOM; only the rendered box is visually clipped | EC-4 |

## Rules
- BR-1 The location row for both cards renders on exactly one visible line at 320px and 390px — never 2+ lines — regardless of content length (proves AC-2/AC-3).
- BR-2 Truncation never removes a location level, a terrain/access label, or the distance figure from the underlying text/data — only the rendered CSS box may clip it (proves AC-4).
- BR-3 `AiChatDetailCard`'s combined line (location + terrain + access + distance) truncates as ONE unit — the row is either fully visible or ends in one ellipsis, never a partial cut where the distance survives but an earlier part silently vanishes with no truncation marker (proves AC-3).

## Edge cases
- EC-1 IF the location text fits within the available width THEN it renders unclipped, no ellipsis shown (BR-1)
- EC-2 IF `AiChatCampCard`'s location text exceeds the available width (256px card, ~206px after the icon+padding) THEN it clips to one line with a trailing `…`, verified behaviourally (`scrollWidth<=clientWidth`, box height = one line-height) — measured: this component ALREADY did this correctly before this story (see design.md "Measured — before/after"); unchanged (BR-1)
- EC-3 IF `AiChatDetailCard`'s combined text exceeds the available width THEN the row height stays one line (was 2-3 lines before this story's fix) (BR-1/BR-3)
- EC-4 IF the combined text is inspected via `textContent` (not the rendered box) THEN every part (all 3 location levels + terrain + access + distance) is present, char-for-char, even when visually clipped (BR-2)

## Data
No schema/API change. Presentation-only: `AiChatDetailCard.tsx` combines two already-computed values (`locationParts`, `distanceText`) into one joined string; `AiChatCampCard.tsx` is unchanged (see design.md for why).

## Seams & refs
- Reuse: `buildLocationText` (CAM-597) is the string source for the location portion on both cards — unchanged by this story.
- Refs: CAM-597 (assistant-card-location-language, the string this story lays out); CAM-450 (terrain/access enrichment on the detail row).

## Out of scope
- `components/CampgroundCard.tsx` / the Home catalog card's own location line — a different component, not part of this ticket; flagged (not fixed) if it shares the same pattern.
- Which location parts are produced/resolved (`buildLocationText`, `AdminArea` chain) — CAM-597's territory, untouched here.
- Any change to `location-text.ts` — it is a pure re-export with no truncation concern; left untouched (see design.md).

## Self-verify
- AC-1/AC-2/AC-3/AC-4 → `e2e/regression/cam-598-card-location-ellipsis.spec.ts` (behavioural: real Chromium, `scrollWidth<=clientWidth` + one-line-height, at 320px and 390px, using the real worst-case string `ในเมือง, เมืองนครราชสีมา, นครราชสีมา`)
- Pre-existing source-inspection pin updated: `__tests__/cam-452-detail-aa-contrast.test.ts` (pinned the OLD `flex-wrap`/2-span markup; updated to the new markup, not weakened — same token, same testid)
- Prove-It: the new e2e spec was run against the PRE-fix code (`git stash`) and failed on `AiChatDetailCard` (missing the joined distance text) before the fix, and passed after — see design.md "Measured — before/after"
- Gate = `/quality-gate` · Done = every AC verified on localhost (dev DB) before merge into `dev`

## Changelog
- v1 (2026-07-28) — created
