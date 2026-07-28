/**
 * CAM-600 — pins the `subDistrict` parameter-description reconciliation,
 * the same treatment CAM-596 gave `district` (`cam-596-tool-description.test.ts`):
 * a new server-side pre-pass hint now exists for a CURATED, camp-holding
 * sub-district shortlist, so the "don't guess" guidance is reconciled
 * (never removed) with a first sentence telling the model to follow a
 * confirmed server instruction.
 */
import { describe, it, expect } from 'vitest';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';

describe('CAM-600 searchCampsitesTool.jsonSchema — subDistrict guidance reconciled, not lost', () => {
  const schema = searchCampsitesTool.jsonSchema as {
    properties: { subDistrict: { description: string } };
  };

  it('[normal] subDistrict description tells the model a server hint is authoritative and must be followed', () => {
    expect(schema.properties.subDistrict.description).toContain('that is a confirmed match and you MUST follow both');
  });

  it('[regression, CAM-587 AC-6 honest-failure preserved] subDistrict description still tells the model never to guess on its own initiative', () => {
    expect(schema.properties.subDistrict.description).toContain('do NOT guess');
    expect(schema.properties.subDistrict.description).toContain('returns zero results');
  });
});
