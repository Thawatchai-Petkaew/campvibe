# CAM-720 — test.md

## Source-level (unit/render) tests

`__tests__/cam-720-honest-booking-controls.test.ts` — 11 cases, all green:

**AC-1/BR-1 — ControlsRow: `ghost` → `secondary`, chips + primary CTA untouched**
- a `question` step's `back`/`cancel` controls carry `data-variant="secondary"`; the answer chip stays `outline`.
- the `summary` step's `edit`/`cancel` controls carry `data-variant="secondary"`; the confirm CTA stays `default`.

**AC-2/BR-3 — a superseded (`isCurrent:false`) question block's chips + controls are really disabled**
- the chip AND the `back` control take the real `disabled` attribute; a tap is a no-op (handler not called).
- a CURRENT question block keeps its chip + control enabled (no regression) — the chip click still fires `onChipSelect`.
- EC-1 (boundary): a superseded block still carrying its frozen `isChecking:true` snapshot stays disabled (no flicker back to enabled — the OR in `disabled={view.isChecking || controlsDisabled}`).

**AC-3/BR-4 — `appendBookingNotice` supersedes the last still-current booking entry**
- a current question entry's `view.isCurrent` flips to `false` when the exit notice is appended.
- null/empty: a `checkFailed` entry (no `isCurrent` field) is left untouched — same object reference, no crash reading a field it doesn't carry.
- EC-2: a non-current entry (e.g. an already-frozen `submitting` block, `isCurrent` never `true`) is left untouched — the exit-supersede never fights CAM-701/702's existing in-flight semantics.

**post-exit — the last block renders disabled after BOTH real exit shapes (`booking-turn.ts`)**
- `ยกเลิกการจอง` (`processBookingCancel`) supersedes the last (`date`) block; rendered through `AiChatBookingStep`, its cancel control is really disabled.
- the 2-strike escape hatch (`processBookingTurn`'s `exit` outcome) supersedes the last (`date`) block; rendered, its chip AND cancel control are really disabled.
- EC-3: starting a NEW flow (`startBookingTurn`) after an exit renders the new block current and live (`isCurrent:true`); the old dead block's `isCurrent` stays `false` — no resurrection.

## Regression sweep (must-survive, all re-run green)

`cam-638-ai-chat-booking-step.test.ts` (+ a dated CAM-720 comment noting its aria-current-only pin is scoped, extended coverage lives in the new file) · `cam-638-booking-copy.test.ts` · `cam-639-render-booking-turns.test.ts` · `cam-640-booking-turn.test.ts` · `cam-640-booking-view.test.ts` · `cam-640-use-ai-chat-wiring.test.ts` (confirms the chip-driving handler props are gated on `isCurrent`, unchanged — the render-layer disabled state added here now MATCHES what the handler-gating already assumed) · `cam-647-focus.test.ts` · `cam-647-summary-check.test.ts` · `cam-647-use-ai-chat-wiring.test.ts` · `cam-700-ai-chat-booking-step-spot.test.ts` · `cam-700-spot-step.test.ts` · `cam-700-spot-turn.test.ts` · `cam-700-spot-view.test.ts` · `cam-700-use-ai-chat-wiring.test.ts` · `cam-701-ai-chat-booking-step-confirm.test.ts` · `cam-701-booking-copy.test.ts` · `cam-701-booking-view.test.ts` · `cam-702-booking-turn-submit.test.ts` · `ds6-consistency-guard.test.ts` — 19 files, 302 tests, all green.

e2e `e2e/regression/cam-640-chat-booking-round-trip.spec.ts` — not re-run live (no OpenRouter/dev-DB credentials in this worktree, see "Localhost AC verify" below), but read against the diff: its chip locators for `nights`/`guests` already use `.last()` (targets the newest/current block), and the `date` chip is clicked at a point where only one `date`-step block exists — none of these locators resolve to a now-disabled superseded block, so this story's `disabled` change does not intersect the spec's click path.

## Design gate

- `npm run check:ds` — PASS (0 violations).
- `npm run check:palette` — PASS (0 violations).
- Token-only: `secondary` is an existing `buttonVariants` entry (`components/ui/button.tsx`); disabled styling comes from the same file's forced `disabled:bg-disabled! disabled:text-disabled-foreground! disabled:border-transparent!` pair — no opacity anywhere, no new hex/px/shadow literal.
- a11y: disabling via the real `disabled` attribute removes the control from the tab order natively (no separate `tabIndex` management needed); no `aria-*` change.

## Full suite (last act)

- `npm run lint` — 0 errors (pre-existing unrelated warnings only, present before this story).
- `npx tsc --noEmit` — clean.
- `npm test` — 12490/12515 tests green (25 skipped, pre-existing/env-dependent, unrelated to this diff). `__tests__/delivery-client.test.ts` (the known env-dependent flake) ran green this session.
- `npm run build` — clean, all routes compile.

## Localhost AC verify — status: automated-only this session, flagged for owner verification

**What was attempted:** starting `next dev -p 3035` in this worktree to reproduce the owner's original screenshot state (one unreadable miss → two stacked blocks) and capture it visually, per this story's dispatch note.

**Why it stopped short:** this worktree has no `.env` (no `DATABASE_URL`/OpenRouter key) — `scripts/worktree-setup.sh` only symlinks `node_modules`, it does not provision environment secrets — and the session's own tool permissions explicitly denied copying `.env` in from the main tree (a deliberate secret-access boundary, not a bug). Without a DB connection, `next dev` cannot serve the AI chat / camp-detail / booking endpoints this flow depends on, so a real interactive reproduction was not possible from inside this isolated worktree this session.

**What stands in its place:** the render-level proof above is a direct, code-accurate substitute for the visual check — `cam-720-honest-booking-controls.test.ts`'s "post-exit" block renders the EXACT view object `booking-turn.ts` produces after each real exit path (not a hand-built fixture) through the real `AiChatBookingStep` component, and asserts the resulting DOM nodes are really `disabled`. This is evidence of the same fact a screenshot would show, verified through the DOM rather than through pixels.

**Owner check (recommended, on the real dev server / dev DB):** open the chat, start a booking, and at the `nights` (or any question) step type an unreadable answer twice in a row (or once, to reach a simple reprompt) so two `nights`-step blocks stack. Expect: the OLDER block's chips + `ย้อนกลับ`/`ยกเลิกการจอง` controls show the flat muted `disabled` look (no hover/press response, unreachable by Tab) — "reads dead" — while the NEWER block's `ยกเลิกการจอง` (and any other `ControlsRow` control) shows a visible `secondary` fill at rest, distinct from the outline chips beside it — "reads like a button." Also verify a full exit (either `ยกเลิกการจอง` or the 2-strike escape) leaves the LAST block in that same disabled look, with no other control anywhere still looking pressable-but-dead.

## Cleanup

No `.env`/dev server artifacts were created in this worktree (the copy attempt was denied before any file was written) — nothing to clean up.
