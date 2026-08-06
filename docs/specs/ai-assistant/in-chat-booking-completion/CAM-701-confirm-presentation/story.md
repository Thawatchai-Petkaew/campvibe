---
artifact: story
feature: ai-assistant
epic: in-chat-booking-completion (CAM-695)
story: confirm-presentation (CAM-701)
status: In Progress
version: v1
updated: 2026-08-06
---

## Story
As a **Camper** at the summary step of an in-chat booking, I want to see a real ยืนยันการจอง button and the outcome screens it can lead to, so that the render layer is proven before any story wires it to the network.
Why: PRESENTATION ONLY (ADR-018) — this story adds the confirm CTA + `submitting`/`booked`/`bookingFailed` views to the render layer and wires nothing to the network; CAM-702 owns the actual `POST /api/bookings` call and the live wiring into `booking-turn.ts`/`use-ai-chat.ts`. Same split CAM-638 used for round 1's question/summary steps (build the views + the props first, prove them by rendering, leave the handlers as props the next story fills).
Scope: `BookingSummaryView` gains a `cta` discriminator (`kind:'handoff'` | `kind:'confirm'`); three new view kinds (`submitting`/`booked`/`bookingFailed`) + their pure builders in `booking-view.ts`; every new copy key (TH/EN); three named a11y fixes (in-flight `aria-disabled`, superseded-summary real `disabled`, dropped orphan `role="row"`). `AiChatBookingStep.tsx` + `booking-view.ts` + `locales/translations.json` only.
Depends on: CAM-697 (design brief v2, §5-§9) · CAM-700 (spot step, merged) · ADR-018 · epic CAM-695

## Deviation from the design brief, disclosed (not a silent gap)
Design brief §0 retires the handoff CTA entirely ("removed, not demoted") once round 2 ships. This story keeps `kind:'handoff'` alive as `buildSummaryView`'s live output for BOTH whole-camp and per-pitch flows, because that pure builder has no session parameter (`SummaryParams` carries `slots · camp · t · language · today`, nothing else) and therefore cannot compute a guest/member confirm label on its own — and this story does not touch `booking-turn.ts`/`use-ai-chat.ts`, which is where a live session would be read. Shipping a `kind:'confirm'` button with no wired `onConfirm` from the live call site would put a dead CTA in front of real campers on `dev`. `kind:'confirm'` is therefore proven ONLY by this story's own render tests (fixture view literals); CAM-702 is the story that gives `booking-turn.ts` a session and switches the live `cta` to `kind:'confirm'`.

## AC
| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The component is handed a `summary` view with `cta:{kind:'confirm', authState:'member'}` | It renders | `ยืนยันการจอง` on a `size="lg" w-full` primary, `data-auth="member"` | Tapping calls the `onConfirm` prop (undefined-safe — no network in this story) | EC-1 |
| AC-2 | Same view, `authState:'guest'` | It renders | `เข้าสู่ระบบเพื่อยืนยันการจอง` — same testid, same position | Tapping still calls `onConfirm` (the caller decides guest-vs-member behaviour, not this component) | EC-1 |
| AC-3 | The component is handed a `summary` view with `cta:{kind:'handoff', href}` (the LIVE shape today) | It renders | `ไปกรอกต่อที่หน้าจอง` as a `<Link>`, unchanged from round 1 | No `btn--ai-chat-booking-confirm` element exists on this render | AC-1/AC-2 (contrast) |
| AC-4 | A `summary` view has `isCurrent:false` (scrolled-back, superseded) | It renders | The CTA (either kind) and every control row button render visually unchanged | Every one of those elements carries the REAL `disabled` attribute, out of the tab order — a tap is a no-op | EC-2 |
| AC-5 | The component is handed a `submitting` view | It renders | The frozen summary rows + `ยืนยันการจอง` + `กำลังยืนยันการจอง…` below it | The confirm button carries `aria-disabled="true"` (never the `disabled` attribute); every OTHER control (`แก้วัน`/`แก้จำนวนคน`/`ยกเลิกการจอง`) carries the real `disabled` | EC-3 |
| AC-6 | The component is handed a `booked` view | It renders | `จองสำเร็จแล้ว` heading, the row card (camp/dates/guests/[spot]/`ยอดรวม`), `คุณจะยังไม่ถูกเรียกเก็บเงิน` + `ลานจะยืนยันการจองอีกครั้ง`, two links | No booking code/reference anywhere; no `msg--ai-chat-booking-step` framing, no control row (the flow has ended) | EC-4 |
| AC-7 | The component is handed a `bookingFailed` view, `reason:'rateLimited'` | It renders | An `ErrorBanner` (`กดจองถี่เกินไป…`) above the intact summary rows, then a re-enabled `ยืนยันการจอง` | No new buttons; tapping the re-enabled confirm calls `onConfirm` | EC-5 |
| AC-8 | Same, `reason:'uncertain'` | It renders | `เรายังไม่แน่ใจว่าการจองบันทึกไปหรือยัง…`, then `ตรวจสอบแล้วลองใหม่` (primary) + `ดูการจองของฉัน` (secondary) | No plain confirm button is offered (never a blind re-POST); `ตรวจสอบแล้วลองใหม่` calls `onCheckAndRetry` | EC-5 |
| AC-9 | Same, `reason:'sessionExpired'` | It renders | `คุณออกจากระบบไปแล้ว เข้าสู่ระบบอีกครั้งแล้วกดยืนยันได้เลย`, then the CTA reverted to `เข้าสู่ระบบเพื่อยืนยันการจอง` | Tapping calls `onConfirm` (same single prop as the guest gate) | EC-5 |
| AC-10 | Any `summary`/`booked`-card row renders | inspected | The row reads correctly as a label/value pair | No `role="row"` attribute anywhere (was a pre-existing orphan `aria-required-parent` axe violation) | — (structural, not a user-facing branch) |

