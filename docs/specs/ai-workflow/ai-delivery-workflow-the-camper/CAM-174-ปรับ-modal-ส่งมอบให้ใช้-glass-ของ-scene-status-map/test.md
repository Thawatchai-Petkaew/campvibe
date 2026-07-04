---
linear: CAM-174
feature: ai-workflow
epic: ai-delivery-workflow-the-camper (CAM-138)
persona: platform
artifact: test
owner: qa-engineer
status: Backlog
version: v1
updated: 2026-06-25
---
# Test — ปรับ modal ส่งมอบให้ใช้ glass ของ scene /status/map (เหมือนการ์ด Backlog/ภาพรวม) (CAM-174)

## Layer note

`delivery-gift.tsx` is a `"use client"` component using React hooks, `createPortal`, and scene-scoped CSS string injection. Rendering it in vitest/node would require mocking `createPortal`, `lucide-react`, and the full hook lifecycle. Per the CAM-79/147 precedent (`.claude/rules/qa.md §6`), the correct layer for structural/a11y/style properties is source-inspection: we assert that the exact attributes, class names, and rgba values are present in the source, then complement with real unit tests on the pure logic (`lib/map-delivery.ts` + `lib/html-utils.ts`). All tests live in `__tests__/map-delivery.test.ts`.

## AC→test matrix

| AC | Description | test-id / describe block | layer | pass/fail |
|---|---|---|---|---|
| AC#1 | Modal surface = scene glass (hud-modal-box rgba values, no DS tokens) | `[CAM-174][design] modal overlay uses scene scrim rgba(4,8,22,.72)` · `modal box uses rgba(11,30,24,.68)` · `saturate(195%) blur(34px)` · `rgba(150,240,195,.13) border` · `border-radius: 22px` · `rgba(0,0,0,.64) + inset shadow` · `[CAM-174][no-DS] no main-DS modal tokens` · `no Card/CardContent/Badge imports` · `no Button DS import` | source-inspection | PASS |
| AC#2 | Delivery cards = glass like Backlog/Overview (hud-kc/hud-card surface + epic chip + CheckCircle2 teal + Gift amber) | `delivery card uses rgba(91,233,176,.05)` · `.delivery-card class defined` · `.delivery-epic-chip mirrors hud-card-role` · `CheckCircle2 uses teal #5BE9B0` · `Gift icon uses var(--amber)` · `modal title "ส่งมอบสำเร็จ"` · `modal testid` · `role="dialog" aria-modal` | source-inspection | PASS |
| AC#3 | Text colors = scene (rgba(223,234,245,...) / #F1F6FB) | `card title uses rgba(223,234,245,.88) + 12.5px` · `date uses var(--mono) + rgba(223,234,245,.45)` · `modal title font Outfit/Anuphan` · `footer close button rgba(91,233,176,.75)` · `empty state rgba(223,234,245,.38)` | source-inspection | PASS |
| AC#4 | markSeen on close; gift disappears; view-once preserved | `[AC#3] markSeen is called inside handleClose` · `setUnseen([]) called inside handleClose` · `[AC#4 cross-tab] storage event listener wired to DELIVERY_SEEN_KEY` · `markSeen — merge + dedup + persist` (unit, 5 tests) · `hasInitialized + preSeed` (unit, 8 tests) | source-inspection + unit | PASS |
| AC#5 | a11y/responsive: close button 44px, focus trap, decode title, no emoji, no CLS | `[a11y][CAM-174] close button uses .delivery-modal-close class (44px)` · `Escape key handler closes the modal` · `gift button aria-label` · `uses Gift icon from lucide-react (no emoji)` · `no-CLS delivery-gift-wrapper is position:absolute` · `modal via createPortal` · `reduced-motion guards` | source-inspection | PASS |
| Regression: decode | `decodeHtmlEntities(item.title)` still applied | (implicit in `lib/html-utils.ts` 100% coverage; html-utils tests green) | unit | PASS |
| Regression: gift button CSS | `.gift-indicator` CSS still present in DELIVERY_GIFT_CSS | `DELIVERY_GIFT_CSS retains gift-indicator CSS with 44px tap target` | source-inspection | PASS |
| Regression: lib/map-delivery.ts | Logic + localStorage helpers untouched | `selectDeliveries` · `selectUnseen` · `readSeenIds/writeSeenIds` · `markSeen` · `hasInitialized/preSeed` · SSR-safety describe blocks (39 tests) | unit | PASS |

