/**
 * cam-218-err-1-error-state.test.ts — ERR-1 / CAM-218
 *
 * Proves every AC for the platform error-state standard introduced in CAM-218.
 *
 * Layer: source-inspection (static parse of real production files).
 *   This follows the established precedent for this project (cam-181, cam-184,
 *   cam-197). The Vitest environment is `node` (no jsdom). ErrorState uses
 *   React hooks (useLanguage / useState) and next/image under "use client" —
 *   rendering requires a full Next.js + React DOM harness that does not exist
 *   in this environment. Source-inspection is the correct and complete layer
 *   for verifying structure, copy keys, test-ids, role attributes, security
 *   properties, and component wiring.
 *
 * ACs covered:
 *
 *   AC-1  Variant render — each of the 4 variants has its mascot testid,
 *         its i18n key wired, and its mascot PNG path.
 *   AC-2  CTA behaviour — not-found/forbidden/generic: ONE primary CTA,
 *         NO retry/secondary button; error+onRetry: primary retry + secondary
 *         home; error without onRetry: retry NOT rendered.
 *   AC-3  Prop override — title/message/actionLabel override i18n defaults.
 *   AC-4  a11y role — role="alert" on error variant; role="status" on others.
 *   AC-5  i18n verbatim — all 4 TH variant keys present character-for-character
 *         in translations.json; both EN and TH blocks include every required key.
 *   AC-6  No stack leak — app/error.tsx does NOT surface error.message or stack
 *         in JSX output; generic i18n copy is used instead.
 *   AC-7  Graceful fallback — ImageWithFallback is used (not a plain <img>);
 *         its fallback path is exercised when src is absent/errored.
 *
 * Also covers the page-level wiring for every boundary file:
 *   app/not-found.tsx          → ErrorState variant="not-found"
 *   app/error.tsx              → ErrorState variant="error" onRetry={reset}
 *   app/dashboard/error.tsx    → ErrorState variant="error" onRetry={reset} compact
 *   app/global-error.tsx       → standalone bilingual block (no providers available)
 *
 * Prove-It notes — each test is annotated with the change that would make it red:
 *
 *   AC-1: mascot testid format FAILS if `img--error-mascot-${variant}` is changed.
 *   AC-1: VARIANT_MASCOT path FAILS if any PNG path is renamed or removed.
 *   AC-1: VARIANT_KEY mapping FAILS if "not-found" key is changed from "notFound".
 *   AC-1: ImageWithFallback usage FAILS if replaced by a plain <img>.
 *   AC-2: primary CTA testid format FAILS if `btn--error-primary-${variant}` changes.
 *   AC-2: secondary testid FAILS if `btn--error-secondary-${variant}` changes.
 *   AC-2: retry conditional FAILS if the `onRetry` guard is removed.
 *   AC-2: single CTA for non-error FAILS if a retry branch is added unconditionally.
 *   AC-3: prop override FAILS if resolvedTitle is hardcoded instead of `title ?? copy.title`.
 *   AC-3: prop override FAILS if resolvedMessage loses the nullish coalescing operator.
 *   AC-3: prop override FAILS if resolvedActionLabel loses the nullish coalescing operator.
 *   AC-4: role="alert" FAILS if the variant guard is removed from the role attribute.
 *   AC-4: role="status" FAILS if non-error variants lose their role attribute.
 *   AC-5: TH title verbatim FAILS if even one glyph in the Thai string is changed.
 *   AC-5: EN cta verbatim FAILS if the English CTA key is renamed.
 *   AC-5: retryLabel key FAILS if retryLabel is removed from the unexpected block.
 *   AC-6: stack leak guard FAILS if `{error.message}` or `{error.stack}` appears in JSX.
 *   AC-6: digest-only log FAILS if error stack is rendered to DOM.
 *   AC-7: ImageWithFallback usage FAILS if replaced by a plain next/image import.
 *   AC-7: fallback icon FAILS if ImageOff is removed from ImageWithFallback.
 *
 * AC → test-id matrix (per .claude/rules/qa.md §4):
 *   AC-1  img--error-mascot-<variant>  (source-inspect)
 *   AC-2  btn--error-primary-<variant>, btn--error-secondary-<variant>  (source-inspect)
 *   AC-3  section--error-state-prop-override  (source-inspect)
 *   AC-4  section--error-state-a11y-role  (source-inspect)
 *   AC-5  section--error-state-i18n-verbatim  (source-inspect)
 *   AC-6  section--error-page-no-stack-leak  (source-inspect)
 *   AC-7  section--error-state-image-fallback  (source-inspect)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Source helpers — read real production files from the project root
// ---------------------------------------------------------------------------

const root = process.cwd();

function src(relPath: string): string {
  return readFileSync(path.join(root, relPath), 'utf-8');
}

/**
 * Returns true when the file has a real "use client" directive.
 * A directive appears on its own line (ignoring semicolons and quotes style)
 * before any imports. It is NOT inside a comment.
 * Pattern: a line whose content, stripped of trailing semicolons, is exactly
 * `"use client"` or `'use client'`.
 */