## Rules
- BR-1 `BookingSummaryView.cta` replaces the old bare `handoffHref: string` field with a discriminated union (`{kind:'handoff', href}` | `{kind:'confirm', label, authState}`). `label` and `authState` are ALWAYS caller-supplied — this component never imports `useSession` and never decides the guest/member branch itself (design brief §5's "the label is passed in as a prop" instruction).
- BR-2 `submitting`/`booked`/`bookingFailed` are new members of the `BookingStepView` union with their own pure builders (`buildSubmittingView`/`buildBookedView`/`buildBookingFailedView`, `booking-view.ts`) — none of the three is called by `booking-turn.ts` today (grep-verified); they exist to be rendered by direct tests now and wired by CAM-702 next.
- BR-3 The in-flight confirm button (`submitting`) takes `aria-disabled="true"`, never the `disabled` attribute — it is the element with focus at the instant of the tap, and a real `disabled` would drop focus to `<body>`. It carries no `onClick`, so a second tap is a silent no-op (design brief §6 Critical).
- BR-4 A superseded (`isCurrent:false`) `summary` view's CTA and every control-row button take the REAL `disabled` attribute (out of the tab order), regardless of `cta.kind` — a scrolled-back summary must never be a live double-submit path (design brief §5 Critical).
- BR-5 F2 (`uncertain`) never offers a plain confirm button — only `ตรวจสอบแล้วลองใหม่` (`onCheckAndRetry`) + `ดูการจองของฉัน` (a plain `/bookings` link). F1/F3 reuse the SAME `BookingConfirmCta` shape + the SAME `onConfirm` prop the live summary CTA uses (design brief §8).
- BR-6 `SummaryRow` drops `role="row"` (was an orphan `aria-required-parent` axe violation with no `rowgroup`/`table`/`grid` ancestor, shipped via CAM-639); the new `booked` card's rows never carry it either (design brief §12 Important).

## Edge cases
- EC-1 IF the caller ever hands a `cta.kind` this component does not recognise (impossible at the type level, TS exhaustive) THEN there is no runtime branch to fall into — the discriminated union is total.
- EC-2 IF a superseded summary is tapped with a keyboard (Enter/Space on a focused `disabled` button) THEN nothing fires — `disabled` removes the element from the tab order entirely, so it cannot receive focus to begin with.
- EC-3 IF the composer is used while `submitting` is on screen THEN this component does not disable it (unchanged CAM-637 rule E; the composer is owned by `AiChatPanel.tsx`, outside this story's surface).
- EC-4 IF `booked`'s `spotValue` is absent (whole-camp booking) THEN no pitch row renders — never a fabricated `—` (same rule `buildSummaryView`'s `spotValue` already follows).
- EC-5 IF `bookingFailed`'s `cta` is absent on a `reason` other than `'uncertain'` THEN no CTA renders at all (a defensive `view.cta ?` guard) — today this is unreachable (F1/F3 always carry one), kept only because the field is optional at the type level.

## Data
No schema/DB change. Pure presentation types + two new pure builder functions; no new query, no new endpoint.

## Seams & refs
- Reuse: `components/ui/button.tsx` (default/outline/ghost, `size="lg"`/`"sm"`) · `components/ui/error-banner.tsx` (F1/F2/F3's banner) · `components/ai-chat/ChatChipRow.tsx` (unchanged) · `next/link` via `Button asChild` (the round-1 handoff/success-link idiom) · `lucide-react`'s `CheckCircle2` (the one new icon design brief §11 names).
- Refs: design brief CAM-697 §5-§12 (the exact copy/state/testid/a11y contract) · CAM-638's own file header ("build the views + the props, prove them by rendering, leave the handlers as props the next story fills") · ADR-018.
- Two cam-638 test pins were superseded with dated notes (their premise — round 1 writes nothing — is retired for the WRITE surface by ADR-018/CAM-697 §0): the summary render test's "never confirm/book now" assertion (kept, now scoped explicitly to the `kind:'handoff'` shape it still tests) and the copy sweep's "no จองสำเร็จ anywhere" (re-scoped to exempt `success.*` + the one `summary.estimateNote` string that names a FUTURE "once it succeeds" event, per design brief §13.2's exact text). Six more test files (`cam-639`/`cam-640`/`cam-699`×2/`cam-700`×3) had their `handoffHref` field access mechanically renamed to `cta.href` — same behaviour, new field name, each carries a `CAM-701` comment.

## Out of scope
- The real `POST /api/bookings` call, the live session read, and wiring `submitting`/`booked`/`bookingFailed` into `booking-turn.ts`/`use-ai-chat.ts`/`AiChatMessageList.tsx`/`AiChatPanel.tsx` → CAM-702.
- `LoginModal`'s lazy-import + open-on-guest-tap behaviour (design brief §5) — this component only ever calls the single `onConfirm` prop; the caller (CAM-702) decides whether that means "open the login modal" or "POST" based on live session.
- The `ตรวจสอบแล้วลองใหม่` button's OWN in-flight loading sub-state (design brief §9 column I's "while its own check is in flight" row) — the mechanism for the check itself is the architect's contract (design brief §14 #2), not yet decided; this story renders the button's default state only.
- Fixing the pre-existing "superseded blocks keep their chips tappable" gap (design brief §5, explicitly named there as out of scope) and the missing `editNights` control in `buildSummaryView`'s live `controls` array (a pre-existing gap predating this story, found during build, flagged for a follow-up ticket rather than fixed here since it touches five sibling test files outside this story's declared surface).

## Self-verify
- AC-1/AC-2/AC-3 → jsdom render: `__tests__/cam-701-ai-chat-booking-step-confirm.test.ts` ("summary — confirm CTA" + the handoff-still-renders case).
- AC-4 → jsdom render: same file, "summary — superseded (isCurrent:false) goes REALLY inert" (both cta kinds).
- AC-5 → jsdom render: same file, "submitting — the write in flight".
- AC-6 → jsdom render: same file, "booked — the terminal success state" (asserts no `CAMP-` reference text, no step/control-row testids).
- AC-7/AC-8/AC-9 → jsdom render: same file, "bookingFailed — F1/F2/F3".
- AC-10 → jsdom render: same file, "a11y — the dropped role=row".
- Copy (TH verbatim + EN parity, every new/changed key) → `__tests__/cam-701-booking-copy.test.ts`.
- The three pure builders (`buildSubmittingView`/`buildBookedView`/`buildBookingFailedView`) → `__tests__/cam-701-booking-view.test.ts`.
- Gate = `/quality-gate` · Done = merged into `dev` with the full suite green (12300+ tests) + lint 0 errors + typecheck clean + `npm run build` green + `check:ds`/`check:palette` green + AC verified on localhost (dev DB — nothing to seed, pure presentation).

## Changelog
- v1 (2026-08-06) — created.
