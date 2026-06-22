/**
 * CAM-77 — guest-capacity filter (DEFECT-01 fix)
 *
 * Tests the `buildCampSiteWhere` function's capacity-filter branch using
 * CampSite.maxGuestsPerDay. No DB connection needed — we only assert the
 * Prisma where-input shape that is produced.
 *
 * Correct shape when guests is a positive integer:
 *   where.AND contains { OR: [ { maxGuestsPerDay: { gte: N } }, { maxGuestsPerDay: null } ] }
 *
 * This maps to SQL: WHERE (maxGuestsPerDay >= N OR maxGuestsPerDay IS NULL)
 * ensuring camps with no declared capacity (null) stay visible for all guest counts.
 */

import { describe, it, expect } from "vitest";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import type { Prisma } from "@prisma/client";

// Helper — extract the capacity OR clause pushed into where.AND
function findCapacityOrClause(
  where: Prisma.CampSiteWhereInput
): Prisma.CampSiteWhereInput | undefined {
  const andArray = Array.isArray(where.AND)
    ? where.AND
    : where.AND
      ? [where.AND]
      : [];
  return andArray.find(
    (clause) =>
      typeof clause === "object" &&
      clause !== null &&
      "OR" in clause &&
      Array.isArray((clause as Prisma.CampSiteWhereInput).OR)
  ) as Prisma.CampSiteWhereInput | undefined;
}

