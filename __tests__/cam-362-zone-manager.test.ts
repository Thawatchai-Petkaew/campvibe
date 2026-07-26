/**
 * cam-362-zone-manager.test.ts — CAM-362
 *
 * Source-inspection tests for the compact Zone Manager area added to
 * components/spot-management-section.tsx (list the camp's live zones +
 * add-new with inline 409 + delete-per-zone via ConfirmDialog). Same
 * node-env/no-jsdom constraint as the rest of this codebase's frontend
 * suites (see cam-361-spot-management-section.test.ts's header) —
 * source-inspection gives structural coverage; the fetch/status-mapping
 * logic itself is covered for real in cam-362-zone-client.test.ts.
 *
 * Covers: zone list rendering (AC: list the camp's live zones), add-new +
 * 409 inline (AC: 409 shown inline with the API's verbatim copy), delete
 * per zone via ConfirmDialog + detachedSpotCount in the success toast,
 * refetch zones + spots after any zone change (tech.md §4.1), i18n
 * (new copy keys verbatim-consistent with the API's Thai messages).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import translations from '../locales/translations.json';
import { ZONE_NAME_REQUIRED_MESSAGE, ZONE_NAME_TOO_LONG_MESSAGE, ZONE_DUPLICATE_MESSAGE } from '../lib/validations/zone';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const sectionSrc = src('components/spot-management-section.tsx');

describe('CAM-362 — zone manager reuses the shared zone-client + zod schema (no re-implementation)', () => {
  it('imports createZone/deleteZone from lib/zone-client (not an inline fetch/status-mapping fork)', () => {
    expect(sectionSrc).toContain('import { createZone, deleteZone, fetchZonesSafe } from "@/lib/zone-client"');
  });

  it('imports zoneCreateSchema from lib/validations/zone for the client pre-check (ux.md #1)', () => {
    expect(sectionSrc).toContain(
      'import { zoneCreateSchema, ZONE_NAME_TOO_LONG_MESSAGE } from "@/lib/validations/zone"'
    );
    expect(sectionSrc).toContain('zoneCreateSchema.safeParse({ name: newZoneName })');
  });
});

describe('CAM-362 — zone manager: list the camp\'s live zones', () => {
  it('gates the whole block on canManage + not loading/erroring (shares the parent load state)', () => {
    expect(sectionSrc).toContain(
      'const zoneManagerBlock = canManage && !showSkeleton && !loadError && ('
    );
  });

  it('renders one row per zone with a delete button, keyed by zone.id', () => {
    expect(sectionSrc).toContain('data-testid={`row--zone-${zone.id}`}');
    expect(sectionSrc).toContain('data-testid={`btn--zone-delete-${zone.id}`}');
    expect(sectionSrc).toContain('aria-label={`${copy.zoneDeleteAriaLabel}: ${zone.name}`}');
  });

  it('shows the empty-zones text when there are no live zones yet', () => {
    expect(sectionSrc).toContain('data-testid="empty--zone-manager"');
    expect(sectionSrc).toContain('{copy.zoneManagerEmptyText}');
  });

  it('renders in all 3 variant branches (page / embedded / embedded+hideCard), same block instance', () => {
    const occurrences = [...sectionSrc.matchAll(/\{zoneManagerBlock\}/g)];
    expect(occurrences.length).toBe(3);
  });

  it('is rendered before the spot list in every branch (zones configured first)', () => {
    const blockDefIndex = sectionSrc.indexOf('const zoneManagerBlock =');
    const listBodyDefIndex = sectionSrc.indexOf('const listBody =');
    expect(blockDefIndex).toBeGreaterThan(-1);
    expect(listBodyDefIndex).toBeGreaterThan(blockDefIndex);

    // every usage site puts {zoneManagerBlock} immediately before {listBody}
    const usageBlocks = [...sectionSrc.matchAll(/\{zoneManagerBlock\}\s*\{listBody\}/g)];
    expect(usageBlocks.length).toBe(3);
  });
});

describe('CAM-362 — zone manager: add-new zone + 409 shown inline', () => {
  it('has an add-zone input + button with the documented test ids', () => {
    expect(sectionSrc).toContain('data-testid="form--zone-add"');
    expect(sectionSrc).toContain('data-testid="input--zone-add-name"');
    expect(sectionSrc).toContain('data-testid="btn--zone-add"');
  });

  it('shows the inline error from InputField (not a toast) so it renders under the field', () => {
    expect(sectionSrc).toContain('error={zoneCreateError ?? undefined}');
  });

  it('maps a 409 duplicate response to copy.zoneDuplicateError (verbatim-consistent with the API)', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const handleCreateZone ='),
      sectionSrc.indexOf('const confirmDeleteZone =')
    );
    expect(handlerBody).toContain('result.reason === "duplicate"');
    expect(handlerBody).toContain('? copy.zoneDuplicateError');
  });

  it('maps a 403 forbidden response to copy.zoneForbiddenMessage and any other failure to a generic message', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const handleCreateZone ='),
      sectionSrc.indexOf('const confirmDeleteZone =')
    );
    expect(handlerBody).toContain('result.reason === "forbidden"');
    expect(handlerBody).toContain('? copy.zoneForbiddenMessage');
    expect(handlerBody).toContain(': copy.zoneCreateFailed');
  });

  it('client pre-check maps the too-long case to copy.zoneNameTooLong, else copy.zoneNameRequired', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const handleCreateZone ='),
      sectionSrc.indexOf('const confirmDeleteZone =')
    );
    expect(handlerBody).toContain('issue?.message === ZONE_NAME_TOO_LONG_MESSAGE ? copy.zoneNameTooLong : copy.zoneNameRequired');
  });

  it('on success: clears the input, shows a success toast, and refetches (zones + spots, tech.md §4.1)', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const handleCreateZone ='),
      sectionSrc.indexOf('const confirmDeleteZone =')
    );
    expect(handlerBody).toContain('toast.success(copy.zoneCreateSuccess)');
    expect(handlerBody).toContain('setNewZoneName("")');
    expect(handlerBody).toContain('await loadData()');
  });
});

describe('CAM-362 — zone manager: delete per zone via ConfirmDialog + detachedSpotCount', () => {
  it('wires a dedicated ConfirmDialog for zone delete (destructive, distinct test id from the spot one)', () => {
    expect(sectionSrc).toContain('data-testid="modal--zone-delete-confirm"');
    expect(sectionSrc).toContain('title={copy.zoneDeleteConfirmTitle}');
    expect(sectionSrc).toContain('onConfirm={confirmDeleteZone}');
    expect(sectionSrc).toContain('isLoading={deletingZone}');
  });

  it('the confirm title warns generically (spots become unzoned) before the count is known', () => {
    expect(translations.th.spotManagement.zoneDeleteConfirmTitle).toContain('ไม่ระบุโซน');
  });

  it('after DELETE succeeds, uses the returned detachedSpotCount in the success toast when > 0', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const confirmDeleteZone ='),
      sectionSrc.indexOf('const renderSpotRow =')
    );
    expect(handlerBody).toContain('result.detachedSpotCount > 0');
    expect(handlerBody).toContain(
      'copy.zoneDeleteSuccessWithCount.replace("{N}", String(result.detachedSpotCount))'
    );
    expect(handlerBody).toContain(': copy.zoneDeleteSuccess'); // 0 detached -> the plain success copy
  });

  it('404 (already deleted / cross-camp) toasts not-found and refetches rather than erroring', () => {
    const handlerBody = sectionSrc.slice(
      sectionSrc.indexOf('const confirmDeleteZone ='),
      sectionSrc.indexOf('const renderSpotRow =')
    );
    expect(handlerBody).toContain('result.reason === "notFound"');
    expect(handlerBody).toContain('toast.error(copy.zoneNotFoundMessage)');
    expect(handlerBody).toContain('await loadData()');
  });
});

describe('CAM-362 — zones ride as a 4th parallel request (tech.md §4.1, no N+1)', () => {
  it('fetches /zones (via fetchZones()) in the SAME Promise.all as /spots + camp + session', () => {
    const loadDataBody = sectionSrc.slice(
      sectionSrc.indexOf('const loadData = useCallback'),
      sectionSrc.indexOf('}, [campSiteId, fetchZones]);')
    );
    // CAM-555 — campRes/sessionRes were renamed campResult/sessionResult when
    // they were switched to the never-throw fetchJsonSafe (root-causing the
    // ac6-spot-lifecycle flake, see __tests__/cam-555-spot-load-isolation.test.ts);
    // the "same Promise.all, no N+1" property this test guards is unchanged.
    expect(loadDataBody).toContain(
      'const [spotsRes, campResult, sessionResult, zonesResult] = await Promise.all(['
    );
    expect(loadDataBody).toContain('fetchZones(),');
  });

  it('no component-local /zones fetch remains — the raw request lives ONLY in fetchZonesSafe (lib/zone-client.ts), reused by loadData + retry', () => {
    // the component no longer fetches /zones directly at all; it delegates
    // to the shared, real-tested fetchZonesSafe (see cam-362-zone-client.test.ts).
    expect(sectionSrc).not.toMatch(/fetch\(`\/api\/campsites\/\$\{campSiteId\}\/zones`/);
    const zoneClientSrc = src('lib/zone-client.ts');
    expect(zoneClientSrc).toContain('export async function fetchZonesSafe(campSiteId: string)');
    const matches = zoneClientSrc.match(/fetch\(`\/api\/campsites\/\$\{campSiteId\}\/zones`/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('SpotFormDialog receives the live zones list + a refetch callback (create/edit flow, tech.md §4.1)', () => {
    expect(sectionSrc).toContain('zones={zones ?? []}');
    expect(sectionSrc).toContain('onZonesChanged={loadData}');
  });
});

describe('G3 fix (I-1) — a zones-fetch failure is isolated from the spots section', () => {
  it('fetchZones() delegates to the real-tested fetchZonesSafe (lib/zone-client.ts) — never re-implements the isolation inline', () => {
    expect(sectionSrc).toContain('import { createZone, deleteZone, fetchZonesSafe } from "@/lib/zone-client"');
    const fetchZonesBody = sectionSrc.slice(
      sectionSrc.indexOf('const fetchZones = useCallback'),
      sectionSrc.indexOf('const loadData = useCallback')
    );
    expect(fetchZonesBody).toContain('const result = await fetchZonesSafe(campSiteId);');
    expect(fetchZonesBody).not.toContain('throw');
  });

  it('a zones failure inside loadData sets zonesLoadError + zones=[] — it does NOT throw into the shared catch', () => {
    const loadDataBody = sectionSrc.slice(
      sectionSrc.indexOf('const loadData = useCallback'),
      sectionSrc.indexOf('}, [campSiteId, fetchZones]);')
    );
    const zonesBranch = loadDataBody.slice(
      loadDataBody.indexOf('if (zonesResult.ok) {'),
      loadDataBody.indexOf('let ownerOrAdmin')
    );
    expect(zonesBranch).toContain('setZones(zonesResult.zones);');
    expect(zonesBranch).toContain('setZonesLoadError(false);');
    expect(zonesBranch).toContain('setZones([]);');
    expect(zonesBranch).toContain('setZonesLoadError(true);');
    expect(zonesBranch).not.toContain('throw');
    // the only throw in loadData is for the spots fetch, not zones
    expect(loadDataBody).toContain('if (!spotsRes.ok) throw new Error("Failed to load spots");');
  });

  it('the spot list keeps rendering when only zones fails: zoneManagerBlock and listBody are independent gates', () => {
    // listBody's own render branches never reference zonesLoadError — a
    // zones-only failure cannot affect the spots skeleton/error/empty/list.
    const listBodyDef = sectionSrc.slice(
      sectionSrc.indexOf('const listBody = ('),
      sectionSrc.indexOf('const dialogs = (')
    );
    expect(listBodyDef).not.toContain('zonesLoadError');
  });

  it('the zone manager shows a LOCAL error + retry (not the shared loadError banner)', () => {
    const zoneManagerBody = sectionSrc.slice(
      sectionSrc.indexOf('const zoneManagerBlock ='),
      sectionSrc.indexOf('const listBody = (')
    );
    expect(zoneManagerBody).toContain('data-testid="alert--zone-manager-load-error"');
    expect(zoneManagerBody).toContain('message={copy.zoneManagerLoadFailed}');
    expect(zoneManagerBody).toContain('data-testid="btn--zone-manager-retry"');
    expect(zoneManagerBody).toContain('onClick={loadZones}');
  });

  it('retry (loadZones) re-fetches ONLY /zones, not spots/camp/session (a lighter, targeted retry)', () => {
    const loadZonesBody = sectionSrc.slice(
      sectionSrc.indexOf('const loadZones = useCallback'),
      sectionSrc.indexOf('useEffect(() => {\n    loadData();')
    );
    expect(loadZonesBody).toContain('const result = await fetchZones();');
    expect(loadZonesBody).not.toContain('Promise.all');
    expect(loadZonesBody).not.toContain('/spots`');
  });

  it('degraded-Select call: an empty zones list still lets the spot form work (no-zone + inline create) — no extra code path needed', () => {
    // zones=[] flows straight into SpotFormDialog's existing `zones` prop;
    // the Select's "no zone" + "create new zone" options render unconditionally
    // regardless of how many entries `zones` has (spot-form-dialog.tsx unchanged).
    const dialogSrc = fs.readFileSync(path.join(root, 'components/spot-form-dialog.tsx'), 'utf-8');
    expect(dialogSrc).toContain('<SelectItem value={NO_ZONE_VALUE} disabled={noZoneDisabled}>');
    expect(dialogSrc).toContain('<SelectItem value={CREATE_NEW_ZONE_VALUE}>{copy.zoneSelectCreateNewOption}</SelectItem>');
  });

  it('i18n: zoneManagerLoadFailed exists in both locales (no em-dash, generic retry copy)', () => {
    expect(translations.th.spotManagement.zoneManagerLoadFailed).toBeTruthy();
    expect(translations.en.spotManagement.zoneManagerLoadFailed).toBeTruthy();
    expect(translations.th.spotManagement.zoneManagerLoadFailed).not.toContain('—');
  });
});

describe('CAM-362 — zone manager i18n: new copy keys verbatim-consistent with the API', () => {
  it('zoneNameRequired matches the API\'s ZONE_NAME_REQUIRED_MESSAGE verbatim', () => {
    expect(translations.th.spotManagement.zoneNameRequired).toBe(ZONE_NAME_REQUIRED_MESSAGE);
  });

  it('zoneNameTooLong matches the API\'s ZONE_NAME_TOO_LONG_MESSAGE verbatim', () => {
    expect(translations.th.spotManagement.zoneNameTooLong).toBe(ZONE_NAME_TOO_LONG_MESSAGE);
  });

  it('zoneDuplicateError matches the API\'s ZONE_DUPLICATE_MESSAGE verbatim', () => {
    expect(translations.th.spotManagement.zoneDuplicateError).toBe(ZONE_DUPLICATE_MESSAGE);
  });

  it('every new key exists in EN too, and no Thai string uses an em-dash separator', () => {
    const newKeys = [
      'zoneManagerTitle',
      'zoneManagerEmptyText',
      'zoneManagerAddPlaceholder',
      'zoneManagerAddButton',
      'zoneNameRequired',
      'zoneNameTooLong',
      'zoneDuplicateError',
      'zoneCreateSuccess',
      'zoneCreateFailed',
      'zoneForbiddenMessage',
      'zoneNotFoundMessage',
      'zoneDeleteConfirmTitle',
      'zoneDeleteSuccess',
      'zoneDeleteSuccessWithCount',
      'zoneDeleteFailed',
      'zoneDeleteAriaLabel',
    ] as const;

    for (const key of newKeys) {
      expect(translations.en.spotManagement[key]).toBeTruthy();
      expect(translations.th.spotManagement[key]).toBeTruthy();
      expect(translations.th.spotManagement[key]).not.toContain('—');
    }
  });

  it('zoneDeleteSuccessWithCount carries the {N} placeholder verbatim', () => {
    expect(translations.th.spotManagement.zoneDeleteSuccessWithCount).toContain('{N}');
    expect(translations.en.spotManagement.zoneDeleteSuccessWithCount).toContain('{N}');
  });
});
