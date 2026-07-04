---
linear: CAM-273
feature: loading-ux
epic: loading-ui-standard-and-renovation (CAM-243)
persona: platform
artifact: delivery
owner: devops-release
status: Done
version: v1
updated: 2026-07-02
---
# Delivery — CAM-273 LOAD-5 root fallback = delayed spinner

## Change
- `app/loading.tsx`: `RootShellSkeleton` → delayed centered `LoadingSpinner` (`.skeleton-delay-show` 300ms; a11y `role=status`/`aria-busy`/`aria-live=polite` + sr-only `กำลังโหลด…` จาก i18n; `data-testid="shell--root-spinner"`).
- `components/ui/loading-spinner.tsx`: `motion-reduce:animate-none` (spin + pulse text).
- ลบ `components/ui/root-shell-skeleton.tsx` (dead code หลังเปลี่ยน).
- Guard tests: `cam-246-loading-foundation.test.ts` AC-A rewritten (+ file-gone check) · `cam-197-loading-skeletons.test.ts` AC-6 rewritten.
- `app/status/map/loading.tsx`: comment-only update.

## Quality gate (run for real, pre-merge)
lint 0 errors · typecheck clean · test 92 files / 4512 passed · build OK (63 routes) · check:ds PASS · check:palette PASS. CI quality-gate PASS on PR #278. (`visual-a11y` fail = workflow env ขาด `DATABASE_URL`/UntrustedHost — advisory, ไม่เกี่ยว diff.)

## Ship
- PR: https://github.com/Thawatchai-Petkaew/campvibe/pull/278 → merged `staging` 2026-07-02T10:07:58Z (`5273490`), branch deleted.
- Staging verify (ground truth, curl `https://campvibe-staging.vercel.app/status` ซึ่งเป็น route force-dynamic ไม่มี loading เฉพาะ):
  - `shell--root-spinner` present ✓ (spinner fallback ใหม่ stream จริง)
  - `shell--root-skeleton` = 0 ✓ (generic skeleton เดิมหายไป)
  - `skeleton-delay-show` present ✓ (300ms anti-flash delay)
- AC3 (route-level loading เดิมไม่ถูกแตะ): ไฟล์ loading.tsx ของ bookings/dashboard/profile/wishlist/campgrounds/[slug]/bookings/[id]/status-map ไม่อยู่ใน diff (ยกเว้น comment ของ status/map).

## Follow-up (info)
- `DESIGN.md` + `.claude/rules/loading.md` ยังกล่าวถึง `RootShellSkeleton *(planned)*` — stale reference; เก็บเป็นงาน docs เล็กของ Designer.
- prod ยังไม่ปล่อย (Done ≠ Released) — รอ release train ถัดไป.