describe("buildCampSiteWhere — guest capacity filter (CAM-77 DEFECT-01)", () => {
  // Base always-present conditions the real function adds
  const BASE = { isActive: true, isPublished: true, deletedAt: null };

  // ---------------------------------------------------------------------------
  // NULL-capacity arm (DEFECT-01) — the key fix
  // ---------------------------------------------------------------------------
  describe("null-capacity arm (DEFECT-01 — camps with maxGuestsPerDay IS NULL must be included)", () => {
    it("adds an AND clause containing OR with both gte and null arms when guests is positive", () => {
      const where = buildCampSiteWhere({ guests: "20" });

      // The top-level where.AND must exist and contain the capacity clause
      expect(Array.isArray(where.AND)).toBe(true);

      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();

      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      // Must have exactly the two arms: gte AND null
      expect(orArms).toHaveLength(2);
      expect(orArms).toContainEqual({ maxGuestsPerDay: { gte: 20 } });
      expect(orArms).toContainEqual({ maxGuestsPerDay: null });
    });

    it("includes the null arm so null-capacity camps are never hidden (guests=10)", () => {
      const where = buildCampSiteWhere({ guests: "10" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      expect(orArms).toContainEqual({ maxGuestsPerDay: null });
    });

    it("does NOT set a bare top-level maxGuestsPerDay (the old broken shape)", () => {
      const where = buildCampSiteWhere({ guests: "5" });
      // Under the old bug, maxGuestsPerDay was set at the top level which would
      // evaluate to NULL (not TRUE) for null rows and silently excluded them.
      expect(where.maxGuestsPerDay).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // gte arm — camps with declared capacity are still filtered correctly
  // ---------------------------------------------------------------------------
  describe("gte arm — camps with insufficient declared capacity are still excluded", () => {
    it("includes the gte arm so declared-capacity camps are filtered (guests=20)", () => {
      const where = buildCampSiteWhere({ guests: "20" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      expect(orArms).toContainEqual({ maxGuestsPerDay: { gte: 20 } });
    });

    it("boundary: a camp with capacity exactly equal to guests satisfies gte (inclusive boundary)", () => {
      // guests=4, camp has maxGuestsPerDay=4 → 4 >= 4 → true
      const where = buildCampSiteWhere({ guests: "4" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      const gteArm = orArms.find(
        (arm) => typeof arm.maxGuestsPerDay === "object" && arm.maxGuestsPerDay !== null
      ) as { maxGuestsPerDay: { gte: number } };
      expect(gteArm.maxGuestsPerDay.gte).toBe(4);
      // semantic: 4 >= 4 is true (camp included)
      expect(4 >= gteArm.maxGuestsPerDay.gte).toBe(true);
    });

    it("semantic: a camp with declared capacity below guests does NOT satisfy gte (excluded)", () => {
      const where = buildCampSiteWhere({ guests: "20" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      const gteArm = orArms.find(
        (arm) => typeof arm.maxGuestsPerDay === "object" && arm.maxGuestsPerDay !== null
      ) as { maxGuestsPerDay: { gte: number } };
      // 4-capacity camp vs 20-guest request
      expect(4 >= gteArm.maxGuestsPerDay.gte).toBe(false);
    });

    it("semantic: a camp with declared capacity above guests satisfies gte (included)", () => {
      const where = buildCampSiteWhere({ guests: "2" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      const gteArm = orArms.find(
        (arm) => typeof arm.maxGuestsPerDay === "object" && arm.maxGuestsPerDay !== null
      ) as { maxGuestsPerDay: { gte: number } };
      // 20-capacity camp vs 2-guest request
      expect(20 >= gteArm.maxGuestsPerDay.gte).toBe(true);
    });

    it("parses the guest string to an integer correctly (no rounding issues)", () => {
      const where = buildCampSiteWhere({ guests: "10" });
      const capacityClause = findCapacityOrClause(where);
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      const gteArm = orArms.find(
        (arm) => typeof arm.maxGuestsPerDay === "object" && arm.maxGuestsPerDay !== null
      ) as { maxGuestsPerDay: { gte: number } };
      expect(gteArm.maxGuestsPerDay.gte).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // Keyword composition — capacity AND-arm must NOT clobber where.OR
  // ---------------------------------------------------------------------------
  describe("capacity + keyword composition (where.OR must not be overwritten)", () => {
    it("capacity AND clause coexists with keyword where.OR without clobbering it", () => {
      const where = buildCampSiteWhere({ guests: "10", keyword: "เชียงใหม่" });

      // where.OR is the keyword search — must be preserved at the top level
      expect(Array.isArray(where.OR)).toBe(true);
      const orArray = where.OR as Prisma.CampSiteWhereInput[];
      expect(orArray.some((arm) => "nameTh" in arm)).toBe(true);

      // Capacity goes into where.AND — a separate clause, not overwriting OR
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
      const capacityOr = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      expect(capacityOr).toContainEqual({ maxGuestsPerDay: { gte: 10 } });
      expect(capacityOr).toContainEqual({ maxGuestsPerDay: null });
    });

    it("keyword-only (no guests) preserves where.OR and adds no AND capacity clause", () => {
      const where = buildCampSiteWhere({ keyword: "หนองคาย" });
      expect(Array.isArray(where.OR)).toBe(true);
      // No capacity clause in AND
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeUndefined();
    });

    it("capacity + taxonomy option filter: both AND entries coexist", () => {
      // addOptionFilter also uses where.AND — they must not clobber each other
      const where = buildCampSiteWhere({ guests: "5", access: "ROAD_PAVED" });
      const andArray = (where.AND as Prisma.CampSiteWhereInput[]) ?? [];
      // taxonomy clause
      expect(andArray.some((c) => "options" in c)).toBe(true);
      // capacity clause
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Guard — no capacity filter applied when guests is absent / zero / non-numeric
  // ---------------------------------------------------------------------------
  describe("guard — no capacity AND clause when guests is absent, zero, or non-numeric", () => {
    it("does NOT add an AND capacity clause when guests is undefined", () => {
      const where = buildCampSiteWhere({});
      expect(findCapacityOrClause(where)).toBeUndefined();
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add an AND capacity clause when guests is missing from params", () => {
      const where = buildCampSiteWhere({ type: "ALL", keyword: "หนองคาย" });
      expect(findCapacityOrClause(where)).toBeUndefined();
    });

    it("does NOT add an AND capacity clause when guests is '0' (non-positive)", () => {
      const where = buildCampSiteWhere({ guests: "0" });
      expect(findCapacityOrClause(where)).toBeUndefined();
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add an AND capacity clause when guests is a negative number string", () => {
      const where = buildCampSiteWhere({ guests: "-5" });
      expect(findCapacityOrClause(where)).toBeUndefined();
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add an AND capacity clause when guests is NaN (e.g. 'abc')", () => {
      const where = buildCampSiteWhere({ guests: "abc" });
      expect(findCapacityOrClause(where)).toBeUndefined();
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add an AND capacity clause when guests is an empty string", () => {
      // parseInt("", 10) → NaN → guard fires
      const where = buildCampSiteWhere({ guests: "" });
      expect(findCapacityOrClause(where)).toBeUndefined();
      expect(where.maxGuestsPerDay).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // parseInt leading-int behavior — documented and intentional
  // ---------------------------------------------------------------------------
  describe("parseInt leading-integer behavior (documented as intentional)", () => {
    it("'4abc' parses to 4 (leading-int accepted by parseInt) — capacity filter IS applied", () => {
      // parseInt("4abc", 10) → 4 (JS spec: stops at first non-digit after digits).
      // This is the current intentional behavior: a leading integer triggers the filter
      // rather than silently applying no filter. Clients should send pure integer strings.
      const where = buildCampSiteWhere({ guests: "4abc" });
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      expect(orArms).toContainEqual({ maxGuestsPerDay: { gte: 4 } });
    });

    it("'4.5' parses to 4 (parseInt stops at decimal point) — capacity filter IS applied", () => {
      // parseInt("4.5", 10) → 4 (decimal part is dropped, not rounded).
      // Same rationale: a leading integer triggers the filter. Document clearly.
      const where = buildCampSiteWhere({ guests: "4.5" });
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
      const orArms = (capacityClause as Prisma.CampSiteWhereInput).OR as Prisma.CampSiteWhereInput[];
      expect(orArms).toContainEqual({ maxGuestsPerDay: { gte: 4 } });
    });

    it("pure non-numeric string 'abc' still produces NaN — no capacity filter applied", () => {
      // parseInt("abc", 10) → NaN (no leading digit) → guard fires correctly.
      const where = buildCampSiteWhere({ guests: "abc" });
      expect(findCapacityOrClause(where)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Other filter composition (province, price) — no interference
  // ---------------------------------------------------------------------------
  describe("combined with other filters (no interference)", () => {
    it("capacity filter combines with province location filter", () => {
      const where = buildCampSiteWhere({ guests: "5", province: "เชียงใหม่" });
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
      expect(where.location).toMatchObject({ province: "เชียงใหม่" });
    });

    it("capacity filter combines with price range filter", () => {
      const where = buildCampSiteWhere({ guests: "8", min: "500", max: "2000" });
      const capacityClause = findCapacityOrClause(where);
      expect(capacityClause).toBeDefined();
      expect(where.priceLow).toMatchObject({ gte: 500, lte: 2000 });
    });

    it("always preserves the base isActive/isPublished/deletedAt conditions", () => {
      const where = buildCampSiteWhere({ guests: "15" });
      expect(where).toMatchObject(BASE);
    });
  });
});
