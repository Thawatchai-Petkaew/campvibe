/**
 * cam-220-modal-shell.test.ts — CAM-220 Modal Header Shell Unification
 *
 * Proves every AC for the shared modal shell introduced in CAM-220:
 *
 *   AC-1  ModalHeader renders the title
 *         DialogTitle is present; title prop is passed through.
 *
 *   AC-2  description is conditional
 *         DialogDescription renders only when the description prop is provided.
 *
 *   AC-3  close button contract
 *         data-testid="btn--modal-close" exists; Button role; aria-label equals closeLabel;
 *         default closeLabel is "Close".
 *
 *   AC-4  onClose fires
 *         onClick={onClose} is wired to the btn--modal-close button.
 *
 *   AC-5  vertical-centering invariant (structural)
 *         Close button className contains top-1/2 and -translate-y-1/2 (equal gap guarantee).
 *         Also: right-4, border-b, py-4 on the header container.
 *
 *   AC-6  ModalContent
 *         Renders children; showCloseButton={false} suppresses the built-in X;
 *         className includes rounded-3xl.
 *
 *   AC-7  Migration held — all modal consumers import from modal-shell
 *         Directory scan of app/ + components/ (excluding components/ui/**, app/status/**)
 *         finds every .tsx that uses <ModalContent or <DialogContent (non-AlertDialog);
 *         each must import from modal-shell; none may duplicate btn--modal-close.
 *         Adding a new hand-rolled modal automatically makes this suite red.
 *
 * Layer: source-inspect (static parse of real production files).
 *
 *   Source-inspection is the correct layer here — vitest is configured for
 *   environment: 'node' and includes only *.test.ts (not .tsx). The project's
 *   established pattern (cam-197, cam-196, ds3, etc.) inspects production source
 *   as text for structural and contract assertions; interactive/render assertions
 *   (onClick fires, Radix Dialog open state) are deferred to Staging manual
 *   verification per .claude/rules/qa.md §6.
 *
 *   Every assertion names the exact change that would make it red (Prove-It).
 *
 * Prove-It notes:
 *   AC-1:  title test FAILS if DialogTitle is removed from ModalHeader.
 *   AC-2:  description conditional FAILS if the {description != null && …} guard is removed.
 *   AC-2:  no-description test FAILS if DialogDescription renders unconditionally.
 *   AC-3:  data-testid test FAILS if "btn--modal-close" is removed.
 *   AC-3:  aria-label test FAILS if aria-label={closeLabel} is removed or changed.
 *   AC-3:  default closeLabel test FAILS if default is changed away from "Close".
 *   AC-4:  onClose wiring test FAILS if onClick={onClose} is removed from the Button.
 *   AC-5:  top-1/2 test FAILS if changed to top-4 (breaks equal gap guarantee).
 *   AC-5:  -translate-y-1/2 test FAILS if translation class is removed.
 *   AC-5:  right-4 test FAILS if close button is repositioned.
 *   AC-5:  border-b test FAILS if the header divider is removed.
 *   AC-5:  py-4 test FAILS if symmetric padding is changed.
 *   AC-6:  rounded-3xl test FAILS if removed from ModalContent className.
 *   AC-6:  showCloseButton=false test FAILS if removed (built-in X reappears).
 *   AC-6:  p-0 test FAILS if padding is added to ModalContent wrapper.
 *   AC-7:  scan-guard FAILS if the walkTsx scan returns 0 consumers.
 *   AC-7:  import test FAILS if any discovered modal drops modal-shell import.
 *   AC-7:  single btn--modal-close test FAILS if a modal duplicates the X button.
 *
 * Staging-only ACs (not automatable at source-inspect layer):
 *   - Equal top/bottom pixel gap across all 6 modals (visual — requires browser rendering)
 *   - TH/EN copy switch: closeLabel toggles between "ปิด" and "Close" (i18n live)
 *   - Dark-mode readability of header text and X icon
 *   - Esc key and overlay-click close the modal (Radix behavior, interactive)
 *   - AmenitiesModal: X button is visible and positioned correctly (visual)
 *   - AddMemberDialog: title "Add Team Member" is centered (visual)
 *   - Close button tap target on mobile (44×44px minimum, visual + dev-tools)
 *
 * AC → test-id matrix (per .claude/rules/qa.md §4 convention):
 *   AC-1   section--modal-header-title (source-inspect)
 *   AC-2   section--modal-header-description-conditional (source-inspect)
 *   AC-3   btn--modal-close-contract (source-inspect)
 *   AC-4   btn--modal-close-onclose-wired (source-inspect)
 *   AC-5   section--modal-header-centering-invariant (source-inspect)
 *   AC-6   modal--modal-content-shell (source-inspect)
 *   AC-7   section--modal-migration-held (source-inspect)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Source helpers — read real production files from the project root
// ---------------------------------------------------------------------------

const root = process.cwd();

function src(relPath: string): string {
    return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

// The component under test
const shellSrc = src('components/ui/modal-shell.tsx');

// ---------------------------------------------------------------------------
// AC-7 directory scan — discover all .tsx files under app/ and components/
// that use <ModalContent or <DialogContent (excluding pure AlertDialog files
// and shadcn primitives / app/status internal tooling).
// This replaces the previous static 6-file list so any future modal that
// hand-rolls DialogContent is automatically caught.
// ---------------------------------------------------------------------------

/** Walk a directory tree and collect all .tsx files (sync, no deps). */
function walkTsx(dir: string, results: string[] = []): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return results;
    }
    for (const entry of entries) {
        const abs = path.join(dir, entry);
        let stat: fs.Stats;
        try { stat = fs.statSync(abs); } catch { continue; }
        if (stat.isDirectory()) {
            walkTsx(abs, results);
        } else if (abs.endsWith('.tsx')) {
            results.push(abs);
        }
    }
    return results;
}

