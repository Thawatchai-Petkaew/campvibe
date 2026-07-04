/**
 * cam-352-image-upload-panorama.test.ts — CAM-352 (host spot-management screen,
 * main slice) — the shared <ImageUpload> panorama-marker contract.
 *
 * Scope: BR-7/BR-8's frontend half (the 360-groundwork migration + write-path
 * union input were already built in the CAM-352 groundwork slice, covered by
 * __tests__/cam-352-image-kind-groundwork.test.ts). This file proves:
 *   1. The additive contract — imageKinds/onKindChange are OPTIONAL props;
 *      the pre-existing value/onChange/onRemove: string[] contract is untouched.
 *   2. Backward-compat — the ONLY other real caller, CampgroundForm.tsx, passes
 *      just value/onChange/onRemove (no imageKinds/onKindChange) and therefore
 *      never renders the panorama toggle/badge — it is unaffected by this change.
 *   3. The panorama toggle + badge only render when the caller opts in.
 *
 * Layer: source-inspection (the repo's vitest config runs `node` env with no
 * jsdom/@testing-library/react — same constraint + precedent documented in
 * __tests__/cam-56-blocked-dates-availability-page.test.ts).
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const imageUploadSrc = src('components/ImageUpload.tsx');
const campgroundFormSrc = src('components/CampgroundForm.tsx');
const spotFormDialogSrc = src('components/spot-form-dialog.tsx');

describe('ImageUpload — additive panorama contract (BR-7/BR-8)', () => {
  it('value/onChange/onRemove keep their string[] shape (unchanged)', () => {
    expect(imageUploadSrc).toContain('value: string[];');
    expect(imageUploadSrc).toContain('onChange: (value: string[]) => void;');
    expect(imageUploadSrc).toContain('onRemove: (value: string) => void;');
  });

  it('imageKinds and onKindChange are declared OPTIONAL (additive, not breaking)', () => {
    expect(imageUploadSrc).toMatch(/imageKinds\?:\s*Record<string,\s*ImageKind>;/);
    expect(imageUploadSrc).toMatch(/onKindChange\?:\s*\(url: string, kind: ImageKind\) => void;/);
  });

  it('the panorama toggle only renders when onKindChange is provided (opt-in, not forced on every caller)', () => {
    expect(imageUploadSrc).toContain('{onKindChange && (');
  });

  it('an unmarked photo defaults to kind PHOTO (EC-9) via imageKinds?.[url] ?? "PHOTO"', () => {
    expect(imageUploadSrc).toContain('imageKinds?.[url] ?? "PHOTO"');
  });

  it('the panorama badge renders only when kind === PANORAMA (AC-11)', () => {
    expect(imageUploadSrc).toContain('{kind === "PANORAMA" && (');
  });

  it('reuses the Badge primitive for the marker (no raw styled <span>, DESIGN.md R6)', () => {
    expect(imageUploadSrc).toContain('import { Badge } from "@/components/ui/badge"');
    expect(imageUploadSrc).toMatch(/<Badge\s+variant="overlay"/);
  });

  it('reuses the Checkbox primitive for the toggle (no hand-rolled boolean control)', () => {
    expect(imageUploadSrc).toContain('import { Checkbox } from "@/components/ui/checkbox"');
  });

  it('the toggle checkbox has an accessible name via aria-label (a11y)', () => {
    expect(imageUploadSrc).toContain('aria-label={t.spotManagement.panoramaToggleLabel}');
  });
});

describe('CampgroundForm.tsx — the pre-existing caller is untouched (backward-compat proof)', () => {
  const callSite = campgroundFormSrc.slice(
    campgroundFormSrc.indexOf('<ImageUpload'),
    campgroundFormSrc.indexOf('/>', campgroundFormSrc.indexOf('<ImageUpload')) + 2
  );

  it('still passes only value/onChange/onRemove — no imageKinds or onKindChange', () => {
    expect(callSite).toContain('value={formData.images}');
    expect(callSite).toContain('onChange=');
    expect(callSite).toContain('onRemove=');
    expect(callSite).not.toContain('imageKinds');
    expect(callSite).not.toContain('onKindChange');
  });

  it('formData.images is still a plain string[] (CampgroundForm was not migrated to {url,kind}[] by this story)', () => {
    // The camp gallery's write-path input contract already accepts the union
    // (lib/validations/campsite.ts, built in the CAM-352 groundwork slice);
    // the UI opt-in to emit per-photo kind is scoped to the spot form in
    // THIS story only.
    expect(campgroundFormSrc).toContain('onChange={urls => setFormData({ ...formData, images: urls })}');
  });
});

describe('spot-form-dialog.tsx — the NEW caller opts in to the panorama mode', () => {
  it('passes imageKinds + onKindChange to ImageUpload', () => {
    expect(spotFormDialogSrc).toContain('imageKinds={imageKinds}');
    expect(spotFormDialogSrc).toContain('onKindChange={handleKindChange}');
  });

  it('builds the {url, kind} payload from the imageKinds map at submit time (BR-8 write-path)', () => {
    expect(spotFormDialogSrc).toContain('images: images.map((url) => ({ url, kind: imageKinds[url] ?? ("PHOTO" as ImageKind) }))');
  });
});
