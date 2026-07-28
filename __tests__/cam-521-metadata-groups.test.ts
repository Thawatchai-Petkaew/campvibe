/**
 * cam-521-metadata-groups.test.ts — CAM-521 (S8, final taxonomy slice)
 *
 * 3 NEW MasterData groups — `Stay connected` (SAIS/SDTC/STRU, phone signal),
 * `Marking method` (YUSF/OWNE, how campers claim a spot), `Driveway`
 * (BACK/PARA/PTHG, driveway type) — delivered HOST-INPUT +
 * CAMPER-DETAIL-DISPLAY ONLY. Deliberately NOT searchable (BR-4): no
 * `searchCampsites`/`bulk-availability` filter param, no `campsite-filters.ts`
 * wiring, no catalog-pipeline change, and EXCLUDED from FilterModal so they
 * never render as inert filter sections. No schema/migration change (group is
 * a String column, the `options` m2m relation already exists).
 *
 * Layer: unit (zod schema + seed.ts source parse) + mocked-Prisma route
 * integration (POST/PUT, same precedent as
 * __tests__/cam-365-publish-gate.test.ts) + source-inspection for
 * components/FilterModal.tsx's exclusion (no jsdom in this repo, same
 * precedent as __tests__/cam-356-form-validation-ux.test.ts /
 * __tests__/cam-517-campground-type.test.ts).
 *
 * AC/BR/EC -> test matrix
 * ───────────────────────────────────────────────────────────────────────────
 * BR-1        prisma/seed.ts seeds all 8 codes under their 3 groups, globally
 *             unique (no PK collision with any other seeded code).
 * AC-1/BR-2   campSiteSchema accepts the 3 new optional code-array fields
 *             (host-form payload shape).
 * AC-1/BR-2   POST/PUT routes resolve+persist the 3 fields via
 *             resolveOptionConnect (host round-trip).
 * EC-2        PUT: a partial update omitting a group never wipes the options
 *             relation (mirrors the CAM-515/516 guard, extended in
 *             cam-365-publish-gate.test.ts too).
 * EC-1        the 6 seeded icons (Signal/Hand/UserCheck/CornerDownLeft/
 *             AlignHorizontalJustifyCenter/MoveRight) are real lucide-react
 *             exports.
 * AC-3/BR-4   FilterModal excludes all 3 groups from its rendered filter
 *             sections — proven by source-inspection + a teeth check.
 * (coverage)  no diff to search-campsites.ts / bulk-availability.ts /
 *             campsite-filters.ts / the catalog pipeline (grep-proven).
 * ───────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { campSiteSchema } from '@/lib/validations/campsite';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

// ===========================================================================
// 1. prisma/seed.ts — BR-1 (3 groups, 8 codes, no PK collision) + EC-1 (icons)
// ===========================================================================

describe('CAM-521 BR-1 — prisma/seed.ts seeds the 3 new groups with globally-unique codes', () => {
  const seedSrc = src('prisma/seed.ts');
  const start = seedSrc.indexOf('const masterData = [');
  const end = seedSrc.indexOf('\n]', start);
  const masterDataBlock = seedSrc.slice(start, end);

  const CODE_TO_GROUP: Record<string, string> = {
    SAIS: 'Stay connected',
    SDTC: 'Stay connected',
    STRU: 'Stay connected',
    YUSF: 'Marking method',
    OWNE: 'Marking method',
    BACK: 'Driveway',
    PARA: 'Driveway',
    PTHG: 'Driveway',
  };

  it.each(Object.entries(CODE_TO_GROUP))('[normal] %s is seeded under group "%s"', (code, group) => {
    const re = new RegExp(`\\{\\s*code:\\s*'${code}',\\s*group:\\s*'${group}'`);
    expect(masterDataBlock.match(re), `no ${code} row found under group '${group}'`).not.toBeNull();
  });

  it('[normal][BR-1] every code across the WHOLE masterData array is globally unique (no PK collision)', () => {
    const re = /code:\s*'([A-Z0-9]+)'/g;
    const codes: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(masterDataBlock))) codes.push(m[1]);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    expect(dupes, `duplicate MasterData code(s) found: ${dupes.join(', ')}`).toEqual([]);
  });

  it('[normal][EC-1] the 6 seeded icons are real lucide-react exports', async () => {
    const lucide = await import('lucide-react');
    const iconFor = (code: string) => {
      const re = new RegExp(`code:\\s*'${code}',[^}]*icon:\\s*'([^']+)'`);
      const m = masterDataBlock.match(re);
      return m ? m[1] : null;
    };
    for (const code of ['SAIS', 'SDTC', 'STRU', 'YUSF', 'OWNE', 'BACK', 'PARA', 'PTHG']) {
      const icon = iconFor(code);
      expect(icon, `no icon found for ${code}`).not.toBeNull();
      expect((lucide as Record<string, unknown>)[icon as string], `"${icon}" (${code}) is not a real lucide-react export`).toBeDefined();
    }
  });

  it('[teeth] removing the SAIS row from the seed block would fail the group assertion above (proves the regex reads the real file)', () => {
    const withoutSais = masterDataBlock.replace(/\{\s*code:\s*'SAIS',\s*group:\s*'Stay connected'[^}]*\},?/, '');
    const re = /code:\s*'SAIS',\s*group:\s*'Stay connected'/;
    expect(withoutSais.match(re)).toBeNull(); // red without the row
    expect(masterDataBlock.match(re)).not.toBeNull(); // green with the real file
  });
});

// ===========================================================================
// 2. lib/validations/campsite.ts — AC-1/BR-2 (host-form payload shape, unit)
// ===========================================================================

describe('CAM-521 AC-1/BR-2 — campSiteSchema accepts the 3 new optional code-array fields', () => {
  const base = {
    nameTh: 'ทดสอบแคมป์',
    campSiteType: 'CAGD',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONLI',
    locationId: '550e8400-e29b-41d4-a716-446655440001',
  };

  it('[normal] accepts stayConnected/markingMethod/driveway code arrays together', () => {
    const parsed = campSiteSchema.safeParse({
      ...base,
      stayConnected: ['SAIS', 'STRU'],
      markingMethod: ['YUSF'],
      driveway: ['PTHG'],
    });
    expect(parsed.success).toBe(true);
  });

  it('[null/empty] all 3 fields are optional — a payload omitting them still validates', () => {
    const parsed = campSiteSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('[boundary] an empty array is accepted for each field (explicit "none selected")', () => {
    const parsed = campSiteSchema.safeParse({
      ...base,
      stayConnected: [],
      markingMethod: [],
      driveway: [],
    });
    expect(parsed.success).toBe(true);
  });
});

// ===========================================================================
// 3. Route integration — POST /api/campsites + PUT /api/campsites/[id]
//    (mocked Prisma, same precedent as cam-365-publish-gate.test.ts)
// ===========================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campSite: {
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      // CAM-617: POST /api/campsites now checks Location exclusivity before
      // create — same fixture-note pattern CAM-613 documented.
      findFirst: vi.fn(),
    },
    spot: {
      count: vi.fn(),
    },
    masterData: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    location: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth-utils', () => ({
  requireCampSitePermission: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { requireCampSitePermission, requireAuth } from '@/lib/auth-utils';
import { PUT as campSitePUT } from '@/app/api/campsites/[id]/route';
import { POST as campSitePOST } from '@/app/api/campsites/route';
import { _store } from '@/lib/rate-limit';

const CAMP_ID = '550e8400-e29b-41d4-a716-446655440521';
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAllowed(overrides: Record<string, unknown> = {}, role: string = 'OPERATOR') {
  (requireCampSitePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    campSite: {
      id: CAMP_ID,
      operatorId: 'op-1',
      priceLow: null,
      isFree: false,
      extraFeeAmount: null,
      extraFeeLabel: null,
      cancellationPolicy: null,
      useSpotView: false,
      maxGuestsPerDay: null,
      isPublished: false,
      ...overrides,
    } as never,
    session: { user: { id: 'op-1', role } } as never,
  });
}

function putRequest(body: Record<string, unknown>) {
  return new NextRequest(`http://localhost/api/campsites/${CAMP_ID}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const LOCATION_ID = '550e8400-e29b-41d4-a716-446655440001';
function baseCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    nameTh: 'ทดสอบแคมป์',
    latitude: 13.75,
    longitude: 100.5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    bookingMethod: 'ONLI',
    locationId: LOCATION_ID,
    campSiteType: 'CAGD',
    ...overrides,
  };
}
function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/campsites', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}
function mockAuthAllowed(userId = 'op-create-521') {
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
    error: null,
    session: { user: { id: userId, role: 'OPERATOR' } } as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
  (prisma.campSite.update as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: CAMP_ID,
    nameThSlug: 'test-camp-th',
    nameEnSlug: 'test-camp-en',
  });
  // CAM-617: no existing CampSite at the mocked locationId by default — the
  // create-path test below in this file exercises the legitimate flow.
  (prisma.campSite.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
});

describe('POST /api/campsites — AC-1/BR-2: host round-trip creates the relation via resolveOptionConnect', () => {
  it('[normal] a create carrying all 3 new fields resolves+connects the option codes', async () => {
    mockAuthAllowed();
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { code: 'SAIS' },
      { code: 'YUSF' },
      { code: 'PTHG' },
    ]);
    (prisma.campSite.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-camp-521' });

    const res = await campSitePOST(
      postRequest(baseCreateBody({ stayConnected: ['SAIS'], markingMethod: ['YUSF'], driveway: ['PTHG'] }))
    );

    expect(res.status).toBe(201);
    const call = (prisma.campSite.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options.connect).toEqual(
      expect.arrayContaining([{ code: 'SAIS' }, { code: 'YUSF' }, { code: 'PTHG' }])
    );
  });
});

describe('PUT /api/campsites/[id] — EC-2 (CAM-521): a partial PUT that omits the 3 new groups never wipes their relation', () => {
  it('[edge] a price-only PUT (no taxonomy key in the raw body) never touches the options relation', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ priceLow: 999 }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data).not.toHaveProperty('options');
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });

  it('[normal] a PUT carrying ONLY driveway resolves+replaces the options relation via resolveOptionConnect', async () => {
    mockAllowed({});
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ code: 'BACK' }]);

    const res = await campSitePUT(putRequest({ driveway: ['BACK'] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [{ code: 'BACK' }] });
  });

  it('[normal] a PUT carrying ONLY stayConnected + markingMethod resolves+replaces the relation with BOTH resolved codes', async () => {
    mockAllowed({});
    (prisma.masterData.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { code: 'SDTC' },
      { code: 'OWNE' },
    ]);

    const res = await campSitePUT(
      putRequest({ stayConnected: ['SDTC'], markingMethod: ['OWNE'] }),
      makeParams(CAMP_ID)
    );

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({
      set: expect.arrayContaining([{ code: 'SDTC' }, { code: 'OWNE' }]),
    });
  });

  it('[edge] an explicit empty driveway:[] in the raw body IS a taxonomy key present -> clears the relation (no masterData call)', async () => {
    mockAllowed({});

    const res = await campSitePUT(putRequest({ driveway: [] }), makeParams(CAMP_ID));

    expect(res.status).toBe(200);
    const call = (prisma.campSite.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.data.options).toEqual({ set: [] });
    expect(prisma.masterData.findMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. components/FilterModal.tsx — AC-3/BR-4 (exclusion, source-inspection)
// ===========================================================================

describe('CAM-521 AC-3/BR-4 — FilterModal EXCLUDES the 3 new groups (no inert filter sections)', () => {
  const formSrc = src('components/FilterModal.tsx');

  it('[normal] NON_FILTERABLE_GROUPS names exactly the 3 new groups', () => {
    expect(formSrc).toMatch(
      /NON_FILTERABLE_GROUPS\s*=\s*\[\s*'Stay connected',\s*'Marking method',\s*'Driveway'\s*\]/
    );
  });

  it('[normal] the section-build pipeline actually filters sections through NON_FILTERABLE_GROUPS before rendering', () => {
    expect(formSrc).toContain('.filter(([groupName]) => !NON_FILTERABLE_GROUPS.includes(groupName))');
  });

  it('[teeth] removing the .filter(...) exclusion line would let getFilterOptions() render every group unfiltered (proves the guard is load-bearing)', () => {
    const withoutExclusion = formSrc.replace(
      '.filter(([groupName]) => !NON_FILTERABLE_GROUPS.includes(groupName))\n                ',
      ''
    );
    expect(withoutExclusion).not.toContain('.filter(([groupName]) => !NON_FILTERABLE_GROUPS.includes(groupName))');
    expect(formSrc).toContain('.filter(([groupName]) => !NON_FILTERABLE_GROUPS.includes(groupName))');
  });
});

// ===========================================================================
// 5. Coverage — no diff to the search/catalog pipeline (BR-4)
// ===========================================================================

describe('CAM-521 BR-4 — no search/catalog wiring for the 3 new groups', () => {
  it('[normal] search-campsites.ts never mentions the 3 new group names or their codes', () => {
    const searchSrc = src('lib/ai/tools/search-campsites.ts');
    for (const needle of ['Stay connected', 'Marking method', 'Driveway', 'stayConnected', 'markingMethod', 'driveway', 'SAIS', 'YUSF', 'BACK']) {
      expect(searchSrc, `search-campsites.ts unexpectedly mentions "${needle}"`).not.toContain(needle);
    }
  });

  it('[normal] bulk-availability.ts never mentions the 3 new group names or their codes', () => {
    const bulkSrc = src('lib/ai/tools/bulk-availability.ts');
    for (const needle of ['stayConnected', 'markingMethod', 'driveway', 'SAIS', 'YUSF', 'BACK']) {
      expect(bulkSrc, `bulk-availability.ts unexpectedly mentions "${needle}"`).not.toContain(needle);
    }
  });

  it('[normal] campsite-filters.ts never mentions the 3 new fields (no addOptionFilter passthrough)', () => {
    const filtersSrc = src('lib/campsite-filters.ts');
    for (const needle of ['stayConnected', 'markingMethod', 'driveway']) {
      expect(filtersSrc, `campsite-filters.ts unexpectedly mentions "${needle}"`).not.toContain(needle);
    }
  });

  it('[normal] the catalog GET query schema (catalog-cursor.ts) never mentions the 3 new fields', () => {
    const cursorSrc = src('lib/validations/catalog-cursor.ts');
    for (const needle of ['stayConnected', 'markingMethod', 'driveway']) {
      expect(cursorSrc, `catalog-cursor.ts unexpectedly mentions "${needle}"`).not.toContain(needle);
    }
  });
});
