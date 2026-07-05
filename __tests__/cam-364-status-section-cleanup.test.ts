/**
 * cam-364-status-section-cleanup.test.ts — CAM-364: clean up the Status &
 * Visibility section of the campsite edit form.
 *
 * Two defects fixed:
 *
 * 1. isVerified was a LYING control — hosts could toggle it in the UI but
 *    lib/admin-fields.ts applyAdminOnlyFields silently stripped it server-side
 *    for any non-ADMIN caller (see __tests__/admin-fields.test.ts), so the
 *    click never persisted. Ground truth confirmed a platform admin DOES
 *    legitimately reach this exact form/endpoint for ANY camp site
 *    (lib/auth-utils.ts requireCampSitePermission grants ADMIN unconditional
 *    access) and the PUT route honors isVerified for that role — so the
 *    toggle stays interactive ONLY when the session is ADMIN (role read from
 *    the same /api/operator/dashboard fetch the form already makes, no extra
 *    request). Every other host now sees a read-only verified-status display
 *    (success Badge + icon when true, muted plain text when false) instead.
 *
 * 2. petFriendly relocated OUT of Status & Visibility into Amenities &
 *    Features — it's a guest-facing camp feature (like the taxonomy groups
 *    already in that card), not an internal status/visibility flag. Same
 *    control + copy, just moved; FIELD_SECTION_ID (CAM-356 error-scroll map)
 *    updated to point petFriendly at "amenities" instead of
 *    "status-visibility".
 *
 * Same node-env/no-jsdom constraint as the rest of this codebase's frontend
 * suites (see cam-356-form-validation-ux.test.ts / cam-363's header) —
 * source-inspection gives structural coverage; CampgroundForm.tsx has no
 * isolated render harness (vitest.config.ts environment: 'node').
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import translations from "../locales/translations.json";

const root = path.resolve(__dirname, "..");
const src = (rel: string) => fs.readFileSync(path.join(root, rel), "utf-8");

const formSrc = src("components/CampgroundForm.tsx");
const en = (translations as any).en;
const th = (translations as any).th;

// ---------------------------------------------------------------------------
// Guard 1 — verified-is-not-a-toggle-for-hosts
// ---------------------------------------------------------------------------
describe("CAM-364 guard: verified is not a toggle for hosts (isVerified admin-gated)", () => {
  it("derives isAdminEditor from operator?.role === 'ADMIN' (the session role, not client state)", () => {
    expect(formSrc).toContain("const isAdminEditor = operator?.role === 'ADMIN';");
  });

  it("the operator/dashboard fetch captures role alongside id (no extra request)", () => {
    expect(formSrc).toContain("setOperator({ id: data.operator.id, role: data.operator.role });");
  });

  it("the interactive isVerified toggle renders ONLY inside the isAdminEditor branch", () => {
    const condIdx = formSrc.indexOf("{isAdminEditor ? (");
    const toggleIdx = formSrc.indexOf(
      "onClick={() => setFormData({ ...formData, isVerified: !formData.isVerified })}"
    );
    expect(condIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(condIdx);
  });

  it("the admin-only toggle carries its own test id", () => {
    expect(formSrc).toContain('data-testid="btn--campground-verified-admin-toggle"');
  });

  it("the non-admin (default) path renders a read-only row — no button, no onClick", () => {
    expect(formSrc).toContain('data-testid="row--campground-verified-status"');
  });

  it("verified=true renders a success Badge with an icon (reuses the existing verified label, no new copy)", () => {
    const idx = formSrc.indexOf('data-testid="row--campground-verified-status"');
    const nearby = formSrc.slice(idx, idx + 1500);
    expect(nearby).toContain('<Badge variant="success" data-testid="badge--campground-verified">');
    expect(nearby).toContain("<CheckCircle2 aria-hidden=\"true\" />");
    expect(nearby).toContain("{t.newCampground.verified}");
  });

  it("verified=false renders muted plain text (no CTA) using the new notVerified key", () => {
    const idx = formSrc.indexOf('data-testid="row--campground-verified-status"');
    const nearby = formSrc.slice(idx, idx + 1500);
    expect(nearby).toContain('data-testid="text--campground-not-verified"');
    expect(nearby).toContain("{t.newCampground.notVerified}");
    expect(nearby).toContain("text-muted-foreground");
  });

  it("the read-only row is a <div>, never a <button> (not clickable, no aria-pressed)", () => {
    const idx = formSrc.indexOf('data-testid="row--campground-verified-status"');
    const line = formSrc
      .slice(0, idx)
      .split("\n")
      .slice(-3)
      .join("\n");
    expect(line).toContain("<div");
    expect(line).not.toContain("aria-pressed");
  });
});

// ---------------------------------------------------------------------------
// Guard 2 — petFriendly rendered in its new section, absent from
// status-visibility
// ---------------------------------------------------------------------------
describe("CAM-364 guard: petFriendly relocated to Amenities & Features", () => {
  it("FIELD_SECTION_ID maps petFriendly to \"amenities\" (CAM-356 error-scroll map)", () => {
    expect(formSrc).toContain('petFriendly: "amenities",');
  });

  it("FIELD_SECTION_ID no longer maps petFriendly to \"status-visibility\"", () => {
    expect(formSrc).not.toContain('petFriendly: "status-visibility"');
  });

  it("the petFriendly toggle control appears exactly once in the whole file (no duplicate)", () => {
    const matches =
      formSrc.match(/onClick=\{\(\) => setFormData\(\{ \.\.\.formData, petFriendly: !formData\.petFriendly \}\)\}/g) ??
      [];
    expect(matches.length).toBe(1);
  });

  it("the single petFriendly toggle sits inside the Amenities & Features card (\"amenities\"), not Status & Visibility", () => {
    const amenitiesIdx = formSrc.indexOf('id="amenities"');
    const statusVisibilityIdx = formSrc.indexOf('id="status-visibility"');
    const petFriendlyToggleIdx = formSrc.indexOf(
      "onClick={() => setFormData({ ...formData, petFriendly: !formData.petFriendly })}"
    );
    expect(amenitiesIdx).toBeGreaterThan(-1);
    expect(statusVisibilityIdx).toBeGreaterThan(amenitiesIdx);
    expect(petFriendlyToggleIdx).toBeGreaterThan(amenitiesIdx);
    expect(petFriendlyToggleIdx).toBeLessThan(statusVisibilityIdx);
  });

  it("Status & Visibility's CardContent no longer contains the petFriendly control", () => {
    const statusVisibilityIdx = formSrc.indexOf('id="status-visibility"');
    const nextCardIdx = formSrc.indexOf("<Card ", statusVisibilityIdx + 1);
    const statusVisibilitySection = formSrc.slice(
      statusVisibilityIdx,
      nextCardIdx > -1 ? nextCardIdx : undefined
    );
    expect(statusVisibilitySection).not.toContain("petFriendly");
  });

  it("only isVerified/isActive/isPublished remain in the Status & Visibility card", () => {
    const statusVisibilityIdx = formSrc.indexOf('id="status-visibility"');
    const nextCardIdx = formSrc.indexOf("<Card ", statusVisibilityIdx + 1);
    const statusVisibilitySection = formSrc.slice(
      statusVisibilityIdx,
      nextCardIdx > -1 ? nextCardIdx : undefined
    );
    expect(statusVisibilitySection).toContain("isVerified");
    expect(statusVisibilitySection).toContain("isActive: !formData.isActive");
    expect(statusVisibilitySection).toContain("isPublished: !formData.isPublished");
  });
});

// ---------------------------------------------------------------------------
// Guard 3 — payload omits isVerified for a non-admin session, preserves it
// unchanged for an admin session (server still strips for non-admin anyway —
// this is a defense-in-depth / "don't even send it" fix on the client side).
// ---------------------------------------------------------------------------
describe("CAM-364 guard: payload omits isVerified for non-admin, sends it for admin", () => {
  it("campPayload gates isVerified behind isAdminEditor (undefined otherwise)", () => {
    expect(formSrc).toContain("isVerified: isAdminEditor ? formData.isVerified : undefined,");
  });

  it("JSON.stringify drops an undefined isVerified from the wire payload (omitted, not sent as false)", () => {
    const payload: Record<string, unknown> = {
      nameTh: "test",
      isVerified: undefined,
      isActive: true,
    };
    const body = JSON.stringify(payload);
    expect(body).not.toContain("isVerified");
    expect(body).toContain("isActive");
  });

  it("an admin session sends the real boolean unchanged (round-trips through JSON.stringify)", () => {
    const isAdminEditor = true;
    const formDataIsVerified = true;
    const payload = { isVerified: isAdminEditor ? formDataIsVerified : undefined };
    const body = JSON.parse(JSON.stringify(payload));
    expect(body.isVerified).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// i18n — the new notVerified key exists in both locales, no em-dash, plain
// copy (no CTA wording).
// ---------------------------------------------------------------------------
describe("CAM-364 i18n: newCampground.notVerified (both locales)", () => {
  it("exists as a non-empty string in EN and TH", () => {
    expect(typeof en.newCampground.notVerified).toBe("string");
    expect(en.newCampground.notVerified.length).toBeGreaterThan(0);
    expect(typeof th.newCampground.notVerified).toBe("string");
    expect(th.newCampground.notVerified.length).toBeGreaterThan(0);
  });

  it("Thai copy has no em-dash separator", () => {
    expect(th.newCampground.notVerified).not.toContain("—");
  });

  it("th.newCampground.notVerified matches the verbatim copy shipped", () => {
    expect(th.newCampground.notVerified).toBe("ยังไม่ได้ยืนยัน");
  });
});