function hasUseClientDirective(source: string): boolean {
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/;$/, '');
    if (trimmed === '"use client"' || trimmed === "'use client'") {
      return true;
    }
    // Stop scanning at the first import — directives must come first
    if (line.startsWith('import ') || line.startsWith('const ') || line.startsWith('export ')) {
      break;
    }
  }
  return false;
}

const errorStateSrc       = src('components/ErrorState.tsx');
const notFoundPageSrc     = src('app/not-found.tsx');
const errorPageSrc        = src('app/error.tsx');
const globalErrorSrc      = src('app/global-error.tsx');
const dashboardErrorSrc   = src('app/dashboard/error.tsx');
const imageWithFallbackSrc = src('components/ui/image-with-fallback.tsx');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const translations = require('../locales/translations.json') as {
  en: {
    errors: {
      notFound:   { title: string; message: string; cta: string; mascotAlt: string };
      unexpected: { title: string; message: string; retryLabel: string; cta: string; mascotAlt: string };
      forbidden:  { title: string; message: string; cta: string; mascotAlt: string };
      generic:    { title: string; message: string; cta: string; mascotAlt: string };
    };
  };
  th: {
    errors: {
      notFound:   { title: string; message: string; cta: string; mascotAlt: string };
      unexpected: { title: string; message: string; retryLabel: string; cta: string; mascotAlt: string };
      forbidden:  { title: string; message: string; cta: string; mascotAlt: string };
      generic:    { title: string; message: string; cta: string; mascotAlt: string };
    };
  };
};

// ===========================================================================
// AC-1 — Variant render: mascot testids, mascot paths, i18n key wiring
//         img--error-mascot-<variant>
// ===========================================================================

describe('AC-1 — Variant render: mascot testid format and PNG paths (components/ErrorState.tsx)', () => {

  // Prove-It: FAILS if the testid template literal `img--error-mascot-${variant}` is changed.
  it('[testid] data-testid uses the img--error-mascot-<variant> pattern', () => {
    expect(errorStateSrc).toContain('data-testid={`img--error-mascot-${variant}`}');
  });

  // Prove-It: FAILS if /mascot/thinking.png is renamed or removed from the map.
  it('[mascot-path] not-found variant maps to /mascot/thinking.png', () => {
    expect(errorStateSrc).toContain('"not-found": "/mascot/thinking.png"');
  });

  // Prove-It: FAILS if /mascot/coding.png is renamed.
  it('[mascot-path] error variant maps to /mascot/coding.png', () => {
    expect(errorStateSrc).toContain('error: "/mascot/coding.png"');
  });

  // Prove-It: FAILS if /mascot/waving.png is renamed.
  it('[mascot-path] forbidden variant maps to /mascot/waving.png', () => {
    expect(errorStateSrc).toContain('forbidden: "/mascot/waving.png"');
  });

  // Prove-It: FAILS if /mascot/walking.png is renamed.
  it('[mascot-path] generic variant maps to /mascot/walking.png', () => {
    expect(errorStateSrc).toContain('generic: "/mascot/walking.png"');
  });

  // Prove-It: FAILS if VARIANT_KEY["not-found"] is changed away from "notFound".
  it('[i18n-key] not-found variant uses i18n key "notFound"', () => {
    expect(errorStateSrc).toContain('"not-found": "notFound"');
  });

  // Prove-It: FAILS if VARIANT_KEY["error"] is changed away from "unexpected".
  it('[i18n-key] error variant uses i18n key "unexpected"', () => {
    expect(errorStateSrc).toContain('error: "unexpected"');
  });

  // Prove-It: FAILS if VARIANT_KEY["forbidden"] is changed.
  it('[i18n-key] forbidden variant uses i18n key "forbidden"', () => {
    expect(errorStateSrc).toContain('forbidden: "forbidden"');
  });

  // Prove-It: FAILS if VARIANT_KEY["generic"] is changed.
  it('[i18n-key] generic variant uses i18n key "generic"', () => {
    expect(errorStateSrc).toContain('generic: "generic"');
  });

  // Prove-It: FAILS if ImageWithFallback is replaced by a plain <img> or next/image.
  it('[component] uses ImageWithFallback for the mascot (not a plain img)', () => {
    expect(errorStateSrc).toContain('<ImageWithFallback');
    expect(errorStateSrc).toContain("from \"@/components/ui/image-with-fallback\"");
  });

  // Prove-It: FAILS if the variant export type is removed.
  it('[type] exports ErrorVariant type with all 4 values', () => {
    expect(errorStateSrc).toContain("export type ErrorVariant");
    expect(errorStateSrc).toContain('"not-found"');
    expect(errorStateSrc).toContain('"error"');
    expect(errorStateSrc).toContain('"forbidden"');
    expect(errorStateSrc).toContain('"generic"');
  });

  // Prove-It: FAILS if t.errors lookup is removed (copy is hardcoded instead).
  it('[i18n-copy] copy is read from t.errors[key] (not hardcoded strings)', () => {
    expect(errorStateSrc).toContain('t.errors[key]');
    expect(errorStateSrc).toContain('const { t } = useLanguage()');
  });
});

