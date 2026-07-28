#!/usr/bin/env node
/**
 * scripts/generate-subdistrict-shortlist.mjs — CAM-600
 *
 * Regenerates `prisma/data/subdistrict-shortlist.json` — the ONLY input
 * `lib/ai/place-resolver.ts`'s new sub-district (ตำบล) free-text detector
 * reads. That detector must stay a PURE, synchronous, DB-free pre-pass (the
 * same load-bearing constraint CAM-596's tech.md documents for the district
 * detector: 3 production call sites `await` nothing, ~40 existing tests
 * assert a synchronous exact return) — so the "which sub-districts actually
 * hold a camp" fact, which DOES require a DB query, is computed HERE,
 * offline, and committed as a static JSON artifact `place-resolver.ts` loads
 * at module scope exactly like `thailand-locations.json`/
 * `landmark-gazetteer.json`/`place-aliases.json` already do.
 *
 * BUILD-TIME, not runtime (decided + justified in this story's own tech.md
 * "Build-time or runtime" section) — this script is the regeneration path.
 * It is a MANUAL/on-demand command today, not wired into CI/seed/deploy:
 *   node scripts/generate-subdistrict-shortlist.mjs
 * Re-run it (and commit the diff) whenever a meaningfully large batch of new
 * camps goes live in a previously camp-less sub-district — e.g. as part of a
 * host-onboarding batch or before a release train. A stale artifact only
 * ever causes a MISS (a real, camp-holding sub-district not yet detected),
 * never a wrong/guessed match — the guard logic in place-resolver.ts is
 * unaffected by staleness, it just has fewer/more candidates to scan.
 * Automating the regeneration cadence (e.g. a scheduled CI job that opens a
 * PR when the diff is non-empty) is an explicit follow-up, not this story.
 *
 * Output shape: `{ nameTh, districtNameTh, provinceNameTh }[]` — the RAW
 * "this sub-district currently holds >=1 published, non-deleted camp" fact
 * only. Every safety guard (length floor, ordinary-vocabulary skip-set,
 * substring-of-a-province exclusion, within-shortlist collision/scoping) is
 * applied in `place-resolver.ts` itself at candidate-build time, from this
 * raw data — mirroring how `buildAdminAreaCandidates` (CAM-596) derives its
 * own guarded candidate list from the raw `thailand-locations.json`, never
 * baking a guard into the generator. Sorted by province -> district -> name
 * so a re-run produces a small, readable git diff.
 *
 * Usage: node scripts/generate-subdistrict-shortlist.mjs
 * Requires DATABASE_URL in the environment (source the target env's `.env`
 * first) — reads the "camp count per sub-district" from whichever DB that
 * points at (dev DB today; re-run against staging/prod data before a
 * release for the most representative shortlist).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { describeUrlShape } from './db-reset.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'prisma', 'data', 'subdistrict-shortlist.json');

async function main() {
  const prisma = new PrismaClient();
  console.log(`[generate-subdistrict-shortlist] reading from ${describeUrlShape(process.env.DATABASE_URL || '')}`);

  // Every SUBDISTRICT-level AdminArea node with at least one published
  // (isActive, not soft-deleted) camp attached via Location.adminAreaId —
  // the exact same "holds a camp" definition `buildCampSiteWhere`
  // (lib/campsite-filters.ts) uses for a live search.
  const nodes = await prisma.adminArea.findMany({
    where: {
      countryCode: 'TH',
      level: 'SUBDISTRICT',
      locations: { some: { campSites: { some: { isActive: true, deletedAt: null } } } },
    },
    select: { nameTh: true, parentId: true },
  });

  const districtIds = [...new Set(nodes.map((n) => n.parentId).filter(Boolean))];
  const districts = await prisma.adminArea.findMany({
    where: { id: { in: districtIds } },
    select: { id: true, nameTh: true, parentId: true },
  });
  const districtById = new Map(districts.map((d) => [d.id, d]));

  const provinceIds = [...new Set(districts.map((d) => d.parentId).filter(Boolean))];
  const provinces = await prisma.adminArea.findMany({
    where: { id: { in: provinceIds } },
    select: { id: true, nameTh: true },
  });
  const provinceById = new Map(provinces.map((p) => [p.id, p]));

  const entries = [];
  const skipped = [];
  for (const node of nodes) {
    const district = node.parentId ? districtById.get(node.parentId) : undefined;
    const province = district?.parentId ? provinceById.get(district.parentId) : undefined;
    if (!district || !province) {
      // Never seen in the dev DB (every SUBDISTRICT row is seeded with a
      // full parent chain, CAM-553/562) — reported, never silently dropped.
      skipped.push(node.nameTh);
      continue;
    }
    entries.push({ nameTh: node.nameTh, districtNameTh: district.nameTh, provinceNameTh: province.nameTh });
  }

  entries.sort((a, b) =>
    a.provinceNameTh.localeCompare(b.provinceNameTh, 'th') ||
    a.districtNameTh.localeCompare(b.districtNameTh, 'th') ||
    a.nameTh.localeCompare(b.nameTh, 'th')
  );

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
  console.log(`[generate-subdistrict-shortlist] wrote ${entries.length} sub-districts -> ${OUTPUT_PATH}`);
  if (skipped.length > 0) {
    console.warn(`[generate-subdistrict-shortlist] skipped ${skipped.length} node(s) with an incomplete parent chain:`, skipped);
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('[generate-subdistrict-shortlist] failed:', error);
  process.exit(1);
});