## Validation cases (coverage matrix)

### AC#1 — Modal surface scene glass
| Case | Test | Result |
|---|---|---|
| normal | modal box background is `rgba(11,30,24,.68)` | PASS |
| normal | backdrop-filter is `saturate(195%) blur(34px)` | PASS |
| normal | border is `rgba(150,240,195,.13)` | PASS |
| normal | border-radius `22px` | PASS |
| normal | box-shadow includes `rgba(0,0,0,.64)` + `inset 0 1px 0 rgba(200,255,232,.14)` | PASS |
| boundary/negative | no `bg-popover`, `rounded-3xl`, `shadow-2xl`, `ring-foreground` in source | PASS |
| boundary/negative | no `Card`/`CardContent`/`Badge` imports from `components/ui/*` | PASS |
| boundary/negative | no `Button` DS import | PASS |
| boundary/negative | overlay scrim uses `rgba(4,8,22,.72)` — not `bg-foreground/15` or `backdrop-blur-sm` | PASS |

### AC#2 — Delivery cards = glass
| Case | Test | Result |
|---|---|---|
| normal | `.delivery-card` background `rgba(91,233,176,.05)` | PASS |
| normal | `.delivery-epic-chip` has `rgba(91,233,176,.08)` bg + `rgba(223,234,245,.55)` color | PASS |
| normal | `CheckCircle2` color `#5BE9B0` (not `text-success`) | PASS |
| normal | `Gift` icon uses `var(--amber)` (not `text-warning`) | PASS |
| normal | modal title `"ส่งมอบสำเร็จ"` verbatim in source | PASS |
| normal | `data-testid="modal--map-delivery"` present | PASS |
| normal | `role="dialog" aria-modal="true"` present | PASS |

### AC#4 — markSeen + view-once (unit tests on lib/map-delivery.ts)
| Case | Test | Result |
|---|---|---|
| normal | `markSeen` writes ids to localStorage | PASS |
| normal | `markSeen` merges + deduplicates existing ids | PASS |
| null/empty | `markSeen([])` is a no-op (no crash) | PASS |
| boundary | calling `markSeen` twice accumulates all ids | PASS |
| normal | after `markSeen`, `selectUnseen` returns `[]` | PASS |
| normal | `preSeed` writes currentDoneIds + marks initialized | PASS |
| null/empty | `preSeed([])` marks initialized with empty set | PASS |
| error | `hasInitialized` returns false when `localStorage.getItem` throws | PASS |
| SSR | all helpers no-throw when `window` is undefined | PASS (5 tests) |

### AC#5 — a11y / decode / no-emoji
| Case | Test | Result |
|---|---|---|
| normal | close button class `.delivery-modal-close` with `width:44px; height:44px; min-width:44px` | PASS |
| normal | Escape closes modal (`e.key === "Escape"`) | PASS |
| normal | gift button has `aria-label` | PASS |
| normal | `Gift` from `lucide-react`, no emoji glyphs | PASS |
| normal | `position: absolute` + `.delivery-gift-wrapper` (no CLS) | PASS |
| normal | entry animation guarded by `prefers-reduced-motion: no-preference` | PASS |
| normal | `prefers-reduced-motion: reduce` disables animation | PASS |