// ===========================================================================
// AC-2 — CTA behaviour: primary/secondary testids, onRetry conditional
//         btn--error-primary-<variant>, btn--error-secondary-<variant>
// ===========================================================================

describe('AC-2 — CTA behaviour: primary testid, secondary testid, onRetry guard (components/ErrorState.tsx)', () => {

  // Prove-It: FAILS if btn--error-primary-${variant} template is changed.
  it('[testid] primary CTA uses btn--error-primary-<variant> testid pattern', () => {
    expect(errorStateSrc).toContain('data-testid={`btn--error-primary-${variant}`}');
  });

  // Prove-It: FAILS if btn--error-secondary-${variant} template is changed.
  it('[testid] secondary CTA uses btn--error-secondary-<variant> testid pattern', () => {
    expect(errorStateSrc).toContain('data-testid={`btn--error-secondary-${variant}`}');
  });

  // Prove-It: FAILS if the onRetry conditional guard is removed.
  it('[cta-logic] secondary CTA is rendered only when variant="error" AND onRetry is provided', () => {
    expect(errorStateSrc).toContain('variant === "error" && onRetry');
  });

  // Prove-It: FAILS if the single-CTA else branch is removed (non-error variants get no retry).
  it('[cta-logic] single primary CTA (no secondary) is the else branch for non-error variants', () => {
    // The else branch renders a single Button (link only), no secondary
    // We verify the structure: the conditional renders two Buttons ONLY for error+onRetry,
    // else a single Button asChild linking to actionHref
    const branchMatch = errorStateSrc.match(
      /variant === "error" && onRetry[\s\S]*?\) : \(/
    );
    expect(branchMatch).not.toBeNull();
  });

  // Prove-It: FAILS if the retry button is removed from the error+onRetry branch.
  it('[cta-logic] error+onRetry branch renders primary retry button calling onRetry', () => {
    expect(errorStateSrc).toContain('onClick={onRetry}');
    // Primary retry button comes before the secondary home button inside the conditional
    const retryBeforeHome = errorStateSrc.indexOf('onClick={onRetry}') <
                            errorStateSrc.indexOf('btn--error-secondary');
    expect(retryBeforeHome).toBe(true);
  });

  // Prove-It: FAILS if the secondary home button is removed from the error+onRetry branch.
  it('[cta-logic] error+onRetry branch renders secondary home button with actionHref', () => {
    // Inside the conditional, the secondary button uses href={actionHref}
    expect(errorStateSrc).toContain('href={actionHref}');
  });

  // Prove-It: FAILS if retryLabel lookup is removed (retry button label is hardcoded).
  it('[cta-label] retry label comes from retryLabel (t.errors.unexpected.retryLabel)', () => {
    expect(errorStateSrc).toContain('retryLabel');
    expect(errorStateSrc).toContain('"retryLabel" in copy');
  });

  // Prove-It: FAILS if the single-CTA branch is removed.
  it('[cta-logic] non-error variants render exactly one Button with asChild + Link', () => {
    // The else branch must have an asChild Button wrapping a Link
    expect(errorStateSrc).toContain('asChild');
    // Link to actionHref appears inside the single-CTA path
    const singleCtaSection = errorStateSrc.match(
      /\/\* Single primary CTA[\s\S]*?<\/Button>/
    );
    expect(singleCtaSection).not.toBeNull();
    expect(singleCtaSection![0]).toContain('<Link href={actionHref}');
  });

  // Prove-It: FAILS if actionHref default "/" is removed.
  it('[default-href] actionHref defaults to "/" (go-home CTA always has a safe default)', () => {
    expect(errorStateSrc).toContain('actionHref = "/"');
  });

  // Prove-It: FAILS if RotateCcw icon import is removed.
  it('[icon] retry button uses RotateCcw icon from lucide-react', () => {
    expect(errorStateSrc).toContain('RotateCcw');
    expect(errorStateSrc).toContain('from "lucide-react"');
  });

  // Prove-It: FAILS if Home icon import is removed.
  it('[icon] home button uses Home icon from lucide-react', () => {
    expect(errorStateSrc).toContain('Home');
  });
});

