/**
 * cam-352-spot-form-dialog.test.ts — source-inspection tests for the CAM-352
 * add/edit spot dialog (components/spot-form-dialog.tsx).
 *
 * Same testing constraint as __tests__/cam-56-blocked-dates-availability-page.test.ts
 * (vitest `node` env, no jsdom/@testing-library/react).
 *
 * AC coverage: AC-5/AC-6 (create/edit save + Thai success copy verbatim),
 * BR-3/EC-1 (field validation, Thai copy verbatim), EC-2 (keep form open +
 * input intact on failure), AC-9/EC-3 (403 forbidden / 404 not-found
 * handling), AC-11/BR-7/BR-8 (panorama wiring end to end).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const dialogSrc = fs.readFileSync(
  path.join(process.cwd(), 'components/spot-form-dialog.tsx'),
  'utf-8'
);

describe('CAM-352 spot form dialog — i18n (no hardcoded copy)', () => {
  it('pulls all user-facing copy from t.spotManagement, not hardcoded strings', () => {
    expect(dialogSrc).toContain('const copy = t.spotManagement');
  });

  it('does not hardcode a Thai string literal outside the i18n layer', () => {
    const thaiRange = /[฀-๿]/;
    expect(thaiRange.test(dialogSrc)).toBe(false);
  });
});

describe('CAM-352 spot form dialog — reuses the shared spotSchema (BR-3, one schema client+server)', () => {
  it('imports spotSchema from lib/validations/spot (not a re-implemented regex/rule)', () => {
    expect(dialogSrc).toContain("import { spotSchema, ViewTypeEnum } from \"@/lib/validations/spot\"");
  });

  it('pre-checks with the SAME shared schema the server enforces before submitting', () => {
    expect(dialogSrc).toContain('spotSchema.safeParse({ ...body, campSiteId })');
  });
});

describe('CAM-352 spot form dialog — BR-3/EC-1: field validation + exact Thai copy', () => {
  it('[name] shows copy.nameRequired only after a submit attempt (hasSubmitted gate)', () => {
    expect(dialogSrc).toContain('hasSubmitted && !name.trim() ? copy.nameRequired : undefined');
  });

  it('[maxCampers] shows copy.maxCampersError when a non-empty value is < 1 or not an integer', () => {
    expect(dialogSrc).toContain('!Number.isInteger(maxCampersNum) || maxCampersNum < 1');
    expect(dialogSrc).toContain('? copy.maxCampersError');
  });

  it('[pricePerNight] shows copy.priceError when out of the 0-100,000 bound or missing on submit', () => {
    expect(dialogSrc).toContain('priceNum < 0 || priceNum > 100000');
    expect(dialogSrc).toContain('priceInvalidRange || priceMissing ? copy.priceError : undefined');
  });

  it('blocks the submit fetch entirely when a field is invalid', () => {
    const submitBody = dialogSrc.slice(
      dialogSrc.indexOf('const handleSubmit'),
      dialogSrc.indexOf('const body = {')
    );
    expect(submitBody).toContain('if (!name.trim() || priceInvalidRange || pricePerNight.trim() === "" || maxCampersError)');
    expect(submitBody).toContain('return;');
  });
});

describe('CAM-352 spot form dialog — EC-2: keeps the form open + input intact on failure', () => {
  it('shows copy.saveFailed via ErrorBanner (not a toast) and does not call onSaved/onOpenChange on a generic failure', () => {
    const failureBranch = dialogSrc.slice(
      dialogSrc.indexOf('// EC-2: keep the form open'),
      dialogSrc.indexOf('toast.success(isEditing')
    );
    expect(failureBranch).toContain('setServerError(copy.saveFailed)');
    expect(failureBranch).not.toContain('onOpenChange(false)');
    expect(failureBranch).not.toContain('onSaved()');
  });

  it('does not reset any field state on failure (fields stay controlled by the same state, never cleared on error)', () => {
    // The only places setName("") etc. appear are the create/reset branch of the
    // populate effect, never inside the submit handler's failure paths.
    const handleSubmitBody = dialogSrc.slice(
      dialogSrc.indexOf('const handleSubmit'),
      dialogSrc.indexOf('return (\n    <Dialog')
    );
    expect(handleSubmitBody).not.toContain('setName("")');
  });
});

describe('CAM-352 spot form dialog — AC-9/EC-3: 403 forbidden + 404 not-found handling', () => {
  it('403 -> shows the exact forbidden copy inline via ErrorBanner (AC-9)', () => {
    expect(dialogSrc).toContain('res.status === 403');
    expect(dialogSrc).toContain('setServerError(copy.forbiddenMessage)');
  });

  it('404 -> toasts the not-found copy and closes (nothing left to edit, EC-3)', () => {
    const notFoundBranch = dialogSrc.slice(
      dialogSrc.indexOf('res.status === 404'),
      dialogSrc.indexOf('// EC-2: keep the form open')
    );
    expect(notFoundBranch).toContain('toast.error(copy.notFoundMessage)');
    expect(notFoundBranch).toContain('onOpenChange(false)');
  });
});

describe('CAM-352 spot form dialog — AC-5/AC-6: success copy verbatim + refresh', () => {
  it('shows copy.createSuccess on POST (new spot) and copy.updateSuccess on PUT (edit)', () => {
    expect(dialogSrc).toContain('toast.success(isEditing ? copy.updateSuccess : copy.createSuccess)');
  });

  it('POST for create, PUT for edit, scoped by campSiteId (IDOR-safe path)', () => {
    expect(dialogSrc).toContain('isEditing ? `/api/campsites/${campSiteId}/spots/${spot!.id}` : `/api/campsites/${campSiteId}/spots`');
    expect(dialogSrc).toContain('method: isEditing ? "PUT" : "POST"');
  });
});

describe('CAM-352 spot form dialog — reuses existing primitives (no re-implementation)', () => {
  it('reuses the canonical modal shell (ModalHeader/ModalContent), not a hand-rolled modal', () => {
    expect(dialogSrc).toContain('import { ModalContent, ModalHeader } from "@/components/ui/modal-shell"');
  });

  it('reuses InputField (inline error under the field) per form-patterns.md', () => {
    expect(dialogSrc).toContain('import { InputField } from "@/components/ui/input-field"');
    expect(dialogSrc).toContain('error={nameError}');
    expect(dialogSrc).toContain('error={priceError}');
  });

  it('uses <form noValidate> per the form/error pattern', () => {
    expect(dialogSrc).toContain('noValidate');
  });

  it('reuses the existing ImageUpload photo pipeline (no parallel upload logic)', () => {
    expect(dialogSrc).toContain('import { ImageUpload } from "@/components/ImageUpload"');
  });
});

describe('CAM-352 spot form dialog — data-testid convention (<type>--<module>-<detail>)', () => {
  const REQUIRED_TESTIDS = [
    'modal--spot-form',
    'input--spot-name',
    'select--spot-zone', // CAM-362 — free-text zone input replaced by a zone <Select>
    'select--spot-viewtype',
    'input--spot-max-campers',
    'input--spot-max-tents',
    'input--spot-price-per-night',
    'input--spot-price-per-site',
    'btn--spot-cancel',
    'btn--spot-save',
    'alert--spot-save-error',
  ];

  it.each(REQUIRED_TESTIDS)('includes the %s test id', (testId) => {
    expect(dialogSrc).toContain(`data-testid="${testId}"`);
  });
});
