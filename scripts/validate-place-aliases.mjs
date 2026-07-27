/**
 * scripts/validate-place-aliases.mjs — validates prisma/data/place-aliases.json.
 *
 * A pure, zero-DB validation pass over the hand-authored Thai place-alias
 * dataset (colloquial / abbreviation / dialect / historical names →
 * official province / region / zone). Sibling of
 * validate-landmark-gazetteer.mjs.
 *
 * This validator IS the contract that lets a follow-up AI/build step fill or
 * extend the file safely: it cross-checks every provinceAliases
 * canonicalCode/canonicalTh/canonicalEn against prisma/data/thailand-locations.json
 * (the AdminArea seed source of truth) so an alias can never point at a
 * province string the resolver won't actually match.
 *
 * Checks:
 *   provinceAliases[]:
 *     - canonicalCode exists as a PROVINCE in thailand-locations.json
 *     - canonicalTh / canonicalEn match that province's seeded nameTh / nameEn exactly
 *     - aliases is a non-empty array of { text, matchMode, kind, contextGuard? }
 *     - matchMode ∈ {exact, substring}; kind ∈ {colloquial, abbreviation, dialect, historical}
 *     - contextGuard, if present, is a boolean
 *     - no alias text is blank / duplicated across the whole dataset
 *     - no alias text equals any province's official nameTh (would shadow a real match)
 *   regionAliases[]:
 *     - canonicalRegion ∈ the 6 ThaiRegion values
 *     - aliases valid (same alias shape); alias text not already a key in
 *       lib/thai-regions.ts REGION_ALIASES (additive only) and not duplicated
 *   zoneAliases[]:
 *     - id present, non-empty, unique
 *     - nameTh present, non-empty; aliases is an array
 *     - provinceCode exists as a PROVINCE; provinceTh matches its seeded nameTh
 *     - kind ∈ {park, mountain, town, area}
 *     - lat/lng are either null (to be filled) or inside Thailand's bbox
 *     - radiusKm is either null or a finite number > 0
 *
 * Usage: node scripts/validate-place-aliases.mjs
 * Exits 0 clean, 1 with every violation printed otherwise.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALIASES_PATH = path.join(__dirname, '..', 'prisma', 'data', 'place-aliases.json');
const LOCATIONS_PATH = path.join(__dirname, '..', 'prisma', 'data', 'thailand-locations.json');

/** Thailand's real bounding box — same generous box as the landmark validator. */
export const THAILAND_BBOX = { latMin: 5.6, latMax: 20.5, lngMin: 97.3, lngMax: 105.7 };

/** The 6 ThaiRegion values (mirrors lib/thai-regions.ts). */
export const THAI_REGIONS = new Set(['NORTH', 'NORTHEAST', 'CENTRAL', 'EAST', 'WEST', 'SOUTH']);

/**
 * Existing REGION_ALIASES keys in lib/thai-regions.ts. New regionAliases must
 * be ADDITIVE (introduce a new colloquial word), never restate one of these.
 */
export const EXISTING_REGION_ALIAS_KEYS = new Set([
  'ภาคเหนือ', 'เหนือ', 'ทางเหนือ',
  'ภาคตะวันออกเฉียงเหนือ', 'ภาคอีสาน', 'อีสาน',
  'ภาคกลาง', 'กลาง',
  'ภาคตะวันออก', 'ตะวันออก',
  'ภาคตะวันตก', 'ตะวันตก',
  'ภาคใต้', 'ใต้', 'ปักษ์ใต้',
]);

const VALID_MATCH_MODES = new Set(['exact', 'substring']);
const VALID_KINDS = new Set(['colloquial', 'abbreviation', 'dialect', 'historical']);
const VALID_ZONE_KINDS = new Set(['park', 'mountain', 'town', 'area']);

/**
 * Build the province lookup from thailand-locations.json: code → { nameTh, nameEn }.
 * Only the top-level (province) nodes; districts/subDistricts are ignored.
 */
export function buildProvinceIndex(locations) {
  const byCode = new Map();
  const officialNameThSet = new Set();
  if (!Array.isArray(locations)) return { byCode, officialNameThSet };
  for (const p of locations) {
    if (p && typeof p.code === 'string') {
      byCode.set(p.code, { nameTh: p.nameTh, nameEn: p.nameEn });
      if (typeof p.nameTh === 'string') officialNameThSet.add(p.nameTh);
    }
  }
  return { byCode, officialNameThSet };
}