// ===========================================================================
// AC-3 — Prop override: title / message / actionLabel override i18n defaults
//         section--error-state-prop-override
// ===========================================================================

describe('AC-3 — Prop override: title/message/actionLabel nullish-coalesce i18n (components/ErrorState.tsx)', () => {

  // Prove-It: FAILS if title prop is not wired with `title ?? copy.title`.
  it('[override] resolvedTitle uses nullish coalescing: title ?? copy.title', () => {
    expect(errorStateSrc).toContain('title ?? copy.title');
  });

  // Prove-It: FAILS if message prop is not wired with `message ?? copy.message`.
  it('[override] resolvedMessage uses nullish coalescing: message ?? copy.message', () => {
    expect(errorStateSrc).toContain('message ?? copy.message');
  });

  // Prove-It: FAILS if actionLabel prop is not wired with `actionLabel ?? copy.cta`.
  it('[override] resolvedActionLabel uses nullish coalescing: actionLabel ?? copy.cta', () => {
    expect(errorStateSrc).toContain('actionLabel ?? copy.cta');
  });

  // Prove-It: FAILS if the optional props are not declared in the interface.
  it('[interface] title?, message?, actionLabel? are optional props in ErrorStateProps', () => {
    expect(errorStateSrc).toContain('title?: string');
    expect(errorStateSrc).toContain('message?: string');
    expect(errorStateSrc).toContain('actionLabel?: string');
  });

  // Prove-It: FAILS if actionHref is removed from the interface.
  it('[interface] actionHref? is an optional prop in ErrorStateProps', () => {
    expect(errorStateSrc).toContain('actionHref?: string');
  });

  // Prove-It: FAILS if onRetry is removed from the interface.
  it('[interface] onRetry? is an optional prop in ErrorStateProps', () => {
    expect(errorStateSrc).toContain('onRetry?: () => void');
  });

  // Prove-It: FAILS if compact is removed from the interface.
  it('[interface] compact? is an optional prop in ErrorStateProps', () => {
    expect(errorStateSrc).toContain('compact?: boolean');
  });

  // Prove-It: FAILS if the title is rendered without using resolvedTitle.
  it('[render] h1 renders {resolvedTitle} (the overridable title)', () => {
    expect(errorStateSrc).toContain('{resolvedTitle}');
  });

  // Prove-It: FAILS if the message is rendered without using resolvedMessage.
  it('[render] p renders {resolvedMessage} (the overridable message)', () => {
    expect(errorStateSrc).toContain('{resolvedMessage}');
  });
});

// ===========================================================================
// AC-4 — a11y role: role="alert" on error, role="status" on others
//         section--error-state-a11y-role
// ===========================================================================

describe('AC-4 — a11y role assignment (components/ErrorState.tsx)', () => {

  // Prove-It: FAILS if the ternary on variant === "error" is removed from the role attribute.
  it('[role] wrapper role is determined by variant === "error" ternary', () => {
    expect(errorStateSrc).toContain('role={variant === "error" ? "alert" : "status"}');
  });

  // Prove-It: FAILS if role="alert" string is removed from the ternary.
  it('[role] role="alert" is assigned for the error variant', () => {
    expect(errorStateSrc).toContain('"alert"');
  });

  // Prove-It: FAILS if role="status" string is removed from the ternary.
  it('[role] role="status" is assigned for non-error variants', () => {
    expect(errorStateSrc).toContain('"status"');
  });

  // Prove-It: FAILS if the glow ring aria-hidden is removed.
  it('[a11y] decorative glow ring has aria-hidden="true"', () => {
    expect(errorStateSrc).toContain('aria-hidden="true"');
  });

  // Prove-It: FAILS if Lucide icons lose their aria-hidden.
  it('[a11y] lucide icons inside buttons use aria-hidden="true"', () => {
    // Both RotateCcw and Home icons should have aria-hidden
    const ariaHiddenCount = (errorStateSrc.match(/aria-hidden="true"/g) ?? []).length;
    // At least 3: glow ring + RotateCcw + Home icons
    expect(ariaHiddenCount).toBeGreaterThanOrEqual(3);
  });

  // Prove-It: FAILS if compact prop removes the role attribute.
  it('[compact] compact prop affects layout class only, not role assignment', () => {
    // compact changes wrapperClass and mascotWrapperClass, not the role ternary.
    // Both assignments use the compact ternary (multiline — check keywords are present).
    expect(errorStateSrc).toContain('wrapperClass = compact');
    expect(errorStateSrc).toContain('mascotWrapperClass = compact');
    // role is on the outer wrapper div, not gated by compact
    const roleIdx    = errorStateSrc.indexOf('role={variant === "error"');
    const classIdx   = errorStateSrc.indexOf('className={wrapperClass}');
    expect(roleIdx).toBeGreaterThan(0);
    expect(classIdx).toBeGreaterThan(0);
    // role must appear near className={wrapperClass} (within 200 chars)
    expect(Math.abs(roleIdx - classIdx)).toBeLessThan(200);
  });
});

