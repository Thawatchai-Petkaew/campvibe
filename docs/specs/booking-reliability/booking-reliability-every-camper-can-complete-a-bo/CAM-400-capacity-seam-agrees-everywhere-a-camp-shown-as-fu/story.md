---
artifact: story
owner: product-owner
version: 1
status: In Progress
---

# CAM-400 — Capacity seam agrees everywhere: a camp shown as full can never be booked (0 = closed, null = unlimited)

## Story

As a **Camper**, I want a camp that says เต็มแล้ว to actually be unbookable, so that I never create a booking the host cannot honor. Scope: the whole capacity seam — write gate + availability calendar + reserve button + one cross-layer invariant test. Depends on: — . Why (G4 finding, confirmed on staging): whole-camp `maxGuestsPerDay=0` → `remaining-capacity` + the catalog badge read `0` as FULL, but the availability calendar + the write gate use falsy checks (`maxGuestsPerDay && …`) → `0` = unbounded → the booking POST returns 201 and redirects while the red เต็มแล้ว banner is on screen (4 such camps live). Three prior stories (CAM-351/355/344) each preserved the divergence "by construction" — this story closes the seam per the new architecture.md §15b invariant rule.

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | แคมป์แบบทั้งลานที่ความจุเป็นศูนย์ ผู้ใช้เข้าสู่ระบบแล้ว | ส่งคำขอจอง (แม้ปุ่มถูกปิด ก็ยิงตรงได้) | ข้อความ `จองไม่สำเร็จ` | เซิร์ฟเวอร์ปฏิเสธ (409) ไม่มี Booking ถูกสร้าง | EC-1 |
| AC-2 | แคมป์เดียวกัน | เปิดปฏิทินเลือกวัน | วันทั้งหมดเลือกไม่ได้ (เต็ม) | ปฏิทินกับป้าย เต็มแล้ว พูดตรงกัน | EC-2 |
| AC-3 | ป้ายขึ้น `เต็มแล้ว` | มองปุ่มจอง | ปุ่มจองกดไม่ได้ (จาง) | ไม่มีคำขอถูกยิงจากปุ่ม | EC-3 |
| AC-4 | แคมป์ที่ไม่จำกัดความจุ (ค่าไม่ได้ตั้ง) | จองตามปกติ | จองได้ตามเดิม | พฤติกรรม null = ไม่จำกัด คงเดิม | EC-4 |

## Rules

- BR-1 (the invariant): **`null` = unlimited · `0` = closed/full — uniformly in EVERY layer.** No layer keys off the truthiness of a capacity number.
- BR-2: write gate `lib/campsite-availability.ts` whole-camp branch (~L755): `maxGuestsPerDay && …` → `maxGuestsPerDay !== null && …` (mirror the per-spot branch). Same for the tents check if present.
- BR-3: availability route `app/api/campsites/[id]/availability/route.ts` whole-camp `isCapacityFull` / `remainingGuests` / `remainingTents` (~L108-123): falsy checks → `!== null`.
- BR-4: client defense-in-depth: the reserve button disables when `isFullyBooked` (banner and button can never disagree); server stays authoritative.
- BR-5: **cross-layer invariant test** — one test walks the matrix {null, 0, positive-with-room, positive-full} × {whole-camp, per-spot} and asserts availability-read, remaining-capacity-read, and the write gate AGREE on bookability for every cell (per-layer tests cannot see divergence). This covers CAM-399's per-spot class.

## Edge cases

- EC-1: IF a direct POST targets a 0-capacity camp THEN 409 every night (the gate, not the UI, is the guard).
- EC-2: IF whole-camp capacity is 0 THEN availability reports every date unavailable (calendar disables).
- EC-3: IF `isFullyBooked` THEN the button is disabled AND `handleReserve` early-returns (double defense).
- EC-4: IF capacity is `null` THEN nothing changes anywhere (unbounded preserved — no regression on normal camps).
- EC-5: IF per-spot with 0 live spots THEN all layers already say full — the invariant test pins it (closes CAM-399).

## Data

No schema change. Data note (out of scope, flagged): whether a published whole-camp camp may legally hold `maxGuestsPerDay=0` → publish-gate question for CAM-365; after this fix such camps are correctly unbookable (เต็มแล้ว everywhere).

## Seams & refs

Reader/writer inventory (per §15b): write gate `checkDateAvailabilityInTx` (NOW) · availability route (NOW) · remaining-capacity `getRemainingCapacity` (NO-CHANGE — already `!== null`) · catalog badge `getAvailabilityStatusForCamps` (NO-CHANGE — already `!== null`) · widget button (NOW) · spot-aggregation per-spot path (NO-CHANGE — already fail-closed, pinned by the invariant test). Search terms: `maxGuestsPerDay`, `maxTentsPerDay`, `getEffectiveCapacity`, `remaining`, `isCapacityFull`.

## Out of scope

Publish-gate validation of `0` (CAM-365) · per-spot behavior changes (already sound — pinned only).

## Self-verify

Invariant test green on the full matrix (Prove-It: revert BR-2 → the 0-capacity write-gate cell goes red) · existing capacity suites (cam-344/351/355) green or re-pinned with justification · lint/typecheck · localhost AC.
