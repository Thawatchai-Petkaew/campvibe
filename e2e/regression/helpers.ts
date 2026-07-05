/**
 * CAM-359 — shared helpers for the 6 regression specs.
 */
import type { APIRequestContext } from "@playwright/test";

export interface SeededCampSite {
  id: string;
  nameTh: string;
  nameEn: string;
  nameThSlug: string;
  priceLow: string | number;
  maxGuestsPerDay: number | null;
}

/**
 * Looks up a seeded camp by its stable `nameThSlug` (prisma/seed.ts) via the
 * real operator-dashboard API — deterministic regardless of list sort order,
 * so each spec can target its OWN seeded camp (no cross-spec DB races).
 */
export async function findCampBySlug(
  request: APIRequestContext,
  nameThSlug: string
): Promise<SeededCampSite> {
  const res = await request.get("/api/operator/dashboard");
  if (!res.ok()) {
    throw new Error(`GET /api/operator/dashboard failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  const campSites: SeededCampSite[] = body.campSites ?? body.data?.campSites ?? [];
  const camp = campSites.find((c) => c.nameThSlug === nameThSlug);
  if (!camp) {
    throw new Error(
      `Seeded camp with nameThSlug="${nameThSlug}" not found under the signed-in host's ` +
        `camps — run "DATABASE_URL=... npx prisma migrate reset --force" against the local ` +
        `DB first (prisma/seed.ts).`
    );
  }
  return camp;
}

/** The subset of GET /api/campsites/[id]'s DTO the specs assert against. */
export interface CampSiteDTO {
  id: string;
  nameTh: string;
  priceLow: string | number | null;
  logo: string | null;
  images: Array<{ url: string }>;
}

/** Fetches the full camp-site DTO (the same shape GET /api/campsites/[id] returns to the edit form). */
export async function getCampSite(request: APIRequestContext, id: string): Promise<CampSiteDTO> {
  const res = await request.get(`/api/campsites/${id}`);
  if (!res.ok()) {
    throw new Error(`GET /api/campsites/${id} failed: ${res.status()} ${await res.text()}`);
  }
  return res.json();
}