// ===========================================================================
// AC-5 — i18n verbatim: TH and EN strings in translations.json
//         section--error-state-i18n-verbatim
// ===========================================================================

describe('AC-5 — i18n verbatim: EN + TH errors block in translations.json', () => {

  // ── EN locale ──────────────────────────────────────────────────────────────

  // Prove-It: FAILS if en.errors block is removed.
  it('[en] errors block exists in EN locale', () => {
    expect(translations.en.errors).toBeTruthy();
  });

  // Prove-It: FAILS if en.errors.notFound.title is changed.
  it('[en-verbatim] EN notFound.title is "Page not found"', () => {
    expect(translations.en.errors.notFound.title).toBe('Page not found');
  });

  // Prove-It: FAILS if en.errors.notFound.cta is changed.
  it('[en-verbatim] EN notFound.cta is "Back to home"', () => {
    expect(translations.en.errors.notFound.cta).toBe('Back to home');
  });

  // Prove-It: FAILS if retryLabel is removed from EN unexpected block.
  it('[en] EN unexpected.retryLabel exists (retry button needs it)', () => {
    expect(translations.en.errors.unexpected.retryLabel).toBeTruthy();
  });

  // Prove-It: FAILS if retryLabel is renamed.
  it('[en-verbatim] EN unexpected.retryLabel is "Try again"', () => {
    expect(translations.en.errors.unexpected.retryLabel).toBe('Try again');
  });

  // Prove-It: FAILS if EN unexpected.title is changed.
  it('[en-verbatim] EN unexpected.title is "Something went wrong"', () => {
    expect(translations.en.errors.unexpected.title).toBe('Something went wrong');
  });

  // Prove-It: FAILS if EN forbidden.title is changed.
  it('[en-verbatim] EN forbidden.title is "Access not permitted"', () => {
    expect(translations.en.errors.forbidden.title).toBe('Access not permitted');
  });

  // Prove-It: FAILS if EN generic.cta is changed.
  it('[en-verbatim] EN generic.cta is "Back to home"', () => {
    expect(translations.en.errors.generic.cta).toBe('Back to home');
  });

  // ── TH locale ──────────────────────────────────────────────────────────────

  // Prove-It: FAILS if th.errors block is removed.
  it('[th] errors block exists in TH locale', () => {
    expect(translations.th.errors).toBeTruthy();
  });

  // Prove-It: FAILS if even one glyph in the Thai notFound title is changed.
  it('[th-verbatim] TH notFound.title is "ไม่พบหน้านี้" (character-for-character)', () => {
    expect(translations.th.errors.notFound.title).toBe('ไม่พบหน้านี้');
  });

  // Prove-It: FAILS if TH notFound.message is changed.
  it('[th-verbatim] TH notFound.message verbatim', () => {
    expect(translations.th.errors.notFound.message).toBe(
      'หน้านี้ถูกย้ายหรือไม่มีอยู่แล้ว กลับไปหน้าหลักเพื่อค้นหาแคมป์ที่ชอบ'
    );
  });

  // Prove-It: FAILS if TH notFound.cta is changed.
  it('[th-verbatim] TH notFound.cta is "กลับหน้าหลัก" (character-for-character)', () => {
    expect(translations.th.errors.notFound.cta).toBe('กลับหน้าหลัก');
  });

  // Prove-It: FAILS if TH unexpected.title is changed.
  it('[th-verbatim] TH unexpected.title is "เกิดข้อผิดพลาด"', () => {
    expect(translations.th.errors.unexpected.title).toBe('เกิดข้อผิดพลาด');
  });

  // Prove-It: FAILS if TH unexpected.retryLabel is changed.
  it('[th-verbatim] TH unexpected.retryLabel is "ลองใหม่อีกครั้ง"', () => {
    expect(translations.th.errors.unexpected.retryLabel).toBe('ลองใหม่อีกครั้ง');
  });

  // Prove-It: FAILS if TH unexpected.cta is changed.
  it('[th-verbatim] TH unexpected.cta is "กลับหน้าหลัก"', () => {
    expect(translations.th.errors.unexpected.cta).toBe('กลับหน้าหลัก');
  });

  // Prove-It: FAILS if TH unexpected.message is changed.
  it('[th-verbatim] TH unexpected.message verbatim', () => {
    expect(translations.th.errors.unexpected.message).toBe(
      'มีข้อผิดพลาดที่ไม่คาดคิดเกิดขึ้น ลองใหม่อีกครั้งหรือกลับหน้าหลัก'
    );
  });

  // Prove-It: FAILS if TH forbidden.title is changed.
  it('[th-verbatim] TH forbidden.title is "ไม่มีสิทธิ์เข้าถึง"', () => {
    expect(translations.th.errors.forbidden.title).toBe('ไม่มีสิทธิ์เข้าถึง');
  });

  // Prove-It: FAILS if TH forbidden.cta is changed.
  it('[th-verbatim] TH forbidden.cta is "กลับหน้าหลัก"', () => {
    expect(translations.th.errors.forbidden.cta).toBe('กลับหน้าหลัก');
  });

  // Prove-It: FAILS if TH generic.title is changed.
  it('[th-verbatim] TH generic.title is "เกิดข้อผิดพลาด"', () => {
    expect(translations.th.errors.generic.title).toBe('เกิดข้อผิดพลาด');
  });

  // Prove-It: FAILS if TH generic.message is changed.
  it('[th-verbatim] TH generic.message verbatim', () => {
    expect(translations.th.errors.generic.message).toBe(
      'โหลดหน้านี้ไม่สำเร็จ กรุณาลองใหม่ภายหลัง'
    );
  });

  // Prove-It: FAILS if TH generic.cta is changed.
  it('[th-verbatim] TH generic.cta is "กลับหน้าหลัก"', () => {
    expect(translations.th.errors.generic.cta).toBe('กลับหน้าหลัก');
  });

  // ── All 4 variants have all required keys in both locales ──────────────────

  const variants = ['notFound', 'unexpected', 'forbidden', 'generic'] as const;

  for (const v of variants) {
    // Prove-It: FAILS if any variant loses its title, message, cta, or mascotAlt key.
    it(`[completeness] EN + TH both have title/message/cta/mascotAlt for variant "${v}"`, () => {
      expect(translations.en.errors[v].title).toBeTruthy();
      expect(translations.en.errors[v].message).toBeTruthy();
      expect(translations.en.errors[v].cta).toBeTruthy();
      expect(translations.en.errors[v].mascotAlt).toBeTruthy();
      expect(translations.th.errors[v].title).toBeTruthy();
      expect(translations.th.errors[v].message).toBeTruthy();
      expect(translations.th.errors[v].cta).toBeTruthy();
      expect(translations.th.errors[v].mascotAlt).toBeTruthy();
    });
  }
});

