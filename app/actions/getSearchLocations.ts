"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildCampSiteWhere } from "@/lib/campsite-filters";
import { CATALOG_TAG } from "@/lib/catalog-cache";

/**
 * CAM-531 — real province source for the SearchModal `จังหวัด` dropdown.
 *
 * Replaces the hardcoded 7-key `PROVINCES` object literal with the DISTINCT
 * `Location.province` values that actually have a
 * published, active, non-deleted camp — the SAME visibility predicate
 * `buildCampSiteWhere` applies everywhere else in the catalog (called here
 * with no filters, unmodified). A province can only ever be offered if
 * selecting it is guaranteed to return >=1 result; this never offers a
 * province that would return zero.
 *
 * Cached via `unstable_cache` (BR-3): the province-with-camps set only
 * changes when a camp is created/published/edited/deleted, and the existing
 * write paths (app/api/campsites/route.ts POST, [id]/route.ts PUT/DELETE)
 * already call `revalidateTag(CATALOG_TAG)` on every one of those — reusing
 * that tag here means this cache busts automatically with no new wiring.
 * `revalidate: 3600` is a belt-and-suspenders TTL (matches the "changes
 * rarely" nature of this data), mirroring the pattern in lib/catalog-cache.ts.
 *
 * Discriminated union return (per .claude/rules/api.md #11): the caller can
 * distinguish "loaded, zero provinces" ({status:'ok', provinces:[]}) from
 * "the fetch itself failed" ({status:'error'}) — the two are different UI
 * states (empty vs error) and must not collapse into the same value.
 */
export type SearchProvincesResult =
  | { status: "ok"; provinces: SearchProvinceOption[] }
  | { status: "error" };

/**
 * CAM-589 — the province dropdown listed every option in English regardless
 * of the active UI language (`camp.location.province` is raw free text,
 * always written in English per CAM-553's import — see story.md). This
 * option now carries the AdminArea node's bilingual names alongside the
 * legacy raw string, so the caller can render the right language WITHOUT
 * changing what gets submitted.
 *
 * BR-2 (story.md) — THE TRAP this whole arc has been about: `nameEn` stays
 * BYTE-IDENTICAL to the raw `Location.province` string this option was built
 * from. It is still the exact value the modal submits as `?province=`, and
 * `lib/campsite-filters.ts`'s province filter still matches it by EXACT
 * STRING EQUALITY. Swapping the submitted value to `nameTh` (or a
 * normalized `nameEn`) without also changing the matcher would silently
 * return zero results — no error, no log (the failure mode this story's
 * canary — Chiang Mai=18 — exists to catch). Decision: keep submitting the
 * canonical English string unchanged (the smaller, safer option over moving
 * the whole path to AdminArea ids) — see story.md's decision record.
 */
export interface SearchProvinceOption {
  /**
   * The matched AdminArea PROVINCE node's id. Informational only today (not
   * submitted anywhere) — carried so a future story can move the filter
   * itself onto ids without another round-trip through this action's shape.
   * Falls back to the raw `nameEn` string on the rare row with no AdminArea
   * match (defensive; every province offered in the dev DB matches today).
   */
  id: string;
  /** Thai display label (`AdminArea.nameTh`). Falls back to `nameEn` when no AdminArea PROVINCE node matches this raw string. */
  nameTh: string;
  /**
   * English display label AND the value the modal submits as the province
   * filter — BYTE-IDENTICAL to the raw `Location.province` string (see BR-2
   * above). Never re-derive or normalize this before using it as a
   * `SelectItem` value.
   */
  nameEn: string;
}

const loadProvincesWithCamps = unstable_cache(
  async (): Promise<SearchProvinceOption[]> => {
    const camps = await prisma.campSite.findMany({
      where: buildCampSiteWhere({}),
      select: { location: { select: { province: true } } },
    });

    const rawProvinces = new Set<string>();
    for (const camp of camps) {
      if (camp.location?.province) {
        rawProvinces.add(camp.location.province);
      }
    }
    if (rawProvinces.size === 0) return [];

    // CAM-589 — one batched lookup of every TH PROVINCE AdminArea node
    // (~77 rows total, per CAM-553's import) to resolve each raw English
    // province string to its Thai label. ONE query, never a per-row lookup
    // (no N+1 — .claude/rules/performance.md).
    const provinceAreas = await prisma.adminArea.findMany({
      where: { countryCode: "TH", level: "PROVINCE" },
      select: { id: true, nameTh: true, nameEn: true },
    });
    const byNameEn = new Map(provinceAreas.map((p) => [p.nameEn.toLowerCase(), p]));

    return Array.from(rawProvinces)
      .map((raw): SearchProvinceOption => {
        const match = byNameEn.get(raw.toLowerCase());
        return {
          id: match?.id ?? raw,
          nameTh: match?.nameTh ?? raw,
          nameEn: raw,
        };
      })
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  },
  ["search-provinces-with-camps"],
  { revalidate: 3600, tags: [CATALOG_TAG] }
);

export async function getSearchProvinces(): Promise<SearchProvincesResult> {
  try {
    const provinces = await loadProvincesWithCamps();
    return { status: "ok", provinces };
  } catch (error) {
    console.error("Failed to fetch search provinces:", error);
    return { status: "error" };
  }
}
