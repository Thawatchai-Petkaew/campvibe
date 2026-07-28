# CAM-627 — design.md (measurement + decision record)

## Method

Measured on a local dev server (`npm run dev`, port 3101, this machine — the owner's `:3000` server was never touched), Chromium via Playwright + raw CDP `Tracing` (categories match Puppeteer's/Lighthouse's default trace set: `devtools.timeline`, `disabled-by-default-devtools.timeline`, `disabled-by-default-devtools.timeline.frame`, `toplevel`, etc.), **headed** (not headless — headless Chromium's own frame-delivery mechanism adds a fixed baseline that muddies a like-for-like comparison; headed matches what a real camper's browser does).

Per run: open the home page, click the launcher, wait for the panel to be visible + settle 1500ms (no request in flight — the panel's own conversation-resume fetch, which 401s with no auth in this env, has long since resolved by then), then trace exactly 4000ms of true idle and summarize: `requestAnimationFrame` callback count (`FireAnimationFrame` trace events), and total busy time per resolved OS thread (summed `dur` of complete trace events, grouped by `thread_name`/`process_name` metadata — an approximation that can double-count nested spans, so treated as a relative/order-of-magnitude signal, not a sub-millisecond-precise one).

The panel opens **expanded (fullscreen)** by default on a first-ever open (CAM-591, no `sessionStorage` yet) — this is the worst-case, most-common-for-a-new-camper configuration and the one profiled throughout.

Script: disposable, not shipped (`efficiency.md` §8 — disposable run detail stays out of the repo). Not committed.

## Before/after numbers (3 repetitions each, same machine, same 4000ms idle window)

| Scenario | `requestAnimationFrame` calls / 4s | Renderer main-thread busy (`CrRendererMain`, ms/4s) | GPU-process busy (`CrGpuMain`, ms/4s) |
|---|---|---|---|
| Panel **closed** (true-idle control) | 0 | 42 | 296 |
| Panel open — **BEFORE** this fix (rep 1/2/3) | 241 / 240 / 240 | 665 / 632 / 640 | 1324 / 1399† / 1369 |
| Panel open — **AFTER** this fix (rep 1/2/3) | 0 / 0 / 0 | 101 / 100 / 109 | 1361 / 1255 / 1382 |

† this particular number is from an isolation run (canvas-disabled-only, see below), included here since it lands in the same before-cluster.

**Headline result:** the continuous ~30fps `requestAnimationFrame` loop is gone (240/4s → 0/4s) and the renderer main-thread JS cost it drove drops **~83-85%** (630-665ms → 100-109ms per 4s idle window) — a clean, consistent, reproducible number across 3 repetitions before the fix and 3 after.

## Isolation pass (which of the two predicted suspects actually drove the cost)

Using `context.addInitScript` to selectively neuter one mechanism at a time on the **unfixed** code (CSS override to kill `.ai-aurora-drift`'s animation; a `requestAnimationFrame` monkey-patch to kill the canvas loop), before writing the real fix:

| Isolation | `requestAnimationFrame` calls/4s | `CrRendererMain` ms/4s | `CrGpuMain` ms/4s |
|---|---|---|---|
| Both running (full "before") | 240 | 632-665 | 1284-1399 |
| Aurora disabled, canvas running | 240 | 632 | 1284 |
| Canvas disabled, aurora running | 0 | 109 | 1399 |
| Both disabled | 0 | 103 | 1318 |

**What this shows, plainly:** disabling the aurora ALONE barely moved `CrRendererMain` (632ms vs 665ms full) — the canvas's JS loop is what actually drives that number, confirming AiAmbientCanvas (not the aurora) is the dominant, controllable, JS-side cost. This is why the fix targets the canvas loop directly.

## The part I predicted wrong — say so

The story's brief predicted the aurora-under-`backdrop-blur-xl` combination as "the single most expensive thing." The isolation pass above does not support that as stated: `CrGpuMain` (the GPU-process compositor thread, where a `backdrop-filter` recompute would actually show up) stayed in the same ~1280-1400ms/4s band in **every** open-panel scenario tested — full, aurora-only-disabled, canvas-only-disabled, and **both disabled** — while the panel-closed control measured only ~296ms/4s. In other words: simply having this glass panel **open**, with its several stacked `backdrop-blur-xl`/`backdrop-blur-md` layers, appears to cost real, continuous GPU-process time **on its own**, independent of whether anything behind it is still animating. Stopping both loops did not bring that number down to the closed-panel baseline.

This means the aurora/canvas motion was never the majority of the *GPU-side* cost — it was the majority of the *JS/main-thread* cost (confirmed above, and directly fixed). The larger GPU-compositor cost is tied to the glass surface itself (DESIGN.md §2.1 item 3, a sanctioned design decision, not an animation) and is out of this story's scope — noted as a follow-up in story.md's Out of scope, not fixed here. I did not chase it further: reducing/removing `backdrop-blur` is a Designer/G2 decision, not a story about "remove the animate."

## Decision — static, not removed

Chose **static** over **removed** for both:
- **Aurora**: `.ai-aurora` (the gradient itself, unchanged) stays; `.ai-aurora-drift` becomes a permanent `animation: none`. Zero per-frame cost, same visual identity at first paint.
- **Ambient canvas**: kept all three particle layers (stars, fireflies, embers) as a single frozen frame, painted once per real trigger (mount, resize, theme toggle, tab returning to foreground) instead of removing the canvas outright — this preserves more of the camping-night identity than dropping to a stars-only fallback would.

**What the panel loses:** continuous drift/twinkle motion for the aurora, stars, fireflies, and embers, and the fireflies' cursor-follow interactivity (meaningless without a repeating loop, so that code path was removed, not frozen). **What it keeps:** the full three-layer ambient composition at a glance, น้องกองไฟ's own two motion loops (`ai-flame-glow`, `ai-flame-flicker`, untouched — `AiChatAvatar.tsx` was not opened), and the existing `prefers-reduced-motion` behavior byte-for-byte (its code path was not touched, only reused for consistency where the "everyone" path now converges on it structurally).

DESIGN.md §2.1's sanctioned-loop count moves from 4 to 3 (`ai-aurora-drift` retired; `ai-flame-glow`/`ai-flame-flicker`/`ai-materialize` remain) — recorded in that file directly.

## CWV scorecard

| Metric | Status |
|---|---|
| LCP | not measured (this story touches no above-the-fold content) |
| CLS | not measured; no layout-affecting change (canvas/aurora are `-z-10`, `absolute inset-0`, decorative) |
| INP | not measured directly; the ~85% main-thread busy-time cut while the panel is open removes a source of main-thread contention that could have delayed input handling, but no INP field/lab number was captured this story |
| Renderer main-thread busy (idle, panel open) | **measured**: ~630-665ms/4s → ~100-109ms/4s (this machine, 3 reps each side) |
| Continuous `requestAnimationFrame` calls (idle, panel open) | **measured**: ~240/4s → 0/4s |
| GPU-process busy (idle, panel open) | **measured, unchanged by this fix**: ~1280-1400ms/4s before and after — flagged as a risk/follow-up (glass-surface cost), not claimed as fixed |