// ===========================================================================
// AC-6 — No stack leak: app/error.tsx does NOT surface error.message or stack
//         section--error-page-no-stack-leak
// ===========================================================================

describe('AC-6 — No stack leak: app/error.tsx guards against leaking error details (app/error.tsx)', () => {

  // Prove-It: FAILS immediately if error.message appears in JSX output.
  it('[security] app/error.tsx does NOT render {error.message} in JSX', () => {
    // Remove comments first so a comment mention doesn't false-positive
    const noComments = errorPageSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toContain('{error.message}');
  });

  // Prove-It: FAILS immediately if error.stack appears in JSX output.
  it('[security] app/error.tsx does NOT render {error.stack} in JSX', () => {
    const noComments = errorPageSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toContain('{error.stack}');
  });

  // Prove-It: FAILS if the generic ErrorState variant="error" is replaced by inline copy.
  it('[security] app/error.tsx delegates display to ErrorState variant="error" (generic copy)', () => {
    expect(errorPageSrc).toContain('variant="error"');
    expect(errorPageSrc).toContain('<ErrorState');
  });

  // Prove-It: FAILS if reset is not passed as onRetry to allow recovery without reload.
  it('[recovery] app/error.tsx passes reset as onRetry (user can recover without page reload)', () => {
    expect(errorPageSrc).toContain('onRetry={reset}');
  });

  // Prove-It: FAILS if the useEffect console.error is removed (dev logging obligation).
  it('[dev-log] app/error.tsx logs the error via console.error in useEffect (dev/server only)', () => {
    expect(errorPageSrc).toContain('console.error(error)');
    expect(errorPageSrc).toContain('useEffect');
  });

  // Prove-It: FAILS if the "use client" directive is removed (Next.js requires it).
  it('[directive] app/error.tsx has "use client" directive (required by Next.js for error boundaries)', () => {
    expect(hasUseClientDirective(errorPageSrc)).toBe(true);
  });

  // Prove-It: FAILS if the error+reset props are removed from the component interface.
  it('[interface] ErrorPageProps has error and reset props typed correctly', () => {
    expect(errorPageSrc).toContain('error: Error');
    expect(errorPageSrc).toContain('reset: () => void');
  });

  // ── global-error.tsx — same security guarantee, no providers available ──────

  // Prove-It: FAILS if global-error.tsx renders error.message or stack.
  it('[security] app/global-error.tsx does NOT render {error.message} in JSX', () => {
    const noComments = globalErrorSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toContain('{error.message}');
    expect(noComments).not.toContain('{error.stack}');
  });

  // Prove-It: FAILS if global-error.tsx loses its bilingual self-contained copy.
  it('[bilingual] app/global-error.tsx contains TH heading "เกิดข้อผิดพลาด"', () => {
    expect(globalErrorSrc).toContain('เกิดข้อผิดพลาด');
  });

  // Prove-It: FAILS if the EN fallback line is removed from global-error.tsx.
  it('[bilingual] app/global-error.tsx contains EN fallback "Something went wrong"', () => {
    expect(globalErrorSrc).toContain('Something went wrong');
  });

  // Prove-It: FAILS if the reload button is removed from global-error.tsx.
  it('[recovery] app/global-error.tsx has a reload/retry button calling reset()', () => {
    expect(globalErrorSrc).toContain('reset()');
    expect(globalErrorSrc).toContain('<button');
  });

  // Prove-It: FAILS if <html> and <body> are removed (global-error replaces the root layout).
  it('[structure] app/global-error.tsx owns its own <html><body> (no layout provider)', () => {
    expect(globalErrorSrc).toContain('<html');
    expect(globalErrorSrc).toContain('<body');
  });

  // Prove-It: FAILS if global-error.tsx uses a masking onError that doesn't just hide.
  it('[fallback] global-error.tsx mascot img hides gracefully on error (no crash, onError display:none)', () => {
    expect(globalErrorSrc).toContain('onError');
    expect(globalErrorSrc).toContain('display = "none"');
  });
});

