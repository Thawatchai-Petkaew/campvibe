/**
 * CAM-187 MEAS-1d — Idempotent 128-camp staging loader.
 *
 * Reads prisma/data/mock-staging-all.json and upserts:
 *   - 65 hosts (by email)
 *   - 128 campsites (by nameThSlug)
 *
 * SAFETY GUARANTEES:
 *   - NEVER calls deleteMany on any table (shared staging DB)
 *   - All writes are upsert or createMany with skipDuplicates:true
 *   - Idempotent: run multiple times = same result
 *
 * Usage (requires DATABASE_URL pointing at staging):
 *   node scripts/load-mock-staging.mjs
 *   npm run db:load:staging
 *
 * NEVER run against production DB.
 * Bcrypt 12 rounds for host passwords (matches existing seed pattern).
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─────────────────────────────────────────────────────────────
// Bcrypt — dynamic import to work in ESM without bundler
// ─────────────────────────────────────────────────────────────
const { default: bcrypt } = await import('bcryptjs').catch(() => import('bcrypt'));

// F-3: fixed dev password hashed at load time — never read from JSON.
// The JSON carries "__SET_AT_LOAD__" as a sentinel; this constant is the
// actual value used. bcrypt cost 12 per security standards.
const DEV_PASSWORD = 'CampVibe-dev-2025!';
const DEV_PASSWORD_HASH = await bcrypt.hash(DEV_PASSWORD, 12);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_PATH = join(__dirname, '../prisma/data/mock-staging-all.json');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Split a CSV option string into an array of non-empty codes. */
function splitCsv(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Build MasterData connect array from multiple CSV option fields. */
function buildOptionsConnect(camp) {
  const codes = [
    ...splitCsv(camp.accessTypes),
    ...splitCsv(camp.facilities),
    ...splitCsv(camp.externalFacilities),
    ...splitCsv(camp.equipment),
    ...splitCsv(camp.activities),
    ...splitCsv(camp.terrain),
  ];
  // Deduplicate
  return [...new Set(codes)].map((code) => ({ code }));
}

/**
 * Build Image createMany data from imageManifest.
 * Images table has (url, campSiteId) — skipDuplicates on createMany handles re-runs.
 */
function buildImageRows(campSiteId, imageManifest) {
  if (!Array.isArray(imageManifest) || imageManifest.length === 0) return [];
  return imageManifest.map((img, idx) => ({
    url: img.path,
    alt: img.alt ?? null,
    sortOrder: idx,
    campSiteId,
  }));
}

/** Extract logo path from imageManifest (first entry with role === 'logo'). */
function extractLogo(imageManifest) {
  if (!Array.isArray(imageManifest)) return undefined;
  return imageManifest.find((i) => i.role === 'logo')?.path ?? undefined;
}

/** Simple hash of email for deterministic but non-reversible key display in logs. */
function hashKey(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log('[load-mock-staging] Reading JSON...');
  const raw = readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw);

  const { meta, hosts } = data;
  console.log(`[load-mock-staging] ${meta.totalHosts} hosts / ${meta.totalCampsites} campsites — variant: ${meta.variant}`);

  let hostsUpserted = 0;
  let campsUpserted = 0;
  let imagesCreated = 0;
  let spotsCreated = 0;
  let skippedOptions = 0;

  for (const hostData of hosts) {
    // ── 1. Upsert host ──────────────────────────────────────
    // Use the pre-hashed constant — never read a password from the JSON (F-3).
    const passwordHash = DEV_PASSWORD_HASH;

    const host = await prisma.user.upsert({
      where: { email: hostData.email },
      update: {
        name: hostData.name,
        phone: hostData.phone,
        image: hostData.image,
        role: hostData.role,
        isHostRegistered: hostData.isHostRegistered ?? false,
        hostRegisteredAt: hostData.hostRegisteredAt
          ? new Date(hostData.hostRegisteredAt)
          : null,
        businessType: hostData.businessType ?? null,
        businessName: hostData.businessName ?? null,
        taxId: hostData.taxId ?? null,
        businessAddress: hostData.businessAddress ?? null,
      },
      create: {
        email: hostData.email,
        password: passwordHash,
        name: hostData.name,
        phone: hostData.phone,
        image: hostData.image,
        role: hostData.role,
        isHostRegistered: hostData.isHostRegistered ?? false,
        hostRegisteredAt: hostData.hostRegisteredAt
          ? new Date(hostData.hostRegisteredAt)
          : null,
        businessType: hostData.businessType ?? null,
        businessName: hostData.businessName ?? null,
        taxId: hostData.taxId ?? null,
        businessAddress: hostData.businessAddress ?? null,
      },
      select: { id: true, email: true },
    });
    hostsUpserted++;

    // ── 2. Upsert each campsite ──────────────────────────────
    for (const camp of hostData.campsites ?? []) {
      // Resolve MasterData options — look up existing codes, skip unknown
      const requestedCodes = buildOptionsConnect(camp);
      let resolvedOptions = [];
      if (requestedCodes.length > 0) {
        const foundCodes = await prisma.masterData.findMany({
          where: { code: { in: requestedCodes.map((c) => c.code) } },
          select: { code: true },
        });
        const foundSet = new Set(foundCodes.map((m) => m.code));
        const unknown = requestedCodes.filter((c) => !foundSet.has(c.code));
        if (unknown.length > 0) {
          skippedOptions += unknown.length;
          console.warn(
            `[load-mock-staging] ${camp.nameThSlug}: skipping unknown MasterData codes: ${unknown.map((c) => c.code).join(', ')}`
          );
        }
        resolvedOptions = foundCodes;
      }

      // Upsert campsite by nameThSlug (unique key)
      const campSite = await prisma.campSite.upsert({
        where: { nameThSlug: camp.nameThSlug },
        update: {
          nameTh: camp.nameTh,
          nameEn: camp.nameEn ?? null,
          nameEnSlug: camp.nameEnSlug ?? camp.nameThSlug,
          description: camp.description ?? '',
          campSiteType: camp.campSiteType ?? 'CAGD',
          accommodationTypes: camp.accommodationTypes ?? 'TENT',
          latitude: camp.latitude,
          longitude: camp.longitude,
          address: camp.address ?? null,
          directions: camp.directions ?? null,
          checkInTime: camp.checkInTime ?? '14:00',
          checkOutTime: camp.checkOutTime ?? '12:00',
          bookingMethod: camp.bookingMethod ?? 'ONLI',
          priceLow: camp.priceLow ?? null,
          priceHigh: camp.priceHigh ?? null,
          priceCurrency: camp.priceCurrency ?? 'THB',
          feeInfo: camp.feeInfo ?? null,
          toiletInfo: camp.toiletInfo ?? null,
          minimumAge: camp.minimumAge ?? 0,
          maxGuestsPerDay: camp.maxGuestsPerDay ?? null,
          maxTentsPerDay: camp.maxTentsPerDay ?? null,
          groundType: camp.groundType ?? null,
          phone: camp.phone ?? null,
          lineId: camp.lineId ?? null,
          facebookUrl: camp.facebookUrl ?? null,
          tiktokUrl: camp.tiktokUrl ?? null,
          tags: Array.isArray(camp.tags) ? camp.tags.join(',') : camp.tags ?? null,
          ownershipType: camp.ownershipType ?? 'PRIVATE',
          isFree: camp.isFree ?? false,
          petFriendly: camp.petFriendly ?? false,
          isActive: camp.isActive ?? true,
          isPublished: true,
          logo: extractLogo(camp.imageManifest),
          options: { set: resolvedOptions },
          operatorId: host.id,
        },
        create: {
          nameTh: camp.nameTh,
          nameEn: camp.nameEn ?? null,
          nameThSlug: camp.nameThSlug,
          nameEnSlug: camp.nameEnSlug ?? camp.nameThSlug,
          description: camp.description ?? '',
          campSiteType: camp.campSiteType ?? 'CAGD',
          accommodationTypes: camp.accommodationTypes ?? 'TENT',
          latitude: camp.latitude,
          longitude: camp.longitude,
          address: camp.address ?? null,
          directions: camp.directions ?? null,
          checkInTime: camp.checkInTime ?? '14:00',
          checkOutTime: camp.checkOutTime ?? '12:00',
          bookingMethod: camp.bookingMethod ?? 'ONLI',
          priceLow: camp.priceLow ?? null,
          priceHigh: camp.priceHigh ?? null,
          priceCurrency: camp.priceCurrency ?? 'THB',
          feeInfo: camp.feeInfo ?? null,
          toiletInfo: camp.toiletInfo ?? null,
          minimumAge: camp.minimumAge ?? 0,
          maxGuestsPerDay: camp.maxGuestsPerDay ?? null,
          maxTentsPerDay: camp.maxTentsPerDay ?? null,
          groundType: camp.groundType ?? null,
          phone: camp.phone ?? null,
          lineId: camp.lineId ?? null,
          facebookUrl: camp.facebookUrl ?? null,
          tiktokUrl: camp.tiktokUrl ?? null,
          tags: Array.isArray(camp.tags) ? camp.tags.join(',') : camp.tags ?? null,
          ownershipType: camp.ownershipType ?? 'PRIVATE',
          isFree: camp.isFree ?? false,
          petFriendly: camp.petFriendly ?? false,
          isActive: camp.isActive ?? true,
          isPublished: true,
          logo: extractLogo(camp.imageManifest),
          options: { connect: resolvedOptions },
          operatorId: host.id,
          // Location — create inline on first upsert
          location: {
            create: {
              country: 'Thailand',
              province: camp.province ?? null,
              lat: camp.latitude,
              lon: camp.longitude,
            },
          },
        },
        select: { id: true, nameThSlug: true },
      });
      campsUpserted++;

      // ── 3. Images (createMany + skipDuplicates) ────────────
      const imageRows = buildImageRows(campSite.id, camp.imageManifest);
      if (imageRows.length > 0) {
        const result = await prisma.image.createMany({
          data: imageRows,
          skipDuplicates: true,
        });
        imagesCreated += result.count;
      }

      // ── 4. Spots (createMany + skipDuplicates) ─────────────
      // Image model has no composite unique on (name + campSiteId) in schema
      // so we use a findFirst guard before creating to keep it idempotent.
      for (const spot of camp.spots ?? []) {
        const existing = await prisma.spot.findFirst({
          where: { name: spot.name, campSiteId: campSite.id },
          select: { id: true },
        });
        if (!existing) {
          await prisma.spot.create({
            data: {
              zone: spot.zone ?? null,
              name: spot.name,
              viewType: spot.viewType ?? null,
              maxCampers: spot.maxCampers ?? null,
              maxTents: spot.maxTents ?? null,
              environment: spot.environment ?? null,
              pricePerNight: spot.pricePerNight ?? 0,
              priceCurrency: spot.priceCurrency ?? 'THB',
              nearFacilities: spot.nearFacilities ?? null,
              campSiteId: campSite.id,
            },
          });
          spotsCreated++;
        }
      }
    }
  }

  await prisma.$disconnect();

  console.log('[load-mock-staging] Done.');
  console.log(`  Hosts upserted:    ${hostsUpserted}`);
  console.log(`  Camps upserted:    ${campsUpserted}`);
  console.log(`  Images created:    ${imagesCreated} (skipDuplicates)`);
  console.log(`  Spots created:     ${spotsCreated} (skip-if-exists)`);
  if (skippedOptions > 0) {
    console.log(`  Options skipped:   ${skippedOptions} (unknown MasterData codes)`);
  }
}

main().catch((err) => {
  console.error('[load-mock-staging] Fatal error:', err.message ?? err);
  process.exit(1);
});
