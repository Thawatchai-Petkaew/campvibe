/**
 * cam-362-spot-zone-select.test.ts — CAM-362
 *
 * Source-inspection tests for the spot <Select> replacing the free-text
 * zone <InputField> in components/spot-form-dialog.tsx: existing-zones
 * rendering, the inline "create new zone" flow (tech.md §3.2/§4.1), and the
 * round-1 constraint that an existing zoned spot cannot be un-zoned from
 * this dialog (tech.md §4.2 — zoneId is a validated uuid or omitted
 * entirely; there is no accepted "clear the zone" payload shape). Same
 * node-env/no-jsdom constraint as __tests__/cam-352-spot-form-dialog.test.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import translations from '../locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const dialogSrc = src('components/spot-form-dialog.tsx');

describe('CAM-362 — spot zone <Select> replaces the free-text input', () => {
  it('the zone <Select> is a controlled component bound to zoneId (not free-text zone state)', () => {
    expect(dialogSrc).toContain('const [zoneId, setZoneId] = useState<string>(NO_ZONE_VALUE)');
    expect(dialogSrc).toContain(
      '<Select value={zoneId} onValueChange={handleZoneSelectChange} disabled={submitting}>'
    );
    expect(dialogSrc).toContain('data-testid="select--spot-zone"');
  });

  it('accepts the camp\'s live zones as a prop and renders one SelectItem per zone', () => {
    expect(dialogSrc).toContain('zones: ZoneDTO[];');
    expect(dialogSrc).toContain('{localZones.map((zoneOption) => (');
    expect(dialogSrc).toContain('<SelectItem key={zoneOption.id} value={zoneOption.id}>');
  });

  it('keeps localZones in sync with the zones prop (parent refetch propagates in)', () => {
    expect(dialogSrc).toContain('const [localZones, setLocalZones] = useState<ZoneDTO[]>(zones)');
    expect(dialogSrc).toContain('useEffect(() => {\n    setLocalZones(zones);\n  }, [zones]);');
  });

  it('populates zoneId from the spot being edited, or NO_ZONE_VALUE for create', () => {
    expect(dialogSrc).toContain('setZoneId(spot.zoneId ?? NO_ZONE_VALUE)');
    expect(dialogSrc).toContain('setZoneId(NO_ZONE_VALUE)');
  });
});

describe('CAM-362 — payload: zoneId only, never the legacy zone string', () => {
  it('never sends the legacy `zone` field from this form (fully replaced by zoneId)', () => {
    const submitBody = dialogSrc.slice(
      dialogSrc.indexOf('const body = {'),
      dialogSrc.indexOf('// Client pre-check')
    );
    expect(submitBody).not.toMatch(/\bzone:\s/);
  });

  it('omits zoneId entirely when NO_ZONE_VALUE is selected (never sends an explicit null)', () => {
    expect(dialogSrc).toContain('...(zoneId !== NO_ZONE_VALUE ? { zoneId } : {})');
    expect(dialogSrc).not.toContain('zoneId: null');
  });
});

describe('CAM-362 — round-1 constraint: cannot un-zone an existing zoned spot from this dialog', () => {
  it('disables the "no zone" option only when editing a spot that already has a zoneId', () => {
    expect(dialogSrc).toContain('const noZoneDisabled = isEditing && !!spot?.zoneId;');
    expect(dialogSrc).toContain('<SelectItem value={NO_ZONE_VALUE} disabled={noZoneDisabled}>');
  });

  it('shows an explanatory hint when the option is disabled (not a silent dead-end)', () => {
    expect(dialogSrc).toContain('{noZoneDisabled && (');
    expect(dialogSrc).toContain('{copy.zoneSelectNoZoneDisabledHint}');
  });

  it('a NEW spot (not editing) is never disabled — no-zone is the default, valid choice', () => {
    // isEditing is `!!spot`; noZoneDisabled short-circuits false when spot is null.
    const idx = dialogSrc.indexOf('const noZoneDisabled = isEditing && !!spot?.zoneId;');
    expect(idx).toBeGreaterThan(-1);
  });
});

describe('CAM-362 — inline "create new zone" flow (tech.md §3.2)', () => {
  it('selecting the create-new sentinel opens the inline input instead of committing a zoneId', () => {
    expect(dialogSrc).toContain('const CREATE_NEW_ZONE_VALUE = "__create_new_zone__"');
    expect(dialogSrc).toContain('if (value === CREATE_NEW_ZONE_VALUE) {');
    expect(dialogSrc).toContain('setShowCreateZoneInput(true);');
  });

  it('the inline create input + confirm/cancel controls carry the documented test ids', () => {
    expect(dialogSrc).toContain('data-testid="section--spot-zone-inline-create"');
    expect(dialogSrc).toContain('data-testid="input--spot-zone-inline-create-name"');
    expect(dialogSrc).toContain('data-testid="btn--spot-zone-inline-create-confirm"');
    expect(dialogSrc).toContain('data-testid="btn--spot-zone-inline-create-cancel"');
  });

  it('reuses the shared zoneCreateSchema + createZone client (no re-implemented validation/fetch)', () => {
    expect(dialogSrc).toContain(
      'import { zoneCreateSchema, ZONE_NAME_TOO_LONG_MESSAGE } from "@/lib/validations/zone"'
    );
    expect(dialogSrc).toContain('import { createZone } from "@/lib/zone-client"');
    expect(dialogSrc).toContain('zoneCreateSchema.safeParse({ name: newZoneName })');
  });

  it('on success: appends the new zone locally, selects it, closes the input, and notifies the parent', () => {
    const handlerBody = dialogSrc.slice(
      dialogSrc.indexOf('const handleInlineCreateZone ='),
      dialogSrc.indexOf('const handleSubmit =')
    );
    expect(handlerBody).toContain('setLocalZones((prev) => [...prev, result.zone])');
    expect(handlerBody).toContain('setZoneId(result.zone.id)');
    expect(handlerBody).toContain('setShowCreateZoneInput(false)');
    expect(handlerBody).toContain('onZonesChanged?.()');
  });

  it('maps 409/403/other exactly like the zone manager (duplicate/forbidden/generic)', () => {
    const handlerBody = dialogSrc.slice(
      dialogSrc.indexOf('const handleInlineCreateZone ='),
      dialogSrc.indexOf('const handleSubmit =')
    );
    expect(handlerBody).toContain('result.reason === "duplicate"');
    expect(handlerBody).toContain('? copy.zoneDuplicateError');
    expect(handlerBody).toContain('result.reason === "forbidden"');
    expect(handlerBody).toContain('? copy.zoneForbiddenMessage');
    expect(handlerBody).toContain(': copy.zoneCreateFailed');
  });

  it('the inline-create confirm + cancel buttons are both explicit type="button" (never bleed into the spot form submit)', () => {
    const confirmBtnStart = dialogSrc.indexOf('data-testid="btn--spot-zone-inline-create-confirm"');
    const cancelBtnStart = dialogSrc.indexOf('data-testid="btn--spot-zone-inline-create-cancel"');
    expect(confirmBtnStart).toBeGreaterThan(-1);
    expect(cancelBtnStart).toBeGreaterThan(confirmBtnStart);

    // Each <Button ...> opening tag is a bounded, single-element window
    // ending right before this test id attribute.
    const confirmTagStart = dialogSrc.lastIndexOf('<Button', confirmBtnStart);
    const cancelTagStart = dialogSrc.lastIndexOf('<Button', cancelBtnStart);
    expect(dialogSrc.slice(confirmTagStart, confirmBtnStart)).toContain('type="button"');
    expect(dialogSrc.slice(cancelTagStart, cancelBtnStart)).toContain('type="button"');
  });
});

describe('CAM-362 — i18n: zone select copy exists in both locales, no hardcoded Thai in JSX', () => {
  it('reuses unassignedZoneLabel for the no-zone option (DRY with the CAM-361 grouping label)', () => {
    expect(dialogSrc).toContain('{copy.unassignedZoneLabel}');
  });

  it('zoneSelectCreateNewOption + zoneSelectNoZoneDisabledHint exist in both locales', () => {
    expect(translations.en.spotManagement.zoneSelectCreateNewOption).toBeTruthy();
    expect(translations.th.spotManagement.zoneSelectCreateNewOption).toBeTruthy();
    expect(translations.en.spotManagement.zoneSelectNoZoneDisabledHint).toBeTruthy();
    expect(translations.th.spotManagement.zoneSelectNoZoneDisabledHint).toBeTruthy();
  });

  it('still does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(dialogSrc)).toBe(false);
  });
});