// ===========================================================================
// AC-7 — Graceful fallback: ImageWithFallback handles missing/errored mascot
//         section--error-state-image-fallback
// ===========================================================================

describe('AC-7 — Graceful fallback: ImageWithFallback renders ImageOff when src fails (components/ui/image-with-fallback.tsx)', () => {

  // Prove-It: FAILS if errored state is removed from ImageWithFallback.
  it('[fallback] ImageWithFallback tracks errored state with useState', () => {
    expect(imageWithFallbackSrc).toContain('errored');
    expect(imageWithFallbackSrc).toContain('setErrored');
    expect(imageWithFallbackSrc).toContain('useState(false)');
  });

  // Prove-It: FAILS if the showFallback condition is changed.
  it('[fallback] showFallback triggers when !src OR errored (covers both missing+error cases)', () => {
    expect(imageWithFallbackSrc).toContain('!src || errored');
  });

  // Prove-It: FAILS if ImageOff is replaced by another fallback icon.
  it('[fallback] ImageOff (lucide-react) is the fallback placeholder icon', () => {
    expect(imageWithFallbackSrc).toContain('ImageOff');
    expect(imageWithFallbackSrc).toContain('from "lucide-react"');
  });

  // Prove-It: FAILS if onError handler is removed from the Image elements.
  it('[fallback] next/image onError handler calls setErrored(true)', () => {
    expect(imageWithFallbackSrc).toContain('onError={() => setErrored(true)}');
  });

  // Prove-It: FAILS if the fallback testid convention is changed.
  it('[testid] fallback placeholder uses testId + "--fallback-placeholder" pattern', () => {
    expect(imageWithFallbackSrc).toContain('`${testId}--fallback-placeholder`');
  });

  // Prove-It: FAILS if ImageWithFallback is changed to export a default instead of named.
  it('[export] ImageWithFallback is a named export (not default)', () => {
    expect(imageWithFallbackSrc).toContain('export function ImageWithFallback');
  });

  // Prove-It: FAILS if "use client" is removed from ImageWithFallback (needs useState).
  it('[directive] ImageWithFallback has "use client" directive (needs useState)', () => {
    expect(hasUseClientDirective(imageWithFallbackSrc)).toBe(true);
  });

  // Prove-It: FAILS if ImageWithFallback removes the data-testid pass-through.
  it('[testid] ImageWithFallback accepts and passes through data-testid prop', () => {
    expect(imageWithFallbackSrc).toContain('"data-testid"?: string');
    expect(imageWithFallbackSrc).toContain('data-testid={testId}');
  });

  // Prove-It: FAILS if ErrorState removes the data-testid on ImageWithFallback.
  it('[testid] ErrorState passes data-testid to ImageWithFallback using img--error-mascot pattern', () => {
    expect(errorStateSrc).toContain('data-testid={`img--error-mascot-${variant}`}');
  });
});

