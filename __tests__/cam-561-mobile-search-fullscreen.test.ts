/**
 * cam-561-mobile-search-fullscreen.test.ts — CAM-561 (search dialog is full
 * screen on a phone with no header bar; desktop unchanged; a reachable
 * mobile dismiss path exists; CAM-540's dismiss guard is untouched).
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'`, no jsdom — see __tests__/cam-272-ai-chat-components
 * .test.ts / __tests__/cam-550-mobile-assistant.test.ts for the established
 * convention). Real-browser behavior (does the dialog actually fill a phone
 * viewport, is the header actually absent at a phone width but present at
 * desktop, does the mobile close control actually work, does Escape still
 * close) is proven in e2e/regression/cam-561-mobile-search-fullscreen.spec.ts
 * — a real browser is the only honest instrument for those claims.
 *
 * AC coverage:
 *   AC-1 the dialog geometry carries a max-sm: override that forces
 *        full-screen positioning using a real visible-viewport unit (dvh)
 *   AC-2 the desktop `sm:max-w-3xl` card classes are untouched (regression
 *        guard: proves this is an ADDITIVE override, not a rewrite)
 *   AC-3 a mobile-only close control exists, wired to the same onClose
 *   BR-2 ModalHeader's title keeps sr-only (never hidden) on mobile; the
 *        close control is fully hidden (max-sm:hidden) on mobile
 *   BR-3 the mobile close control calls the same onClose prop, no new state
 *   Shell-safety: hideOnMobile defaults to false and no other ModalHeader
 *        consumer opts in — the 6 other consumers stay byte-identical
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const searchModalSrc = read("components/SearchModal.tsx");
const modalShellSrc = read("components/ui/modal-shell.tsx");

describe("AC-1 — mobile (max-sm, below 640px) the dialog is forced full screen", () => {
  it("[unit] ModalContent carries a max-sm: override forcing full-screen positioning (wins the cascade below 640px over the centered desktop card)", () => {
    expect(searchModalSrc).toContain("max-sm:top-0");
    expect(searchModalSrc).toContain("max-sm:translate-x-0");
    expect(searchModalSrc).toContain("max-sm:translate-y-0");
    expect(searchModalSrc).toContain("max-sm:h-[100dvh]");
    expect(searchModalSrc).toContain("max-sm:max-h-[100dvh]");
    expect(searchModalSrc).toContain("max-sm:max-w-none");
  });

  it("[unit/Prove-It] the fix uses a real visible-viewport unit (dvh), not a bare inset-0 (CAM-550's exact lesson: bare inset-0 desyncs from the phone address bar)", () => {
    expect(searchModalSrc).toMatch(/max-sm:h-\[100dvh\]/);
    expect(searchModalSrc).not.toMatch(/max-sm:inset-0(?!\S)/);
  });

  it("[unit] the outer content wrapper's 90vh cap is lifted on mobile (max-sm:max-h-none), so it can stretch to the now-100dvh ModalContent parent", () => {
    expect(searchModalSrc).toContain("max-h-[90vh] max-sm:max-h-none");
  });

  it("[unit] rounded corners are removed on the mobile full-screen sheet (max-sm:rounded-none)", () => {
    expect(searchModalSrc).toContain("max-sm:rounded-none");
  });
});

describe("AC-2 — desktop (sm:+) is unchanged (regression guard: additive, not a rewrite)", () => {
  it("[unit] the pre-existing desktop width class sm:max-w-3xl is untouched (byte-identical)", () => {
    expect(searchModalSrc).toContain("sm:max-w-3xl");
  });

  it("[unit] ModalHeader is still passed title/closeLabel/onClose exactly as before, plus only the new opt-in prop", () => {
    const headerCallMatch = searchModalSrc.match(/<ModalHeader[\s\S]*?\/>/);
    expect(headerCallMatch).not.toBeNull();
    const call = headerCallMatch![0];
    expect(call).toContain("title={t.search.search}");
    expect(call).toContain('closeLabel={t.common?.close ?? "Close"}');
    expect(call).toContain("onClose={onClose}");
    expect(call).toContain("hideOnMobile");
  });
});

describe("AC-3 / BR-3 — a mobile-only close control exists and calls the same onClose", () => {
  it('[unit] a mobile close control with data-testid="btn--search-mobile-close" exists', () => {
    expect(searchModalSrc).toContain('data-testid="btn--search-mobile-close"');
  });

  it("[unit] the mobile close control is hidden at sm:+ (visible by default below it, matching Tailwind's mobile-first default)", () => {
    const idx = searchModalSrc.indexOf('data-testid="btn--search-mobile-close"');
    const block = searchModalSrc.slice(idx - 300, idx + 100);
    expect(block).toContain("sm:hidden");
  });

  it("[unit] the mobile close control is wired to the same onClose handler (no separate close path/state)", () => {
    const idx = searchModalSrc.indexOf('data-testid="btn--search-mobile-close"');
    const block = searchModalSrc.slice(idx - 300, idx + 100);
    expect(block).toContain("onClick={onClose}");
  });

  it("[unit] the mobile close control has an accessible name from the same locale key the desktop close uses (t.common.close)", () => {
    const idx = searchModalSrc.indexOf('data-testid="btn--search-mobile-close"');
    const block = searchModalSrc.slice(idx - 300, idx + 100);
    expect(block).toContain('aria-label={t.common?.close ?? "Close"}');
  });
});

describe("BR-2 — ModalHeader: title stays accessible (sr-only) on mobile; close control is fully absent (not merely hidden-but-tappable)", () => {
  it("[unit] hideOnMobile is declared optional and defaults to false", () => {
    expect(modalShellSrc).toMatch(/hideOnMobile\?:\s*boolean/);
    expect(modalShellSrc).toMatch(/hideOnMobile\s*=\s*false/);
  });

  it("[unit] the title wrapper uses max-sm:sr-only when hideOnMobile (never hidden/display:none — keeps the Dialog's aria-labelledby resolvable)", () => {
    expect(modalShellSrc).toContain('hideOnMobile && "max-sm:sr-only"');
    expect(modalShellSrc).not.toMatch(/hideOnMobile[\s\S]{0,40}max-sm:hidden[\s\S]{0,60}DialogTitle/);
  });

  it("[unit] the close control's wrapper is fully removed on mobile via max-sm:hidden when hideOnMobile", () => {
    expect(modalShellSrc).toContain('hideOnMobile ? "max-sm:hidden" : undefined');
  });

  it("[unit] the header band's border/padding collapses on mobile when hideOnMobile (no visible row remains)", () => {
    expect(modalShellSrc).toContain('hideOnMobile && "max-sm:border-none max-sm:p-0"');
  });

  it("[unit/Prove-It] the pre-existing close Button className stays a BARE string (not wrapped in cn()) — the cam-220 AC-5 regex only matches a bare className=\"...\" string; wrapping it in cn() would silently break that pinned test", () => {
    const closeButtonBlock = modalShellSrc.match(/data-testid="btn--modal-close"[\s\S]*?className=["'`]([^"'`]+)["'`]/);
    expect(closeButtonBlock).not.toBeNull();
    expect(closeButtonBlock![1]).toContain("top-1/2");
    expect(closeButtonBlock![1]).toContain("-translate-y-1/2");
    expect(closeButtonBlock![1]).toContain("right-4");
  });
});

describe("Shell-safety — hideOnMobile is opt-in; the other 6 ModalHeader consumers are unaffected", () => {
  const CONSUMERS_NOT_OPTING_IN = [
    "components/FilterModal.tsx",
    "components/LoginModal.tsx",
    "components/RegisterModal.tsx",
    "components/AmenitiesModal.tsx",
    "components/spot-form-dialog.tsx",
    "components/settings/AddMemberDialog.tsx",
  ];

  for (const relPath of CONSUMERS_NOT_OPTING_IN) {
    it(`[unit] ${relPath} does not pass hideOnMobile to ModalHeader (untouched by this story)`, () => {
      const src = read(relPath);
      const headerCall = src.match(/<ModalHeader[\s\S]*?\/>/);
      expect(headerCall).not.toBeNull();
      expect(headerCall![0]).not.toContain("hideOnMobile");
    });
  }

  it("[scan-guard] the consumer list above covers every ModalHeader call site except SearchModal.tsx", () => {
    const consumersDir = resolve(__dirname, "..", "components");
    const allTsx: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const abs = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else if (entry.name.endsWith(".tsx")) allTsx.push(abs);
      }
    };
    walk(consumersDir);
    const usesModalHeader = allTsx.filter((abs) => {
      try {
        return readFileSync(abs, "utf-8").includes("<ModalHeader");
      } catch {
        return false;
      }
    });
    // SearchModal.tsx + the 6 named consumers = every ModalHeader call site.
    expect(usesModalHeader.length).toBe(CONSUMERS_NOT_OPTING_IN.length + 1);
  });
});
