/**
 * cam-354-panorama-viewer.test.ts — CAM-354
 *
 * Spot-photo panorama viewer: a PANORAMA-kind thumbnail on the public camp
 * detail page's spot gallery (CAM-353) opens an in-house, zero-dependency
 * pan-strip viewer instead of the flat lightbox; a PHOTO thumbnail keeps the
 * existing path byte-for-byte.
 *
 * AC coverage matrix (ticket CAM-354, every row -> at least one test):
 *   AC-1  PANORAMA thumbnail tap -> pan viewer opens, `ลากหรือเลื่อนเพื่อดูภาพ` hint.
 *   AC-2  PHOTO thumbnail tap -> existing ImageGallery opens, unchanged.
 *   AC-3  PANORAMA thumbnail shows the badge + a pan icon (not color alone).
 *   AC-4  Drag/swipe/keyboard pans the image (native overflow-x + arrow keys).
 *   AC-5  Escape / close control / backdrop tap close the viewer; focus returns.
 *   AC-6  A failed panorama URL shows the ImageWithFallback placeholder, still closable.
 *   AC-7  prefers-reduced-motion -> no open/auto-pan animation; manual pan still works.
 *
 * Layers:
 *   - components/PanoramaViewer.tsx -> source-inspection (no isolated DOM
 *     harness; environment: 'node' per vitest.config.ts, same precedent as
 *     cam-353-detail-spot-section.test.ts / cam-350-segmented-progress.test.ts
 *     for source-level component assertions in this repo).
 *   - components/CampgroundDetailClient.tsx -> source-inspection for the kind
 *     branch + the dynamic-import boundary (BR-3).
 *   - locales/translations.json -> i18n presence + Thai-copy-verbatim + no-em-dash.
 *
 * Coverage matrix per .claude/rules/qa.md: normal · null/empty · boundary · error/validation.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import translations from '../locales/translations.json';

const root = path.resolve(__dirname, '..');
const src = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const panoramaSrc = src('components/PanoramaViewer.tsx');
const detailSrc = src('components/CampgroundDetailClient.tsx');

// ---------------------------------------------------------------------------
// BR-3 — dynamic-import boundary (never in the detail route's initial bundle).
// ---------------------------------------------------------------------------
describe('BR-3 dynamic-import boundary — PanoramaViewer is lazy, never eager (CAM-354)', () => {
  it('[normal] CampgroundDetailClient wraps the import in dynamic({ ssr: false })', () => {
    expect(detailSrc).toContain(
      'const PanoramaViewer = dynamic(() => import("@/components/PanoramaViewer"), {'
    );
    // Isolate the dynamic() call block specifically (not some unrelated ssr:false elsewhere).
    const startIdx = detailSrc.indexOf('const PanoramaViewer = dynamic(');
    const block = detailSrc.slice(startIdx, startIdx + 200);
    expect(block).toContain('ssr: false');
  });

  it('[regression] no static (non-dynamic) import of PanoramaViewer anywhere in the file', () => {
    expect(detailSrc).not.toMatch(/^import\s+PanoramaViewer\s+from/m);
    expect(detailSrc).not.toContain("from \"@/components/PanoramaViewer\";");
  });

  it('[EC-2] the viewer is only in the tree while `panorama` state is non-null (not always-mounted with an isOpen gate)', () => {
    // A next/dynamic component must be excluded from the render tree entirely to
    // avoid triggering its chunk fetch — an internal isOpen prop (like ImageGallery
    // uses) would NOT defer the import. Assert the conditional-render pattern.
    expect(detailSrc).toContain('{panorama && (');
    const startIdx = detailSrc.indexOf('{panorama && (');
    const block = detailSrc.slice(startIdx, startIdx + 200);
    expect(block).toContain('<PanoramaViewer url={panorama.url} alt={panorama.alt} onClose={closePanorama} />');
  });

  it('[normal] the module-load fallback is a real component (can call useLanguage) supplied as `loading`', () => {
    expect(detailSrc).toContain('function PanoramaModuleLoading()');
    expect(detailSrc).toContain('loading: PanoramaModuleLoading,');
  });
});

// ---------------------------------------------------------------------------
// BR-1 — kind branch, now on the CAM-664 spot viewport's single display image
// (was per-photo thumbnails in a `<ul>`; CAM-664 replaced that DOM with one
// fixed-height viewport — components/spot-viewer/SpotViewport.tsx +
// SpotViewer.tsx). Updated to the new canonical structure per the
// CAM-224/226/229 precedent (.claude/rules/qa.md): a legitimate refactor
// updates the pinned assertion, it is not left red.
// ---------------------------------------------------------------------------
describe('BR-1 kind branch — PANORAMA opens the pan viewer, PHOTO keeps the flat lightbox (CAM-354, updated CAM-664)', () => {
  const spotViewerSrc = src('components/spot-viewer/SpotViewer.tsx');
  const spotViewportSrc = src('components/spot-viewer/SpotViewport.tsx');

  it('[AC-1, EC-1] a PANORAMA display image click calls openPanorama with the image url + alt + trigger element', () => {
    expect(spotViewerSrc).toContain('if (displayImage.kind === "PANORAMA") {');
    expect(spotViewerSrc).toContain('onOpenPanorama(displayImage.url, displayImage.alt || t.panorama.title, e.currentTarget);');
  });

  it('[AC-2, EC-2 regression] a non-PANORAMA (PHOTO/default) display image still calls openSpotGallery (via the onOpenGallery prop) unchanged', () => {
    expect(spotViewerSrc).toContain('onOpenGallery(urls, index);');
    // CampgroundDetailClient still hands its own unchanged openSpotGallery down as this prop.
    expect(detailSrc).toContain('onOpenGallery={openSpotGallery}');
  });

  it('[AC-3] a PANORAMA viewport carries the pan aria-label, not the generic gallery-open label', () => {
    expect(spotViewportSrc).toContain('displayImage?.kind === "PANORAMA" ? t.panorama.openLabel : t.gallery.openGallery');
  });

  it('[AC-3] the badge + a lucide pan icon (MoveHorizontal) render together, never color alone', () => {
    const startIdx = spotViewportSrc.indexOf('displayImage?.kind === "PANORAMA" && (');
    expect(startIdx).toBeGreaterThan(-1);
    const block = spotViewportSrc.slice(startIdx, startIdx + 400);
    expect(block).toContain('<MoveHorizontal aria-hidden="true" />');
    expect(block).toContain('{t.spotManagement.panoramaBadge}');
    expect(block).toMatch(/<Badge\s*\n?\s*variant="overlay"/);
  });

  it('[import] MoveHorizontal is imported from lucide-react (never an emoji)', () => {
    expect(spotViewportSrc).toMatch(/from "lucide-react"/);
    const iconImportLine = spotViewportSrc.split('\n').find((l) => l.includes('MoveHorizontal') && l.includes('lucide-react'));
    expect(iconImportLine).toBeDefined();
  });

  it('[AC-5, EC-5, EC-7] closePanorama unmounts the viewer and restores focus to the trigger', () => {
    expect(detailSrc).toContain('const closePanorama = useCallback(() => {');
    expect(detailSrc).toContain('setPanorama(null);');
    expect(detailSrc).toContain('panoramaTriggerRef.current?.focus();');
  });

  it('[null/empty] panoramaTriggerRef starts null and is only set inside openPanorama', () => {
    expect(detailSrc).toContain('const panoramaTriggerRef = useRef<HTMLButtonElement | null>(null);');
    expect(detailSrc).toContain('panoramaTriggerRef.current = triggerEl;');
  });
});

// ---------------------------------------------------------------------------
// PanoramaViewer.tsx — a11y contract (BR-5, BR-6).
// ---------------------------------------------------------------------------
describe('PanoramaViewer.tsx — a11y contract (AC-4, AC-5, AC-7, BR-5, BR-6, CAM-354)', () => {
  it('[AC-5] real modal semantics: role=dialog, aria-modal, aria-label from i18n', () => {
    expect(panoramaSrc).toContain('role="dialog"');
    expect(panoramaSrc).toContain('aria-modal="true"');
    expect(panoramaSrc).toContain('aria-label={t.panorama.title}');
  });

  it('[AC-5] Escape closes; the close control is 44px (h-11 w-11) with an aria-label', () => {
    expect(panoramaSrc).toContain('if (e.key === "Escape") onClose();');
    expect(panoramaSrc).toContain('h-11 w-11');
    expect(panoramaSrc).toContain('aria-label={t.panorama.closeLabel}');
  });

  it('[AC-5, EC-7] a backdrop tap (click on the overlay itself, not a child) closes the viewer', () => {
    expect(panoramaSrc).toContain('if (e.target === e.currentTarget) onClose();');
  });

  it('[AC-5] focus moves to the close control on open (a real modal, not a no-op)', () => {
    expect(panoramaSrc).toContain('closeButtonRef.current?.focus();');
  });

  it('[AC-4] the scroll region is keyboard-pannable: tabIndex 0 + ArrowLeft/ArrowRight adjust scrollLeft', () => {
    expect(panoramaSrc).toContain('tabIndex={0}');
    expect(panoramaSrc).toContain('el.scrollLeft -= PAN_STEP_PX;');
    expect(panoramaSrc).toContain('el.scrollLeft += PAN_STEP_PX;');
  });

  it('[EC-3 boundary] arrow-key pan is a native scrollLeft nudge only — no custom momentum/inertia physics', () => {
    expect(panoramaSrc).not.toMatch(/requestAnimationFrame/);
    expect(panoramaSrc).not.toContain('velocity');
  });

  it('[BR-5] the visible hint doubles as the scroll region\'s accessible description', () => {
    expect(panoramaSrc).toContain('{t.panorama.hint}');
    expect(panoramaSrc).toContain('aria-describedby={hintId}');
  });

  it('[a11y] the loading region is role=status + aria-live=polite with the reused i18n label', () => {
    expect(panoramaSrc).toContain('role="status"');
    expect(panoramaSrc).toContain('aria-live="polite"');
    expect(panoramaSrc).toContain('<LoadingSpinner text={t.common.loading_sr} />');
  });

  it('[AC-7, BR-6] the open transition is gated behind motion-safe: (disabled under prefers-reduced-motion)', () => {
    expect(panoramaSrc).toContain('motion-safe:animate-in');
    expect(panoramaSrc).toContain('motion-safe:fade-in');
    // v1 ships no auto-pan/drift — nothing to gate beyond the entrance transition.
    expect(panoramaSrc).not.toMatch(/auto-?pan|drift/i);
  });
});

// ---------------------------------------------------------------------------
// PanoramaViewer.tsx — pan-strip contract (BR-2) + graceful failure (BR-7).
// ---------------------------------------------------------------------------
describe('PanoramaViewer.tsx — pan-strip + graceful-failure contract (AC-4, AC-6, BR-2, BR-7, CAM-354)', () => {
  it('[BR-2] the scroll container uses native overflow-x-auto — no WebGL/canvas/sphere projection', () => {
    expect(panoramaSrc).toContain('overflow-x-auto');
    // Check the actual component body only — the file's own doc-comment
    // mentions these terms in the negative ("no WebGL, no canvas") to explain
    // the design decision, which would otherwise self-trip this assertion.
    const bodySrc = panoramaSrc.slice(panoramaSrc.indexOf('export default function'));
    expect(bodySrc).not.toMatch(/canvas|webgl|haov|vaov|equirectangular/i);
  });

  it('[BR-2] the image renders at true pixels: height fills, width is auto (no forced aspect box)', () => {
    expect(panoramaSrc).toContain('"mx-auto h-full w-auto max-w-none select-none"');
  });

  it('[EC-3 boundary] a narrower-than-viewport image needs no special-case code — flex centering (items-center) handles it natively', () => {
    expect(panoramaSrc).toContain('items-center overflow-x-auto');
  });

  it('[AC-6, EC-4] a load failure flips hasErrored and swaps to the ImageWithFallback placeholder (src=null), still closable', () => {
    expect(panoramaSrc).toContain('onError={() => setHasErrored(true)}');
    expect(panoramaSrc).toContain('hasErrored ? (');
    expect(panoramaSrc).toContain('<ImageWithFallback\n                    src={null}');
    // The close button + Escape/backdrop handlers sit outside the hasErrored branch,
    // so the viewer stays closable in the fallback state too.
    const closeIdx = panoramaSrc.indexOf('data-testid="btn--panorama-close"');
    const errorIdx = panoramaSrc.indexOf('hasErrored ? (');
    expect(closeIdx).toBeLessThan(errorIdx);
  });

  it('[normal] onLoad flips isLoaded so the spinner is replaced by the (now-visible) image', () => {
    expect(panoramaSrc).toContain('onLoad={() => setIsLoaded(true)}');
    expect(panoramaSrc).toContain('!isLoaded && "invisible"');
  });

  it('[null/empty] showLoading is false once either loaded or errored (never both loader + content)', () => {
    expect(panoramaSrc).toContain('const showLoading = !isLoaded && !hasErrored;');
  });
});

// ---------------------------------------------------------------------------
// i18n — locales/translations.json (both en + th), BR-9.
// ---------------------------------------------------------------------------
describe('i18n: panorama.* copy (BR-9, CAM-354)', () => {
  it('[AC-1] th.panorama.hint is verbatim the AC-quoted Thai copy', () => {
    expect(translations.th.panorama.hint).toBe('ลากหรือเลื่อนเพื่อดูภาพ');
  });

  it('[AC-5, BR-5] th.panorama.title / closeLabel are verbatim the AC-quoted Thai copy', () => {
    expect(translations.th.panorama.title).toBe('ภาพพาโนรามา');
    expect(translations.th.panorama.closeLabel).toBe('ปิดภาพพาโนรามา');
  });

  it('[AC-3, BR-4] th.panorama.openLabel is verbatim the AC-quoted Thai copy', () => {
    expect(translations.th.panorama.openLabel).toBe('เปิดภาพพาโนรามา');
  });

  it('[normal] every panorama.* key exists with a non-empty string in en + th', () => {
    const keys = ['title', 'hint', 'openLabel', 'closeLabel'] as const;
    for (const lang of ['en', 'th'] as const) {
      for (const key of keys) {
        expect(typeof translations[lang].panorama[key]).toBe('string');
        expect(translations[lang].panorama[key].length).toBeGreaterThan(0);
      }
    }
  });

  it('[i18n rule] no em-dash (—) in the new copy (en or th)', () => {
    const keys = ['title', 'hint', 'openLabel', 'closeLabel'] as const;
    for (const lang of ['en', 'th'] as const) {
      for (const key of keys) {
        expect(translations[lang].panorama[key]).not.toContain('—');
      }
    }
  });

  it('[BR-9] the loading label is reused from common.loading_sr, not duplicated under panorama.*', () => {
    expect((translations.th.panorama as Record<string, unknown>).loading).toBeUndefined();
    expect(translations.th.common.loading_sr).toBe('กำลังโหลด…');
  });
});
