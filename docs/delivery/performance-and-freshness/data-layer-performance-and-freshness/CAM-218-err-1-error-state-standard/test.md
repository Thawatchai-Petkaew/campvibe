---
linear: CAM-218
feature: performance-and-freshness
epic: data-layer-performance-and-freshness
persona: Camper
artifact: test
owner: qa-engineer
status: In Progress
version: v1
updated: 2026-06-27
---
# Test — ERR-1 Platform Error-State Standard (CAM-218)

## AC→test matrix

| AC | test-id | layer | pass/fail |
|---|---|---|---|
| AC-1 Variant render (mascot testid, PNG path, i18n key, ImageWithFallback) | `img--error-mascot-<variant>` | source-inspect | pass |
| AC-2 CTA behaviour (primary/secondary testids, onRetry guard, single CTA for non-error, retry+home for error) | `btn--error-primary-<variant>`, `btn--error-secondary-<variant>` | source-inspect | pass |
| AC-3 Prop override (title/message/actionLabel nullish-coalesce i18n defaults) | `section--error-state-prop-override` | source-inspect | pass |
| AC-4 a11y role (role="alert" on error, role="status" on others, aria-hidden on decorative elements) | `section--error-state-a11y-role` | source-inspect | pass |
| AC-5 i18n verbatim (EN + TH all 4 variant keys character-for-character) | `section--error-state-i18n-verbatim` | source-inspect | pass |
| AC-6 No stack leak (app/error.tsx + app/global-error.tsx + app/dashboard/error.tsx do not render error.message/stack) | `section--error-page-no-stack-leak` | source-inspect | pass |
| AC-7 Graceful fallback (ImageWithFallback errored state, ImageOff placeholder, onError handler) | `section--error-state-image-fallback` | source-inspect | pass |

## Test file

`__tests__/cam-218-err-1-error-state.test.ts` — 99 tests across 10 describe blocks.

## Validation cases

**AC-1 (variant render) — coverage matrix:**

| case | test |
|---|---|
| normal (all 4 variants wired) | mascot path exists for each variant in VARIANT_MASCOT map |
| i18n key mapping | VARIANT_KEY maps "not-found"→"notFound", "error"→"unexpected", etc. |
| component used | ImageWithFallback (not plain img) renders the mascot |
| type completeness | ErrorVariant type + ErrorStateProps interface exported |

**AC-2 (CTA behaviour) — coverage matrix:**

| case | test |
|---|---|
| normal (error + onRetry) | primary retry button (onClick={onRetry}) + secondary home button both rendered |
| normal (non-error) | single primary CTA (asChild Link) rendered; no secondary |
| error without onRetry | retry NOT rendered (conditional `variant === "error" && onRetry` guards it) |
| retry label source | retryLabel from `t.errors.unexpected.retryLabel` (not hardcoded) |
| default href | actionHref defaults to "/" |
| icons | RotateCcw on retry, Home on home button |

**AC-3 (prop override) — coverage matrix:**

| case | test |
|---|---|
| title override | `title ?? copy.title` nullish-coalesces; resolved value used in h1 |
| message override | `message ?? copy.message` |
| actionLabel override | `actionLabel ?? copy.cta` |
| optional prop declarations | title?, message?, actionLabel?, actionHref?, onRetry?, compact? |

**AC-4 (a11y role) — coverage matrix:**

| case | test |
|---|---|
| error variant | role="alert" assigned by ternary |
| all other variants | role="status" assigned by ternary |
| decorative elements | glow ring + icons have aria-hidden="true" (≥3 occurrences) |
| compact does not gate role | compact changes layout class only; role ternary on same wrapper |

**AC-5 (i18n verbatim) — coverage matrix:**