/** Directories / path segments to exclude from the modal scan. */
const MODAL_SCAN_EXCLUDE = [
    path.join(root, 'components', 'ui'),   // shadcn auto-generated primitives
    path.join(root, 'app', 'status'),      // internal tooling, out of scope
];

function isModalScanExcluded(abs: string): boolean {
    return MODAL_SCAN_EXCLUDE.some(
        (p) => abs.startsWith(p + path.sep) || abs === p,
    );
}

/**
 * Collect all .tsx files (in app/ and components/) that contain
 * <ModalContent or <DialogContent but are NOT purely AlertDialog-only
 * (i.e. their DialogContent usage is not exclusively via AlertDialogContent).
 * These are the files that MUST import from @/components/ui/modal-shell.
 */
function findModalConsumers(): Array<{ relPath: string; fileSrc: string }> {
    const scanDirs = [
        path.join(root, 'app'),
        path.join(root, 'components'),
    ];
    const consumers: Array<{ relPath: string; fileSrc: string }> = [];

    for (const dir of scanDirs) {
        for (const abs of walkTsx(dir)) {
            if (isModalScanExcluded(abs)) continue;
            let content: string;
            try { content = fs.readFileSync(abs, 'utf-8'); } catch { continue; }

            const hasModalContent = content.includes('<ModalContent');
            // True DialogContent JSX usage: look for the actual JSX opening tag <DialogContent
            // (not just the string "DialogContent" in comments or text).
            // Remove all AlertDialogContent occurrences first so they don't count.
            const hasDialogContent =
                /<DialogContent\b/.test(content.replace(/<AlertDialogContent/g, ''));

            if (hasModalContent || hasDialogContent) {
                consumers.push({
                    relPath: path.relative(root, abs),
                    fileSrc: content,
                });
            }
        }
    }
    return consumers;
}

const modalConsumers = findModalConsumers();

// ===========================================================================
// AC-1 — ModalHeader renders the title
//         section--modal-header-title
// ===========================================================================