/** Validate one alias object; push errors under the given label. */
function validateAliasObject(alias, label, errors) {
  if (!alias || typeof alias !== 'object') {
    errors.push(`${label}: alias is not an object`);
    return;
  }
  if (typeof alias.text !== 'string' || alias.text.trim().length === 0) {
    errors.push(`${label}: missing/empty alias text`);
  }
  if (!VALID_MATCH_MODES.has(alias.matchMode)) {
    errors.push(`${label} (${alias.text}): matchMode must be exact|substring (got ${alias.matchMode})`);
  }
  if (!VALID_KINDS.has(alias.kind)) {
    errors.push(`${label} (${alias.text}): kind must be colloquial|abbreviation|dialect|historical (got ${alias.kind})`);
  }
  if (alias.contextGuard !== undefined && typeof alias.contextGuard !== 'boolean') {
    errors.push(`${label} (${alias.text}): contextGuard must be a boolean when present`);
  }
}

/**
 * Pure validator — takes the parsed alias dataset + parsed thailand-locations,
 * returns every violation (empty array = clean).
 *
 * @param {unknown} data      parsed place-aliases.json
 * @param {unknown} locations parsed thailand-locations.json
 * @returns {string[]}
 */
export function validatePlaceAliases(data, locations) {
  const errors = [];
  const { byCode, officialNameThSet } = buildProvinceIndex(locations);

  if (byCode.size === 0) {
    errors.push('thailand-locations.json produced 0 provinces — cannot validate canonical references');
  }

  if (!data || typeof data !== 'object') {
    return ['place-aliases.json must be a JSON object'];
  }

  const { provinceAliases, regionAliases, zoneAliases } = data;
  const seenAliasText = new Map(); // alias text → owning label (dataset-wide province uniqueness)

  // ---- provinceAliases ----
  if (!Array.isArray(provinceAliases)) {
    errors.push('provinceAliases must be an array');
  } else {
    provinceAliases.forEach((entry, i) => {
      const label = `provinceAliases[${i}]${entry && entry.canonicalCode ? ` (${entry.canonicalCode})` : ''}`;
      if (!entry || typeof entry !== 'object') {
        errors.push(`${label}: not an object`);
        return;
      }
      const prov = byCode.get(entry.canonicalCode);
      if (!prov) {
        errors.push(`${label}: canonicalCode "${entry.canonicalCode}" is not a province in thailand-locations.json`);
      } else {
        if (entry.canonicalTh !== prov.nameTh) {
          errors.push(`${label}: canonicalTh "${entry.canonicalTh}" != seeded nameTh "${prov.nameTh}"`);
        }
        if (entry.canonicalEn !== prov.nameEn) {
          errors.push(`${label}: canonicalEn "${entry.canonicalEn}" != seeded nameEn "${prov.nameEn}"`);
        }
      }
      if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
        errors.push(`${label}: aliases must be a non-empty array`);
        return;
      }
      entry.aliases.forEach((alias, j) => {
        const aLabel = `${label}.aliases[${j}]`;
        validateAliasObject(alias, aLabel, errors);
        if (alias && typeof alias.text === 'string' && alias.text.trim().length > 0) {
          const text = alias.text.trim();
          if (seenAliasText.has(text)) {
            errors.push(`${aLabel}: alias "${text}" already used by ${seenAliasText.get(text)} (an alias may map to only one province)`);
          } else {
            seenAliasText.set(text, label);
          }
          if (officialNameThSet.has(text)) {
            errors.push(`${aLabel}: alias "${text}" equals an official province nameTh — would shadow the real province match`);
          }
        }
      });
    });
  }

  // ---- regionAliases ----
  const seenRegionAlias = new Map();
  if (regionAliases !== undefined) {
    if (!Array.isArray(regionAliases)) {
      errors.push('regionAliases must be an array when present');
    } else {
      regionAliases.forEach((entry, i) => {
        const label = `regionAliases[${i}]${entry && entry.canonicalRegion ? ` (${entry.canonicalRegion})` : ''}`;
        if (!entry || typeof entry !== 'object') {
          errors.push(`${label}: not an object`);
          return;
        }
        if (!THAI_REGIONS.has(entry.canonicalRegion)) {
          errors.push(`${label}: canonicalRegion must be one of ${[...THAI_REGIONS].join('|')} (got ${entry.canonicalRegion})`);
        }
        if (!Array.isArray(entry.aliases) || entry.aliases.length === 0) {
          errors.push(`${label}: aliases must be a non-empty array`);
          return;
        }
        entry.aliases.forEach((alias, j) => {
          const aLabel = `${label}.aliases[${j}]`;
          validateAliasObject(alias, aLabel, errors);
          if (alias && typeof alias.text === 'string' && alias.text.trim().length > 0) {
            const text = alias.text.trim();
            if (EXISTING_REGION_ALIAS_KEYS.has(text)) {
              errors.push(`${aLabel}: region alias "${text}" already exists in lib/thai-regions.ts REGION_ALIASES — new entries must be additive`);
            }
            if (seenRegionAlias.has(text)) {
              errors.push(`${aLabel}: region alias "${text}" duplicated (already on ${seenRegionAlias.get(text)})`);
            } else {
              seenRegionAlias.set(text, label);
            }
          }
        });
      });
    }
  }

  // ---- zoneAliases ----
  const seenZoneIds = new Set();
  if (zoneAliases !== undefined) {
    if (!Array.isArray(zoneAliases)) {
      errors.push('zoneAliases must be an array when present');
    } else {
      zoneAliases.forEach((entry, i) => {
        const label = `zoneAliases[${i}]${entry && entry.id ? ` (${entry.id})` : ''}`;
        if (!entry || typeof entry !== 'object') {
          errors.push(`${label}: not an object`);
          return;
        }
        if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
          errors.push(`${label}: missing/empty id`);
        } else if (seenZoneIds.has(entry.id)) {
          errors.push(`${label}: duplicate id "${entry.id}"`);
        } else {
          seenZoneIds.add(entry.id);
        }
        if (typeof entry.nameTh !== 'string' || entry.nameTh.trim().length === 0) {
          errors.push(`${label}: missing/empty nameTh`);
        }
        if (!Array.isArray(entry.aliases)) {
          errors.push(`${label}: aliases must be an array (may be empty)`);
        }
        const prov = byCode.get(entry.provinceCode);
        if (!prov) {
          errors.push(`${label}: provinceCode "${entry.provinceCode}" is not a province in thailand-locations.json`);
        } else if (entry.provinceTh !== prov.nameTh) {
          errors.push(`${label}: provinceTh "${entry.provinceTh}" != seeded nameTh "${prov.nameTh}"`);
        }
        if (!VALID_ZONE_KINDS.has(entry.kind)) {
          errors.push(`${label}: kind must be park|mountain|town|area (got ${entry.kind})`);
        }
        // lat/lng: null (to-be-filled) OR inside the bbox
        if (entry.lat !== null && (typeof entry.lat !== 'number' || !Number.isFinite(entry.lat) || entry.lat < THAILAND_BBOX.latMin || entry.lat > THAILAND_BBOX.latMax)) {
          errors.push(`${label}: lat must be null or inside Thailand bbox [${THAILAND_BBOX.latMin}, ${THAILAND_BBOX.latMax}] (got ${entry.lat})`);
        }
        if (entry.lng !== null && (typeof entry.lng !== 'number' || !Number.isFinite(entry.lng) || entry.lng < THAILAND_BBOX.lngMin || entry.lng > THAILAND_BBOX.lngMax)) {
          errors.push(`${label}: lng must be null or inside Thailand bbox [${THAILAND_BBOX.lngMin}, ${THAILAND_BBOX.lngMax}] (got ${entry.lng})`);
        }
        if (entry.radiusKm !== null && (typeof entry.radiusKm !== 'number' || !Number.isFinite(entry.radiusKm) || entry.radiusKm <= 0)) {
          errors.push(`${label}: radiusKm must be null or a finite number > 0 (got ${entry.radiusKm})`);
        }
      });
    }
  }

  return errors;
}

function main() {
  const data = JSON.parse(readFileSync(ALIASES_PATH, 'utf-8'));
  const locations = JSON.parse(readFileSync(LOCATIONS_PATH, 'utf-8'));
  const errors = validatePlaceAliases(data, locations);

  if (errors.length > 0) {
    console.error(`place-aliases.json — ${errors.length} violation(s):`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const provinceCount = Array.isArray(data.provinceAliases) ? data.provinceAliases.length : 0;
  const regionCount = Array.isArray(data.regionAliases) ? data.regionAliases.length : 0;
  const zoneCount = Array.isArray(data.zoneAliases) ? data.zoneAliases.length : 0;
  const aliasCount = (data.provinceAliases ?? []).reduce((n, e) => n + (e.aliases?.length ?? 0), 0);
  console.log(
    `place-aliases.json OK — ${provinceCount} provinces (${aliasCount} province aliases), ` +
    `${regionCount} region groups, ${zoneCount} zones, 0 violations.`,
  );
}

// Only run as a CLI script, never on import (so a test file can import
// validatePlaceAliases without the side effect of exiting the process).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