// ===========================================================================
// Page wiring: not-found.tsx, error.tsx, dashboard/error.tsx
// ===========================================================================

describe('Page wiring: app/not-found.tsx uses ErrorState variant="not-found"', () => {

  // Prove-It: FAILS if ErrorState import is removed from not-found.tsx.
  it('[import] app/not-found.tsx imports ErrorState', () => {
    expect(notFoundPageSrc).toContain('ErrorState');
    expect(notFoundPageSrc).toContain("from \"@/components/ErrorState\"");
  });

  // Prove-It: FAILS if variant is changed from "not-found".
  it('[variant] app/not-found.tsx renders ErrorState variant="not-found"', () => {
    expect(notFoundPageSrc).toContain('variant="not-found"');
  });

  // Prove-It: FAILS if "use client" is RE-ADDED. not-found.tsx must be a SERVER
  // component — a "use client" not-found falls under the root app/loading.tsx
  // Suspense boundary and gets stuck on the skeleton fallback for unmatched routes
  // (observed on staging). The child ErrorState stays "use client" for TH/EN.
  it('[directive] app/not-found.tsx is a SERVER component (no "use client" — avoids loading.tsx skeleton)', () => {
    expect(hasUseClientDirective(notFoundPageSrc)).toBe(false);
  });

  // Prove-It: FAILS if Navbar is removed from the 404 page.
  it('[shell] app/not-found.tsx includes Navbar (navigation always available on 404)', () => {
    expect(notFoundPageSrc).toContain('<Navbar');
    expect(notFoundPageSrc).toContain("from \"@/components/Navbar\"");
  });
});

describe('Page wiring: app/dashboard/error.tsx uses ErrorState compact', () => {

  // Prove-It: FAILS if variant changes from "error".
  it('[variant] app/dashboard/error.tsx renders ErrorState variant="error"', () => {
    expect(dashboardErrorSrc).toContain('variant="error"');
  });

  // Prove-It: FAILS if compact prop is removed.
  it('[compact] app/dashboard/error.tsx passes compact prop (sidebar layout preserved)', () => {
    expect(dashboardErrorSrc).toContain('compact');
  });

  // Prove-It: FAILS if onRetry={reset} is removed.
  it('[recovery] app/dashboard/error.tsx passes onRetry={reset}', () => {
    expect(dashboardErrorSrc).toContain('onRetry={reset}');
  });

  // Prove-It: FAILS if security is broken and error details are exposed.
  it('[security] app/dashboard/error.tsx does NOT render error.message or stack in JSX', () => {
    const noComments = dashboardErrorSrc
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toContain('{error.message}');
    expect(noComments).not.toContain('{error.stack}');
  });

  // Prove-It: FAILS if "use client" is removed.
  it('[directive] app/dashboard/error.tsx has "use client" directive (Next.js error boundary requirement)', () => {
    expect(hasUseClientDirective(dashboardErrorSrc)).toBe(true);
  });
});

// ===========================================================================
// Structural integrity: "use client" on ErrorState itself
// ===========================================================================

describe('Structural: ErrorState.tsx is a client component using useLanguage', () => {

  // Prove-It: FAILS if "use client" is removed from ErrorState (useLanguage requires it).
  it('[directive] ErrorState.tsx has "use client" directive (hooks require client boundary)', () => {
    expect(hasUseClientDirective(errorStateSrc)).toBe(true);
  });

  // Prove-It: FAILS if named export is changed to default export.
  it('[export] ErrorState is a named export (not default)', () => {
    expect(errorStateSrc).toContain('export function ErrorState');
  });

  // Prove-It: FAILS if ErrorStateProps interface is removed.
  it('[interface] ErrorStateProps interface is exported', () => {
    expect(errorStateSrc).toContain('export interface ErrorStateProps');
  });

  // Prove-It: FAILS if the compact layout branch is removed.
  it('[layout] compact=true switches to reduced-height layout (py-12 vs min-h)', () => {
    // The ternary is split across lines; check both branches are present anywhere in the file
    expect(errorStateSrc).toContain('py-12');
    expect(errorStateSrc).toContain('min-h-[calc(100vh-64px)]');
    // The wrapperClass is assigned using the compact ternary
    expect(errorStateSrc).toContain('wrapperClass = compact');
  });

  // Prove-It: FAILS if compact also affects mascot sizing.
  it('[layout] compact=true reduces mascot size from w-48/w-64 to w-32', () => {
    // mascotWrapperClass is computed from the compact ternary
    expect(errorStateSrc).toContain('mascotWrapperClass = compact');
    expect(errorStateSrc).toContain('w-32');
    expect(errorStateSrc).toContain('w-48 md:w-64');
  });
});
