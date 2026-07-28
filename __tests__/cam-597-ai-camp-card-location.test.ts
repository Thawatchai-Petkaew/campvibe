/**
 * cam-597-ai-camp-card-location.test.ts — CAM-597
 *
 * "Assistant result cards show the province in English while the interface
 * is Thai" — closes CAM-545/CAM-573's exact defect on the one surface those
 * stories never migrated: the assistant's own card read-model
 * (lib/read-models/ai-camp-card.ts).
 *
 * Coverage matrix (qa.md §7):
 *   normal      — toAiCampCard attaches the SAME id-derived bilingual chain
 *                 CAM-573 built (resolveLocationDisplayNames), TH + EN,
 *                 proven through buildLocationText end-to-end (the real
 *                 pipeline — never a stub of the function under test)
 *   null/empty  — no adminArea at all still renders (province-only or '');
 *                 no Location row at all never throws, never drops the card
 *   boundary    — mid-session language switch: the SAME payload renders
 *                 correctly in both languages, no re-fetch (BR-3/EC-2);
 *                 a chain resolved to PROVINCE-only depth
 *   structural  — no Prisma `select` change was needed on any of the 4 AI
 *                 tool files (aiCampCardSelect already spreads
 *                 campCardSelect's adminArea select, CAM-573) — a Prove-It
 *                 guard that fails if that assumption ever silently breaks
 */
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { campCardSelect, type AdminAreaChainNode } from '@/lib/read-models/camp-card';
import { aiCampCardSelect, toAiCampCard, type AiCampCardPayload } from '@/lib/read-models/ai-camp-card';
import { buildLocationText } from '@/components/CampgroundCard';

function makeRow(overrides: Partial<AiCampCardPayload> = {}): AiCampCardPayload {
  return {
    id: 'c1',
    nameTh: 'ลานกางเต็นท์โคราช',
    nameEn: 'Korat Camp',
    nameThSlug: 'korat-camp-th',
    nameEnSlug: 'korat-camp-en',
    priceLow: new Prisma.Decimal('800.00'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    avgRating: null,
    reviewCount: 0,
    location: { province: 'Nakhon Ratchasima', district: 'Mueang Nakhon Ratchasima', adminArea: null },
    images: [],
    options: [],
    ...overrides,
  } as AiCampCardPayload;
}

describe('aiCampCardSelect — no Prisma select change was needed (CAM-597 structural guard)', () => {
  it('[structural] aiCampCardSelect.location already carries the adminArea chain via campCardSelect (spread, unchanged by this story)', () => {
    expect(aiCampCardSelect.location).toBe(campCardSelect.location);
    expect((aiCampCardSelect.location as { select: { adminArea?: unknown } }).select.adminArea).toBeDefined();
  });
});

describe('toAiCampCard — CAM-597 attaches the id-derived bilingual chain (real pipeline, not a stub)', () => {
  const adminArea: AdminAreaChainNode = {
    level: 'DISTRICT',
    nameTh: 'เมืองนครราชสีมา',
    nameEn: 'Mueang Nakhon Ratchasima',
    parent: {
      level: 'PROVINCE',
      nameTh: 'นครราชสีมา',
      nameEn: 'Nakhon Ratchasima',
      parent: null,
    },
  };

  it('[normal] AC-1: a Thai session renders the district + province in Thai — the actual string, not "not empty"', () => {
    const card = toAiCampCard(
      makeRow({ location: { province: 'Nakhon Ratchasima', district: 'Mueang Nakhon Ratchasima', adminArea } })
    );
    const text = buildLocationText(card.location, 'th');
    expect(text).toBe('เมืองนครราชสีมา, นครราชสีมา');
    expect(text).not.toMatch(/[a-zA-Z]/);
  });

  it('[normal] AC-2/BR-3/EC-2: the SAME card renders district + province in English when the language switches — no re-fetch, no stale text', () => {
    const card = toAiCampCard(
      makeRow({ location: { province: 'Nakhon Ratchasima', district: 'Mueang Nakhon Ratchasima', adminArea } })
    );
    const th = buildLocationText(card.location, 'th');
    const en = buildLocationText(card.location, 'en');
    expect(en).toBe('Mueang Nakhon Ratchasima, Nakhon Ratchasima');
    expect(en).not.toBe(th);
    expect(en).not.toContain('เมือง');
  });

  it('[null/empty] AC-4/BR-4/EC-4: no adminArea at all still renders — falls back to the raw province, card is kept', () => {
    const card = toAiCampCard(makeRow({ location: { province: 'Nakhon Ratchasima', district: null, adminArea: null } }));
    expect(card.location.provinceTh).toBeUndefined();
    const text = buildLocationText(card.location, 'th');
    expect(text).toBe('Nakhon Ratchasima');
  });

  it('[null/empty] EC-4: no Location row at all never throws and never drops the card (G8, unchanged)', () => {
    const row = makeRow({ location: undefined as unknown as AiCampCardPayload['location'] });
    expect(() => toAiCampCard(row)).not.toThrow();
    const card = toAiCampCard(row);
    expect(card.location.province).toBe('');
    expect(buildLocationText(card.location, 'th')).toBe('');
  });

  it('[boundary] a chain resolved to PROVINCE-only depth renders province alone, no dangling comma', () => {
    const provinceOnly: AdminAreaChainNode = { level: 'PROVINCE', nameTh: 'ตราด', nameEn: 'Trat', parent: null };
    const card = toAiCampCard(makeRow({ location: { province: 'Trat', district: null, adminArea: provinceOnly } }));
    const th = buildLocationText(card.location, 'th');
    expect(th).toBe('ตราด');
    expect(th).not.toContain(',');
  });
});
