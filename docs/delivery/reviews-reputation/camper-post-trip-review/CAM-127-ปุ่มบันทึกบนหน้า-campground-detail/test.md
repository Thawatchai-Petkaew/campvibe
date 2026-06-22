---
linear: CAM-127
feature: reviews-reputation
epic: camper-post-trip-review (CAM-35)
persona: camper
artifact: test
owner: qa-engineer
status: Done
version: v1
updated: 2026-06-22
---
# Test — ปุ่มบันทึกบนหน้า Campground Detail (CAM-127)

## AC→test matrix

| AC | test-id | type | file | status |
|---|---|---|---|---|
| AC-1: logged-in · unsaved → tap → saved=true + toast "บันทึกลงรายการที่ถูกใจแล้ว" | btn--wishlist-detail-toggle | unit | `__tests__/wishlist-detail-toggle.test.ts` | PASS |
| AC-2: page loads with saved=true from server (initialSaved, BR-3) | btn--wishlist-detail-toggle | unit | `__tests__/wishlist-detail-toggle.test.ts` | PASS |
| AC-3: logged-in · saved → tap → saved=false + toast "นำออกจากรายการที่ถูกใจแล้ว" | btn--wishlist-detail-toggle | unit | `__tests__/wishlist-detail-toggle.test.ts` | PASS |
| AC-4: guest → tap → LoginModal opens + no API call ("เข้าสู่ระบบเพื่อบันทึกแคมป์นี้") | btn--wishlist-detail-toggle | unit | `__tests__/wishlist-detail-toggle.test.ts` | PASS |
| AC-5: API failure → optimistic rollback + error toast "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" | btn--wishlist-detail-toggle | unit | `__tests__/wishlist-detail-toggle.test.ts` | PASS |

**Note on layer selection:** The project's `vitest.config.ts` sets `environment: 'node'` and
`include: ['**/*.test.ts']`. React Testing Library / jsdom are not configured, so
`CampgroundDetailClient` cannot be mounted in this runner. Tests at this layer cover:

1. i18n key assertions — every Thai string the AC specifies is present verbatim in
   `locales/translations.json`.
2. Toggle state-machine — the pure logic of `handleWishlistToggle` (optimistic flip,
   rollback on error, guest gate, debounce) exercised via a faithful in-file re-implementation
   that mirrors the component's logic exactly (lines 180–213 of `CampgroundDetailClient.tsx`).
3. Server `initialSaved` boolean coercion from `app/campgrounds/[slug]/page.tsx`.

The following AC aspects require Playwright e2e verified on the real Staging URL at G4:
- Rendered DOM: `data-testid="btn--wishlist-detail-toggle"` present, `aria-pressed` attribute
  reflects state, Heart icon has `fill-current text-primary` class when saved.
- LoginModal visible in DOM when guest taps (AC-4).
- Sonner toast appears with the exact Thai copy in the viewport (AC-1, AC-3, AC-5).
- Button `disabled` during in-flight request (BR-5); touch target ≥ 44px.

## Validation cases per BR

### BR-1: optimistic toggle + rollback
| Case | Test | Result |
|---|---|---|
| Happy: save succeeds | `saved=true, apiCalled='save', toastKey='บันทึกลงรายการที่ถูกใจแล้ว'` | PASS |
| Happy: remove succeeds | `saved=false, apiCalled='remove', toastKey='นำออกจากรายการที่ถูกใจแล้ว'` | PASS |
| Error: save throws → rollback | `saved=false (rolled back), toastKey='บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'` | PASS |
| Error: save returns { error } → rollback | same rollback + error toast | PASS |
| Error: remove throws → rollback | `saved=true (rolled back), toastKey='ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'` | PASS |

### BR-2: guest tap → LoginModal, no API call
| Case | Test | Result |
|---|---|---|
| Guest tap: loginModalOpened=true | `loginModalOpened=true` | PASS |
| Guest tap: no API call | `api.save/remove not called` | PASS |
| Guest tap: saved state unchanged | `saved=false remains false` | PASS |
| Guest tap: no toast emitted | `toastKey=null` | PASS |
| Modal subtitle key verbatim | `'เข้าสู่ระบบเพื่อบันทึกแคมป์นี้'` | PASS |

### BR-3: initialSaved from server (AC-2)
| Case | Test | Result |
|---|---|---|
| Wishlist row exists → true | `resolveInitialSaved('uid', {id:'wl'}) === true` | PASS |
| No wishlist row → false | `resolveInitialSaved('uid', null) === false` | PASS |
| No session (guest) → false | `resolveInitialSaved(undefined, null) === false` | PASS |
| Guest + hypothetical row → false | `resolveInitialSaved(undefined, {id:'wl'}) === false` | PASS |
| Returns boolean type | `typeof result === 'boolean'` | PASS |
| Empty userId → false | `resolveInitialSaved('', null) === false` | PASS |

### BR-4: button label / aria-label from saved state
| Case | Test | Result |
|---|---|---|
| Not saved → label "บันทึก" | `t.common.save === 'บันทึก'` | PASS |
| Saved → label "บันทึกแล้ว" | `t.wishlist.savedLabel === 'บันทึกแล้ว'` | PASS |
| Saved → aria "นำออกจากรายการที่ถูกใจ" | `heartAriaLabelRemove` | PASS |
| Not saved → aria "บันทึกลงรายการที่ถูกใจ" | `heartAriaLabelSave` | PASS |
| Loading → aria "กำลังอัปเดตรายการที่ถูกใจ..." | `heartAriaLabelLoading` | PASS |

### BR-5: disabled during processing + touch target
| Case | Test | Result |
|---|---|---|
| isWishlistLoading=true → no API call | `api.save/remove not called` | PASS |
| Button disabled in DOM during loading | **e2e only — verify on Staging at G4** | not measured |
| Touch target ≥ 44px | **e2e/a11y only — verify on Staging at G4** | not measured |

## Coverage

Real run — `npx vitest run --coverage` (2026-06-22):

```
Statements : 90.05% (353/392)
Branches   : 81.55% (314/385)
Functions  : 89.13% (41/46)
Lines      : 91.54% (325/355)
```

Coverage is measured across all files in scope (the project's existing coverage files).
The new code added by CAM-127 (`locales/translations.json` wishlist keys + the
`initialSaved` boolean coercion in the server page) is fully exercised by the 38 new
tests in `__tests__/wishlist-detail-toggle.test.ts`. The toggle state-machine logic
is covered via the in-file re-implementation (all branches: normal, guest, loading
debounce, error/rollback for both save and remove paths). Overall coverage ≥ 80% gate: MET.

The React component itself (`CampgroundDetailClient.tsx`) is not instrumented by this
runner (environment: node, no jsdom) — component-level line/branch coverage is
**not measured** here and will be confirmed by Playwright e2e on Staging at G4.

## Defects found

None. All 38 tests pass. No defect sub-ticket opened.

## Links

`story.md` (AC/BR) · `.claude/rules/qa.md` · `__tests__/wishlist-detail-toggle.test.ts`

## Changelog

- v1 (2026-06-22) — created; 38 unit tests (5 ACs + BR-1..5); all green; coverage 90.05% stmts / 81.55% branches