| case | test |
|---|---|
| EN notFound.title | "Page not found" |
| EN notFound.cta | "Back to home" |
| EN unexpected.retryLabel | "Try again" |
| EN unexpected.title | "Something went wrong" |
| EN forbidden.title | "Access not permitted" |
| EN generic.cta | "Back to home" |
| TH notFound.title | "ไม่พบหน้านี้" (char-for-char) |
| TH notFound.message | "หน้านี้ถูกย้ายหรือไม่มีอยู่แล้ว กลับไปหน้าหลักเพื่อค้นหาแคมป์ที่ชอบ" |
| TH notFound.cta | "กลับหน้าหลัก" |
| TH unexpected.title | "เกิดข้อผิดพลาด" |
| TH unexpected.retryLabel | "ลองใหม่อีกครั้ง" |
| TH unexpected.cta | "กลับหน้าหลัก" |
| TH unexpected.message | "มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น ลองใหม่อีกครั้งหรือกลับหน้าหลัก" |
| TH forbidden.title | "ไม่มีสิทธิ์เข้าถึง" |
| TH forbidden.cta | "กลับหน้าหลัก" |
| TH generic.title | "เกิดข้อผิดพลาด" |
| TH generic.message | "โหลดหน้านี้ไม่สำเร็จ กรุณาลองใหม่ภายหลัง" |
| TH generic.cta | "กลับหน้าหลัก" |
| completeness (all 4 variants) | title, message, cta, mascotAlt present in both EN + TH |

**AC-6 (no stack leak) — coverage matrix:**

| case | test |
|---|---|
| app/error.tsx | `{error.message}` absent from JSX (comments stripped before assertion) |
| app/error.tsx | `{error.stack}` absent from JSX |
| app/error.tsx | delegates to ErrorState variant="error" (generic copy) |
| app/error.tsx | passes reset as onRetry (recovery without reload) |
| app/error.tsx | console.error in useEffect (dev/server only, not rendered to DOM) |
| app/global-error.tsx | error.message/stack absent from JSX |
| app/global-error.tsx | bilingual TH+EN copy self-contained (no providers) |
| app/global-error.tsx | reset() called by reload button |
| app/global-error.tsx | owns html+body (replaces root layout) |
| app/global-error.tsx | mascot img hides gracefully on error (onError display:none) |
| app/dashboard/error.tsx | error details not exposed |

**AC-7 (graceful fallback) — coverage matrix:**

| case | test |
|---|---|
| normal (src present) | errored=false → next/image renders |
| error (src fails) | onError → setErrored(true) → showFallback=true → ImageOff renders |
| null/absent (no src) | !src → showFallback=true → ImageOff renders |
| fallback icon | ImageOff (lucide-react) is the placeholder |
| testid passthrough | data-testid accepted + forwarded to wrapper |
| fallback testid | `${testId}--fallback-placeholder` convention |

## Coverage

Source-inspection layer: the production files (`components/ErrorState.tsx`, `components/ui/image-with-fallback.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/dashboard/error.tsx`, `app/not-found.tsx`, `locales/translations.json`) are read with `readFileSync` and parsed as strings. No production modules are imported or executed. v8 reports 0/0 (no executable statements imported), which is the expected and correct result for this layer — identical to cam-197, cam-181, cam-184, and every other source-inspection test in this project.

The 80% coverage gate applies to code that IS imported and executed in the Node test environment (API routes, server actions, utilities). React components behind `"use client"` (which require `useLanguage`, `useState`, and `next/image`) cannot be executed in the `node` vitest environment without mocking the layers under test, which qa.md §6 explicitly prohibits.

Coverage on diff: **not measured** (source-inspection layer; see above). Structural correctness: 99/99 tests green.

## Prove-It (red-then-green)

The test file was written against the production source. Each assertion cites exactly what change would turn it red:

- Removing `"use client"` from any file → directive tests fail.
- Changing any Thai glyph in `translations.json` → verbatim assertion fails.
- Removing `onRetry` guard from CTA logic → retry-conditional test fails.
- Adding `{error.message}` to `app/error.tsx` JSX → stack-leak security test fails.
- Changing `data-testid={`img--error-mascot-${variant}`}` format → testid test fails.
- Removing `showFallback = !src || errored` from ImageWithFallback → fallback test fails.

All 99 tests were green on first run after the `"use client"` semicolon fix (the directive is `"use client";` — stripping the trailing semicolon is required when matching the line literally).

## Links

`design.md` · `.claude/rules/qa.md`

## Changelog

- v1 (2026-06-27) — created by QA agent for CAM-218 ERR-1