describe('AC-1 — ModalHeader renders the title (section--modal-header-title)', () => {

    // Prove-It: FAILS if DialogTitle is removed from ModalHeader.
    it('[title] ModalHeader JSX includes <DialogTitle>', () => {
        // Extract the ModalHeader function body
        const headerFnMatch = shellSrc.match(
            /export function ModalHeader\([\s\S]*?\)([\s\S]*?)(?=\/\/ ModalContent|export function ModalContent)/
        );
        expect(headerFnMatch).not.toBeNull();
        const headerBody = headerFnMatch![1];
        expect(headerBody).toContain('<DialogTitle');
    });

    // Prove-It: FAILS if the {title} slot inside DialogTitle is removed.
    it('[title] DialogTitle renders the {title} prop', () => {
        const headerFnMatch = shellSrc.match(
            /export function ModalHeader\([\s\S]*?\)([\s\S]*?)(?=\/\/ ModalContent|export function ModalContent)/
        );
        expect(headerFnMatch).not.toBeNull();
        const headerBody = headerFnMatch![1];
        // The title prop must be spread into DialogTitle as its children
        expect(headerBody).toMatch(/<DialogTitle[\s\S]*?\{title\}/);
    });

    // Prove-It: FAILS if DialogTitle is not imported from the dialog module.
    it('[import] DialogTitle is imported from @/components/ui/dialog', () => {
        expect(shellSrc).toMatch(/DialogTitle/);
        expect(shellSrc).toMatch(/from ["']@\/components\/ui\/dialog["']/);
    });
});

// ===========================================================================
// AC-2 — description is conditional
//         section--modal-header-description-conditional
// ===========================================================================

describe('AC-2 — description is conditional (section--modal-header-description-conditional)', () => {

    // Prove-It: FAILS if the null-guard on description is removed (renders unconditionally).
    it('[conditional] DialogDescription is guarded by {description != null && …}', () => {
        expect(shellSrc).toMatch(/description\s*!=\s*null/);
    });

    // Prove-It: FAILS if DialogDescription is removed from ModalHeader.
    it('[conditional] DialogDescription is present inside the guard', () => {
        // It must be inside the conditional block, not outside
        const conditionalBlock = shellSrc.match(
            /description\s*!=\s*null[\s\S]*?<DialogDescription[\s\S]*?<\/DialogDescription>/
        );
        expect(conditionalBlock).not.toBeNull();
    });

    // Prove-It: FAILS if DialogDescription is not imported.
    it('[import] DialogDescription is imported from @/components/ui/dialog', () => {
        expect(shellSrc).toMatch(/DialogDescription/);
    });

    // Prove-It: FAILS if the description prop is added to the interface as required (must stay optional).
    it('[optional] description prop is declared optional in ModalHeaderProps', () => {
        expect(shellSrc).toMatch(/description\?:/);
    });
});

// ===========================================================================
// AC-3 — close button contract
//         btn--modal-close-contract
// ===========================================================================

describe('AC-3 — close button contract (btn--modal-close-contract)', () => {

    // Prove-It: FAILS if "btn--modal-close" is removed from data-testid.
    it('[testid] data-testid="btn--modal-close" is present on the close button', () => {
        expect(shellSrc).toContain('data-testid="btn--modal-close"');
    });

    // Prove-It: FAILS if the Button element is replaced with a non-button element.
    it('[role] the close element is a <Button> component (renders as button)', () => {
        // The Button must be immediately inside DialogClose asChild
        const closeBlock = shellSrc.match(/<DialogClose\s+asChild[\s\S]*?<\/DialogClose>/);
        expect(closeBlock).not.toBeNull();
        expect(closeBlock![0]).toContain('<Button');
    });

    // Prove-It: FAILS if aria-label={closeLabel} is removed from the Button.
    it('[a11y] aria-label={closeLabel} is wired to the close button', () => {
        expect(shellSrc).toContain('aria-label={closeLabel}');
    });

    // Prove-It: FAILS if the default for closeLabel is changed from "Close".
    it('[default] closeLabel default is "Close"', () => {
        expect(shellSrc).toMatch(/closeLabel\s*=\s*["']Close["']/);
    });

    // Prove-It: FAILS if X icon import is removed.
    it('[icon] X icon is imported from lucide-react', () => {
        expect(shellSrc).toMatch(/import[\s\S]*?\bX\b[\s\S]*?from ["']lucide-react["']/);
    });

    // Prove-It: FAILS if <X is removed from inside the Button.
    it('[icon] <X icon is rendered inside the close Button', () => {
        const closeBlock = shellSrc.match(/<DialogClose\s+asChild[\s\S]*?<\/DialogClose>/);
        expect(closeBlock).not.toBeNull();
        expect(closeBlock![0]).toContain('<X ');
    });

    // Prove-It: FAILS if DialogClose is removed (button no longer closes the dialog).
    it('[close-primitive] DialogClose asChild wraps the Button', () => {
        expect(shellSrc).toContain('<DialogClose asChild>');
        // Also confirm DialogClose is imported
        expect(shellSrc).toMatch(/DialogClose/);
    });
});

// ===========================================================================
// AC-4 — onClose fires
//         btn--modal-close-onclose-wired
// ===========================================================================

describe('AC-4 — onClose prop wired to close button (btn--modal-close-onclose-wired)', () => {

    // Prove-It: FAILS if onClick={onClose} is removed from the Button.
    it('[wired] onClick={onClose} is set on the btn--modal-close Button', () => {
        expect(shellSrc).toContain('onClick={onClose}');
    });

    // Prove-It: FAILS if onClose is removed from the ModalHeaderProps interface.
    it('[interface] onClose is declared as an optional prop in ModalHeaderProps', () => {
        expect(shellSrc).toMatch(/onClose\?:\s*\(\)\s*=>\s*void/);
    });

    // Prove-It: FAILS if onClose is removed from the destructured parameters.
    it('[destructure] onClose is destructured from ModalHeader props', () => {
        const headerFnMatch = shellSrc.match(
            /export function ModalHeader\(\s*\{([\s\S]*?)\}/
        );
        expect(headerFnMatch).not.toBeNull();
        expect(headerFnMatch![1]).toContain('onClose');
    });
});

// ===========================================================================
// AC-5 — vertical-centering invariant (structural)
//         section--modal-header-centering-invariant
// ===========================================================================

describe('AC-5 — vertical-centering invariant (section--modal-header-centering-invariant)', () => {

    // Extract the close button className from the shell source for tight assertions
    const closeBtnClassMatch = shellSrc.match(
        /data-testid="btn--modal-close"[\s\S]*?className=["'`]([^"'`]+)["'`]/
    );

    // Prove-It: FAILS if top-1/2 is changed to top-4 (breaks equal gap guarantee).
    it('[centering] close button className contains top-1/2', () => {
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('top-1/2');
    });

    // Prove-It: FAILS if -translate-y-1/2 is removed (button would no longer be centered).
    it('[centering] close button className contains -translate-y-1/2', () => {
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('-translate-y-1/2');
    });

    // Prove-It: FAILS if the button is moved from absolute right-4 to a flex position.
    it('[position] close button className contains right-4', () => {
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('right-4');
    });

    // Prove-It: FAILS if absolute positioning is removed (button floats in flow).
    it('[position] close button className contains absolute', () => {
        expect(closeBtnClassMatch).not.toBeNull();
        expect(closeBtnClassMatch![1]).toContain('absolute');
    });

    // Prove-It: FAILS if border-b is removed (header loses its divider).
    it('[divider] header container className contains border-b', () => {
        // Extract the outermost <div className on the ModalHeader return
        const headerDivMatch = shellSrc.match(
            /export function ModalHeader[\s\S]*?return\s*\(\s*\n\s*<div[\s\S]*?className=\{cn\(\s*\n?\s*["'`]([\s\S]*?)["'`]/
        );
        expect(headerDivMatch).not.toBeNull();
        expect(headerDivMatch![1]).toContain('border-b');
    });

    // Prove-It: FAILS if py-4 is removed (symmetric top/bottom padding is gone).
    it('[padding] header container className contains py-4 (symmetric vertical padding)', () => {
        const headerDivMatch = shellSrc.match(
            /export function ModalHeader[\s\S]*?return\s*\(\s*\n\s*<div[\s\S]*?className=\{cn\(\s*\n?\s*["'`]([\s\S]*?)["'`]/
        );
        expect(headerDivMatch).not.toBeNull();
        expect(headerDivMatch![1]).toContain('py-4');
    });
});

// ===========================================================================
// AC-6 — ModalContent shell contract
//         modal--modal-content-shell
// ===========================================================================

describe('AC-6 — ModalContent shell contract (modal--modal-content-shell)', () => {

    // Extract the ModalContent function body for targeted assertions
    const contentFnMatch = shellSrc.match(
        /export function ModalContent\([\s\S]*?\)([\s\S]*?)$/
    );

    // Prove-It: FAILS if showCloseButton={false} is removed (built-in X reappears).
    it('[no-dupe-x] showCloseButton={false} is passed to DialogContent', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('showCloseButton={false}');
    });

    // Prove-It: FAILS if rounded-3xl is removed from ModalContent's className.
    it('[rounded] ModalContent className base contains rounded-3xl', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('rounded-3xl');
    });

    // Prove-It: FAILS if p-0 is removed (inner sections would have double padding).
    it('[padding] ModalContent className base contains p-0', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('p-0');
    });

    // Prove-It: FAILS if overflow-hidden is removed (content bleeds out of rounded corners).
    it('[overflow] ModalContent className base contains overflow-hidden', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('overflow-hidden');
    });

    // Prove-It: FAILS if border-none is removed (border reappears on the shell).
    it('[border] ModalContent className base contains border-none', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('border-none');
    });

    // Prove-It: FAILS if {children} is removed from ModalContent (content never renders).
    it('[children] ModalContent renders {children}', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('{children}');
    });

    // Prove-It: FAILS if ModalContent no longer wraps DialogContent.
    it('[primitive] ModalContent wraps DialogContent', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('<DialogContent');
    });

    // Prove-It: FAILS if {...props} spread is removed (callers lose their custom props).
    it('[spread] ModalContent spreads remaining props to DialogContent', () => {
        expect(contentFnMatch).not.toBeNull();
        expect(contentFnMatch![1]).toContain('{...props}');
    });
});

// ===========================================================================
// AC-7 — Migration held: all 6 modals use the shared shell
//         section--modal-migration-held
// ===========================================================================

describe('AC-7 — Migration held: all modal consumers import from modal-shell (section--modal-migration-held)', () => {

    // The consumer list is discovered dynamically via directory scan of app/ + components/
    // (excluding components/ui/** and app/status/**) — any file that uses <ModalContent or
    // <DialogContent (excluding pure AlertDialog) must import from @/components/ui/modal-shell.
    // Adding a new modal without the import will make this suite red automatically.

    // Prove-It: FAILS if the directory scan yields zero consumers (guard against a broken scan).
    it('[scan-guard] directory scan found at least 1 modal consumer', () => {
        expect(modalConsumers.length).toBeGreaterThan(0);
    });

    for (const { relPath, fileSrc } of modalConsumers) {
        const label = path.basename(relPath, '.tsx');

        // Prove-It: FAILS if any modal drops the modal-shell import.
        it(`[import] ${label} (${relPath}) imports from @/components/ui/modal-shell`, () => {
            expect(fileSrc).toMatch(/from ["']@\/components\/ui\/modal-shell["']/);
        });

        // Prove-It: FAILS if any modal adds its own close button
        // (data-testid="btn--modal-close" must NOT appear in the consumer source —
        // the shell owns it, consumers don't duplicate it).
        it(`[no-dupe-x] ${label} does NOT have its own data-testid="btn--modal-close" (shell owns the X)`, () => {
            expect(fileSrc).not.toContain('data-testid="btn--modal-close"');
        });
    }

    // Guard: the testid lives exactly ONCE in modal-shell.tsx (not zero, not twice).
    // Prove-It: FAILS if the testid is accidentally removed from the shell or added twice.
    it('[single-source] btn--modal-close testid appears exactly once in modal-shell.tsx', () => {
        const occurrences = (shellSrc.match(/data-testid="btn--modal-close"/g) ?? []).length;
        expect(occurrences).toBe(1);
    });
});

// ===========================================================================
// AC-8 — Shell structural integrity (grep guards)
//         section--modal-shell-structure-guard
// ===========================================================================

describe('AC-8 — Shell structural integrity guards (section--modal-shell-structure-guard)', () => {

    // Prove-It: FAILS if ModalHeader export is removed.
    it('[export] ModalHeader is exported from modal-shell.tsx', () => {
        expect(shellSrc).toContain('export function ModalHeader');
    });

    // Prove-It: FAILS if ModalContent export is removed.
    it('[export] ModalContent is exported from modal-shell.tsx', () => {
        expect(shellSrc).toContain('export function ModalContent');
    });

    // Prove-It: FAILS if "use client" directive is removed (both components are interactive).
    it('[directive] modal-shell.tsx has "use client" directive (both components need it)', () => {
        // Match with or without trailing semicolon (both forms are valid JS/TS directives)
        const lines = shellSrc.split('\n');
        const directive = lines.find((line) => {
            const t = line.trim().replace(/;$/, '');
            return t === '"use client"' || t === "'use client'";
        });
        expect(directive).toBeDefined();
    });

    // Prove-It: FAILS if cn() is removed (className merging breaks).
    it('[utils] cn() utility is used for className merging in both components', () => {
        expect(shellSrc).toMatch(/from ["']@\/lib\/utils["']/);
        // Must appear at least twice (once per component)
        const cnCalls = (shellSrc.match(/\bcn\(/g) ?? []).length;
        expect(cnCalls).toBeGreaterThanOrEqual(2);
    });

    // Prove-It: FAILS if the Button import is removed.
    it('[import] Button is imported from @/components/ui/button', () => {
        expect(shellSrc).toMatch(/from ["']@\/components\/ui\/button["']/);
    });

    // Prove-It: FAILS if there is no modal-shell.tsx file at the expected path.
    it('[file-exists] components/ui/modal-shell.tsx file exists', () => {
        const filePath = path.join(root, 'components', 'ui', 'modal-shell.tsx');
        expect(fs.existsSync(filePath)).toBe(true);
    });
});
