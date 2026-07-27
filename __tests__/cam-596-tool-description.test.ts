/**
 * CAM-596 — pins the tool-surface text changes (root-cause point 1 of the
 * ticket): the headline description now names district/sub-district as
 * searchable axes, and the per-parameter "don't guess" guidance is
 * reconciled with the new server-side pre-pass hint without losing the
 * honest-failure behavior CAM-587 AC-6 established.
 */
import { describe, it, expect } from 'vitest';
import { searchCampsitesTool } from '@/lib/ai/tools/search-campsites';

describe('CAM-596 searchCampsitesTool — headline description names district/sub-district', () => {
  it('[normal] the headline sentence (the FIRST thing the model reads) mentions district and sub-district', () => {
    expect(searchCampsitesTool.description).toContain('district, sub-district');
  });

  it('[regression] the headline sentence still names every pre-existing axis (province, region, type)', () => {
    expect(searchCampsitesTool.description).toContain('province, region, district, sub-district, type');
  });
});

describe('CAM-596 searchCampsitesTool.jsonSchema — district/subDistrict guidance reconciled, not lost', () => {
  const schema = searchCampsitesTool.jsonSchema as {
    properties: { district: { description: string }; subDistrict: { description: string } };
  };

  it('[normal] district description tells the model a server hint is authoritative and must be followed', () => {
    expect(schema.properties.district.description).toContain('that is a confirmed match and you MUST follow it');
  });

  it('[regression, CAM-587 AC-6 honest-failure preserved] district description still tells the model never to guess on its own initiative', () => {
    expect(schema.properties.district.description).toContain('do NOT guess');
    expect(schema.properties.district.description).toContain('returns zero results');
  });

  it('[regression, CAM-587 AC-6 honest-failure preserved] subDistrict description still tells the model never to guess', () => {
    expect(schema.properties.subDistrict.description).toContain('do NOT guess');
    expect(schema.properties.subDistrict.description).toContain('returns zero results');
  });
});
