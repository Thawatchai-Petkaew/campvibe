/**
 * CAM-77 — guest-capacity filter
 *
 * Tests the `buildCampSiteWhere` function's capacity-filter branch using
 * CampSite.maxGuestsPerDay. No DB connection needed — we only assert the
 * Prisma where-input shape that is produced.
 */

import { describe, it, expect } from "vitest";
import { buildCampSiteWhere } from "@/lib/campsite-filters";

describe("buildCampSiteWhere — guest capacity filter (CAM-77)", () => {
  // Base always-present conditions the real function adds
  const BASE = { isActive: true, isPublished: true, deletedAt: null };

  describe("when guests is a positive integer", () => {
    it("adds maxGuestsPerDay gte filter so camps with insufficient capacity are excluded", () => {
      const where = buildCampSiteWhere({ guests: "20" });
      expect(where).toMatchObject({
        ...BASE,
        maxGuestsPerDay: { gte: 20 },
      });
    });

    it("includes a camp whose capacity exactly equals the requested guest count (boundary = inclusive)", () => {
      // e.g. 4-capacity camp is included when guests === 4
      const where = buildCampSiteWhere({ guests: "4" });
      expect(where.maxGuestsPerDay).toEqual({ gte: 4 });
    });

    it("excludes a camp whose capacity is below the requested guests (semantic check)", () => {
      // A 4-capacity camp (maxGuestsPerDay=4) must NOT satisfy gte:20
      const where = buildCampSiteWhere({ guests: "20" });
      const campCapacity = 4;
      const filter = where.maxGuestsPerDay as { gte: number };
      expect(campCapacity >= filter.gte).toBe(false);
    });

    it("includes a camp whose capacity exceeds the requested guests", () => {
      const where = buildCampSiteWhere({ guests: "2" });
      const campCapacity = 20;
      const filter = where.maxGuestsPerDay as { gte: number };
      expect(campCapacity >= filter.gte).toBe(true);
    });

    it("parses the string to an integer correctly (no decimals/rounding issues)", () => {
      const where = buildCampSiteWhere({ guests: "10" });
      expect((where.maxGuestsPerDay as { gte: number }).gte).toBe(10);
    });
  });

  describe("guard — no capacity filter when guests is absent, zero, or non-numeric", () => {
    it("does NOT add maxGuestsPerDay when guests is undefined (no filter)", () => {
      const where = buildCampSiteWhere({});
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add maxGuestsPerDay when guests is missing from params", () => {
      const where = buildCampSiteWhere({ type: "ALL", keyword: "หนองคาย" });
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add maxGuestsPerDay when guests is '0' (non-positive)", () => {
      const where = buildCampSiteWhere({ guests: "0" });
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add maxGuestsPerDay when guests is a negative number string", () => {
      const where = buildCampSiteWhere({ guests: "-5" });
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add maxGuestsPerDay when guests is NaN (e.g. 'abc')", () => {
      const where = buildCampSiteWhere({ guests: "abc" });
      expect(where.maxGuestsPerDay).toBeUndefined();
    });

    it("does NOT add maxGuestsPerDay when guests is an empty string", () => {
      const where = buildCampSiteWhere({ guests: "" });
      // parseInt("", 10) → NaN → guard fires
      expect(where.maxGuestsPerDay).toBeUndefined();
    });
  });

  describe("combined with other filters (no interference)", () => {
    it("capacity filter combines with keyword without breaking either", () => {
      const where = buildCampSiteWhere({ guests: "10", keyword: "เชียงใหม่" });
      expect(where.maxGuestsPerDay).toEqual({ gte: 10 });
      expect(where.OR).toBeDefined();
    });

    it("capacity filter combines with province location filter", () => {
      const where = buildCampSiteWhere({ guests: "5", province: "เชียงใหม่" });
      expect(where.maxGuestsPerDay).toEqual({ gte: 5 });
      expect(where.location).toMatchObject({ province: "เชียงใหม่" });
    });

    it("capacity filter combines with price range filter", () => {
      const where = buildCampSiteWhere({ guests: "8", min: "500", max: "2000" });
      expect(where.maxGuestsPerDay).toEqual({ gte: 8 });
      expect(where.priceLow).toMatchObject({ gte: 500, lte: 2000 });
    });

    it("always preserves the base isActive/isPublished/deletedAt conditions", () => {
      const where = buildCampSiteWhere({ guests: "15" });
      expect(where.isActive).toBe(true);
      expect(where.isPublished).toBe(true);
      expect(where.deletedAt).toBeNull();
    });
  });
});
