import { z } from 'zod';

/**
 * CAM-362 — Zone write-boundary validation (create, `## Data` / tech.md §3.2).
 *
 * Model ground truth: prisma/schema.prisma `Zone` (this story). Validates the
 * CREATE (POST) boundary for app/api/campsites/[id]/zones/route.ts.
 *
 * Rules (tech.md §3.2, §0.3-C/D):
 *  - name: trimmed + internal-whitespace-collapsed, then bounded 1..50 chars.
 *    Whitespace-only input collapses to '' and fails the min(1) bound (BR:
 *    empty/whitespace-only -> 400 `กรุณากรอกชื่อโซน`).
 *  - > 50 chars (after normalization) -> 400 `ชื่อโซนต้องไม่เกิน 50 ตัวอักษร`.
 *  - Duplicate detection (case-insensitive, live-rows-only) happens in the
 *    route handler inside a $transaction (tech.md §3.2) — NOT in this schema,
 *    which only validates shape/bounds.
 *  - `sortOrder` is NOT client-accepted in round 1 — the server assigns it
 *    (count of live zones for the camp) so new zones append.
 */

export const ZONE_NAME_REQUIRED_MESSAGE = 'กรุณากรอกชื่อโซน';
export const ZONE_NAME_TOO_LONG_MESSAGE = 'ชื่อโซนต้องไม่เกิน 50 ตัวอักษร';
export const ZONE_DUPLICATE_MESSAGE = 'มีโซนชื่อนี้อยู่แล้ว';

export const zoneCreateSchema = z.object({
  name: z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim()) // collapse internal whitespace + trim
    .pipe(
      z
        .string()
        .min(1, ZONE_NAME_REQUIRED_MESSAGE)
        .max(50, ZONE_NAME_TOO_LONG_MESSAGE)
    ),
});

export type ZoneCreateInput = z.infer<typeof zoneCreateSchema>;