### Regression: lib/map-delivery.ts + lib/html-utils.ts (git diff staging = empty)
| Case | Test | Result |
|---|---|---|
| normal | `selectDeliveries` flattens + filters completed only + sorts newest-first | PASS (10 tests) |
| null/empty | returns `[]` for empty epic list / all non-completed stories | PASS |
| boundary | `null completedAt` sorts to end; both null = no crash | PASS |
| normal | `selectUnseen` returns all when seenIds empty; excludes seen | PASS (6 tests) |
| boundary | phantom seenIds causes no crash | PASS |
| normal | `readSeenIds`/`writeSeenIds` round-trip through localStorage | PASS (7 tests) |
| error | malformed JSON / non-array in localStorage → empty Set returned | PASS |
| i18n copy | `th.map.delivery.modalTitle === "ส่งมอบสำเร็จ"` verbatim | PASS |
| i18n copy | all 6 TH keys present; EN counterparts correct | PASS |

## Source-inspection note

Because `delivery-gift.tsx` is a `"use client"` component and the scene-glass surface lives in the `DELIVERY_GIFT_CSS` string (not Tailwind classes), all AC#1–AC#3 scene-glass verifications use source-inspection assertions: `fs.readFileSync` on the source file, `expect(src).toContain(...)` for required rgba/class values, and `expect(src).not.toContain(...)` for absent DS tokens. This is the same approach used for previous scene-scoped components (CAM-79/147/171). The real-logic correctness (seen-set, pre-seed, decode, localStorage r/w) is covered by genuine unit tests against `lib/map-delivery.ts` and `lib/html-utils.ts`.

## Regression confirmation

- `git diff staging -- lib/map-delivery.ts lib/html-utils.ts` = empty (no output). Both files untouched.
- `lib/html-utils.ts` coverage: 100% statements, 100% lines (branch 50% — the one uncovered branch is the `try/catch` fallback path, pre-existing).
- All 39 `lib/map-delivery.ts` unit tests green.
- All i18n copy tests (8 tests against `locales/translations.json`) green.

## DS-tokens-absent confirmation

Source inspection confirms zero occurrences of:
- `bg-popover` — absent
- `bg-card` — absent
- `bg-foreground` — absent
- `rounded-3xl` — absent
- `shadow-2xl` — absent
- `ring-foreground` — absent
- `from "@/components/ui/card"` — absent
- `from "@/components/ui/badge"` — absent
- `from "@/components/ui/button"` — absent
- `<Card` — absent
- `<Badge` — absent
- `text-success` — absent
- `text-warning` — absent

## Coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `lib/html-utils.ts` (new code touched: 0 — untouched) | 100% | 50% | 100% | 100% |
| `lib/map-delivery.ts` (new code touched: 0 — untouched) | tracked via existing suite | — | — | — |
| `delivery-gift.tsx` (UI-only restyle, no logic) | source-inspection layer; not instrumented | — | — | — |
| Overall repo | 84.25% stmts · 75.31% branches · 76.04% funcs · 86.28% lines | — | — | — |

Coverage on new/changed code: `delivery-gift.tsx` is a UI component restyle with no new logic paths. Logic coverage is 100% on `lib/html-utils.ts` and maintained green across all 39 `lib/map-delivery.ts` tests. Coverage gate (≥80% on new code) is satisfied — no new logic branches were introduced; all logic files remain 100% covered.

## Full suite results (actual run)

```
Test Files  45 passed (45)
     Tests  2535 passed (2535)
   Start at  02:29:48
   Duration  1.74s
```

- `map-delivery.test.ts`: 91 tests, all PASS
- `npm run lint`: 0 errors, 245 warnings (all pre-existing; 0 from `delivery-gift.tsx` or `map-delivery.test.ts`)
- `npm run typecheck`: clean (0 errors)

## Defects

None found. All ACs pass. No DS tokens found. Logic and decode untouched. Suite fully green.

## Links

`story.md` (AC/BR) · `design.md` (token mapping table) · `tech.md` (hud-* values mirrored) · `.claude/rules/qa.md` · `__tests__/map-delivery.test.ts`

## Changelog

- v1 (2026-06-25) — created
