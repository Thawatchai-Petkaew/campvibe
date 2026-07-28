/**
 * cam-597-ai-chat-card-location.test.ts — CAM-597
 *
 * "Both assistant surfaces" — AiChatCampCard (result card) and
 * AiChatDetailCard (detail card) render the SAME localized
 * "district(s), province" text `components/CampgroundCard.tsx` already
 * shows on the catalog card, via the SAME `buildLocationText` (never a
 * second implementation) — reused through a dedicated re-export
 * (`components/ai-chat/location-text.ts`) so `AiChatCampCard.tsx` keeps its
 * CAM-428 "no CampgroundCard import" decoupling.
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf-8');

const cardSrc = read('components/ai-chat/AiChatCampCard.tsx');
const detailSrc = read('components/ai-chat/AiChatDetailCard.tsx');
const shimSrc = read('components/ai-chat/location-text.ts');

describe('components/ai-chat/location-text.ts — one implementation, re-exported (not a second copy)', () => {
  it('[structural] re-exports buildLocationText from the catalog card component, no parallel implementation', () => {
    expect(shimSrc).toContain('export { buildLocationText } from "@/components/CampgroundCard";');
  });
});

describe('AiChatCampCard.tsx — CAM-597 renders the localized location text (AC-1/AC-2)', () => {
  it('[structural] imports buildLocationText via the dedicated shim, never the catalog card directly (CAM-428 decouple preserved)', () => {
    expect(cardSrc).toContain('import { buildLocationText } from "@/components/ai-chat/location-text";');
    expect(cardSrc).not.toMatch(/CampgroundCard/);
  });

  it('[unit] the rendered text is buildLocationText(card.location, language) — not the raw location.province', () => {
    expect(cardSrc).toContain('const locationText = buildLocationText(card.location, language);');
    expect(cardSrc).toContain('<span className="line-clamp-1">{locationText}</span>');
    expect(cardSrc).not.toContain('<span className="line-clamp-1">{card.location.province}</span>');
  });

  it('[regression] the G8 hasProvince gate is UNCHANGED (still the raw province presence check, CAM-428 pin)', () => {
    expect(cardSrc).toContain('card.location.province.trim().length > 0');
  });
});

describe('AiChatDetailCard.tsx — CAM-597 renders the localized location text on the detail hero (AC-3)', () => {
  it('[structural] imports buildLocationText via the SAME dedicated shim', () => {
    expect(detailSrc).toContain('import { buildLocationText } from "@/components/ai-chat/location-text";');
  });

  it('[unit] the hero location parts array now carries the localized text, not the raw province', () => {
    expect(detailSrc).toContain('const locationText = buildLocationText(card.location, language);');
    expect(detailSrc).toContain('hasProvince ? locationText : null,');
    expect(detailSrc).not.toContain('hasProvince ? card.location.province : null,');
  });

  it('[regression] the G8 hasProvince gate is UNCHANGED (still the raw province presence check, CAM-447 pin)', () => {
    expect(detailSrc).toContain('card.location.province.trim().length > 0');
  });

  it('[unit] the hero location still reads from the instant `card` prop, never the async detail.location (design doctrine unchanged)', () => {
    // Scoped past the header doc comment (which legitimately NAMES
    // "detail.location" in prose to explain why it is never read) to the
    // real component body/JSX, where the property access itself must never
    // appear.
    const functionBody = detailSrc.slice(detailSrc.indexOf('export function AiChatDetailCard'));
    expect(functionBody).not.toMatch(/detail\.location/);
  });
});

describe('get-camp-detail.ts — left untouched (CAM-597 out-of-scope / non-gap)', () => {
  it('[structural] no adminArea reference was added — this tool file\'s own `location` field is not rendered by AiChatDetailCard, so no Prisma select change was needed', () => {
    const src = read('lib/ai/tools/get-camp-detail.ts');
    expect(src).not.toContain('adminArea');
  });
});

describe('search-campsites.ts / check-availability.ts / bulk-availability.ts — no Prisma select edit was needed (CAM-597)', () => {
  it('[structural] all three still source their cards via the unchanged aiCampCardSelect/toAiCampCard pair', () => {
    for (const file of [
      'lib/ai/tools/search-campsites.ts',
      'lib/ai/tools/check-availability.ts',
      'lib/ai/tools/bulk-availability.ts',
    ]) {
      const src = read(file);
      expect(src).toContain('aiCampCardSelect');
      expect(src).toContain('toAiCampCard');
    }
  });
});
