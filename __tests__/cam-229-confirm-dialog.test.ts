/**
 * CAM-229 B3 — ConfirmDialog primitive (source-inspection layer)
 *
 * AC coverage:
 *
 *   AC-file-1    components/ui/confirm-dialog.tsx exists on disk
 *   AC-file-2    file has "use client" directive
 *   AC-api-1     ConfirmDialog is exported (named export)
 *   AC-api-2     open prop accepted (AlertDialog open= wired)
 *   AC-api-3     onOpenChange prop accepted
 *   AC-api-4     title prop accepted (AlertDialogTitle wired)
 *   AC-api-5     description prop is optional (AlertDialogDescription guarded by != null)
 *   AC-api-6     confirmLabel prop accepted (passed as children to AlertDialogAction)
 *   AC-api-7     cancelLabel prop accepted (passed as children to AlertDialogCancel)
 *   AC-api-8     onConfirm prop accepted (onClick={onConfirm} wired to AlertDialogAction)
 *   AC-api-9     isLoading prop: disables confirm button (disabled={isLoading}), shows spinner
 *   AC-api-10    destructive prop: confirm button uses variant="destructive" when true
 *   AC-api-11    data-testid prop forwarded to AlertDialogContent
 *   AC-prim-1    wraps AlertDialog, AlertDialogContent, AlertDialogAction, AlertDialogCancel
 *   AC-prim-2    AlertDialogCancel gets disabled={isLoading} (prevents cancel during loading)
 *   AC-prim-3    no hardcoded hex / px (token-only)
 *   AC-migration-1  CampgroundForm uses ConfirmDialog (not inline AlertDialogContent)
 *   AC-migration-2  dashboard/campsites page uses ConfirmDialog
 *   AC-migration-3  bookings/page uses ConfirmDialog
 *   AC-migration-4  BookingDetailClient uses ConfirmDialog
 *   AC-migration-5  TeamManagement uses ConfirmDialog
 *   AC-design-1  DESIGN.md §3 ConfirmDialog entry points to confirm-dialog.tsx (not "planned")
 *
 * Layer: source-inspection (static parse of real production files).
 *
 * The project-established pattern (cam-220, ds3, cam-197, etc.) inspects
 * production source as text for structural and contract assertions.
 * Interactive/render assertions (onClick fires, Radix open state, loading
 * state visuals) are deferred to Staging manual verification per
 * .claude/rules/qa.md §6.
 *
 * Prove-It notes:
 *   AC-file-1:  FAILS if confirm-dialog.tsx is deleted or moved.
 *   AC-file-2:  FAILS if "use client" is removed from the file.
 *   AC-api-1:   FAILS if ConfirmDialog is no longer exported.
 *   AC-api-2:   FAILS if open= binding is removed from AlertDialog.
 *   AC-api-3:   FAILS if onOpenChange= binding is removed.
 *   AC-api-4:   FAILS if AlertDialogTitle stops rendering {title}.
 *   AC-api-5:   FAILS if description guard is removed (renders unconditionally).
 *   AC-api-6:   FAILS if confirmLabel stops being passed to the action.
 *   AC-api-7:   FAILS if cancelLabel stops being passed to the cancel.
 *   AC-api-8:   FAILS if onClick={onConfirm} is removed from AlertDialogAction.
 *   AC-api-9:   FAILS if disabled={isLoading} is removed or spinner is removed.
 *   AC-api-10:  FAILS if variant logic for destructive is removed.
 *   AC-api-11:  FAILS if data-testid forwarding to AlertDialogContent is removed.
 *   AC-prim-1:  FAILS if any of the AlertDialog primitives are removed.
 *   AC-prim-2:  FAILS if AlertDialogCancel loses its disabled={isLoading} prop.
 *   AC-prim-3:  FAILS if any hardcoded hex or [Npx] class is introduced.
 *   AC-migration-*:  FAILS if any site reverts to hand-rolled AlertDialogContent.
 *   AC-design-1:     FAILS if DESIGN.md still says "(planned)" for ConfirmDialog.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = process.cwd();

function src(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), "utf-8");
}

const confirmDialogPath = path.join(root, "components", "ui", "confirm-dialog.tsx");
const confirmDialogSrc = src("components/ui/confirm-dialog.tsx");

// ─────────────────────────────────────────────────────────────
// AC-file-1/2: file exists + "use client"
// ─────────────────────────────────────────────────────────────

describe("AC-file-1: components/ui/confirm-dialog.tsx exists", () => {
  it("file is present on disk", () => {
    expect(fs.existsSync(confirmDialogPath)).toBe(true);
  });
});

describe('AC-file-2: "use client" directive present', () => {
  it('first meaningful line is "use client"', () => {
    const lines = confirmDialogSrc.split("\n");
    const directive = lines.find((line) => {
      const trimmed = line.trim().replace(/;$/, "");
      return trimmed === '"use client"' || trimmed === "'use client'";
    });
    expect(directive).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-1: named export
// ─────────────────────────────────────────────────────────────

describe("AC-api-1: ConfirmDialog is a named export", () => {
  it("source contains export function ConfirmDialog", () => {
    expect(confirmDialogSrc).toContain("export function ConfirmDialog");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-2/3: open + onOpenChange wired to AlertDialog
// ─────────────────────────────────────────────────────────────

describe("AC-api-2: open prop wired to AlertDialog", () => {
  it("AlertDialog receives open={open}", () => {
    expect(confirmDialogSrc).toMatch(/AlertDialog\b[\s\S]{0,200}?open=\{open\}/);
  });
});

describe("AC-api-3: onOpenChange prop wired to AlertDialog", () => {
  it("AlertDialog receives onOpenChange={onOpenChange}", () => {
    expect(confirmDialogSrc).toMatch(/onOpenChange=\{onOpenChange\}/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-4: title prop wired to AlertDialogTitle
// ─────────────────────────────────────────────────────────────

describe("AC-api-4: title prop rendered inside AlertDialogTitle", () => {
  it("AlertDialogTitle renders {title}", () => {
    expect(confirmDialogSrc).toMatch(/<AlertDialogTitle[\s\S]*?\{title\}/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-5: description is optional (guarded)
// ─────────────────────────────────────────────────────────────

describe("AC-api-5: description prop is optional with a null-guard", () => {
  it("description is guarded by != null before rendering AlertDialogDescription", () => {
    expect(confirmDialogSrc).toMatch(/description\s*!=\s*null/);
  });

  it("description prop is declared optional in the interface", () => {
    expect(confirmDialogSrc).toMatch(/description\?:/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-6/7: confirmLabel + cancelLabel as button children
// ─────────────────────────────────────────────────────────────

describe("AC-api-6: confirmLabel passed to AlertDialogAction", () => {
  it("confirmLabel is referenced inside the AlertDialogAction block", () => {
    // confirmLabel is rendered in the ternary branch when not loading:
    // {isLoading ? <Loader2 .../> : ( confirmLabel )}
    // The identifier appears in the source (without braces as the bare ternary branch)
    expect(confirmDialogSrc).toContain("confirmLabel");
    // Confirm it appears inside or after AlertDialogAction (same block)
    const actionBlock = confirmDialogSrc.match(/<AlertDialogAction[\s\S]*?<\/AlertDialogAction>/);
    expect(actionBlock).not.toBeNull();
    expect(actionBlock![0]).toContain("confirmLabel");
  });
});

describe("AC-api-7: cancelLabel passed to AlertDialogCancel", () => {
  it("cancelLabel appears as children in AlertDialogCancel block", () => {
    expect(confirmDialogSrc).toMatch(/\{cancelLabel\}/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-8: onConfirm wired to onClick
// ─────────────────────────────────────────────────────────────

describe("AC-api-8: onConfirm wired as onClick on AlertDialogAction", () => {
  it("AlertDialogAction has onClick={onConfirm}", () => {
    expect(confirmDialogSrc).toContain("onClick={onConfirm}");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-9: isLoading — disabled + spinner
// ─────────────────────────────────────────────────────────────

describe("AC-api-9: isLoading disables the confirm button and shows a spinner", () => {
  it("AlertDialogAction has disabled={isLoading}", () => {
    // Matches disabled={isLoading} on the action element
    const actionBlock = confirmDialogSrc.match(/<AlertDialogAction[\s\S]*?>/);
    expect(actionBlock).not.toBeNull();
    expect(actionBlock![0]).toContain("disabled={isLoading}");
  });

  it("spinner (animate-spin) is rendered when isLoading is true", () => {
    expect(confirmDialogSrc).toContain("animate-spin");
  });

  it("isLoading prop is declared with a default of false", () => {
    expect(confirmDialogSrc).toMatch(/isLoading\s*=\s*false/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-10: destructive prop — variant on AlertDialogAction
// ─────────────────────────────────────────────────────────────

describe('AC-api-10: destructive prop switches AlertDialogAction to variant="destructive"', () => {
  it("variant is conditional on destructive prop", () => {
    // The variant expression must reference "destructive" as both the prop and the variant value
    expect(confirmDialogSrc).toMatch(/variant=\{destructive\s*\?/);
  });

  it('"destructive" variant string appears in the variant expression', () => {
    expect(confirmDialogSrc).toMatch(/["']destructive["']/);
  });

  it("destructive prop is declared with a default of false", () => {
    expect(confirmDialogSrc).toMatch(/destructive\s*=\s*false/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-api-11: data-testid forwarded to AlertDialogContent
// ─────────────────────────────────────────────────────────────

describe("AC-api-11: data-testid prop forwarded to AlertDialogContent", () => {
  it("data-testid prop is declared in the interface", () => {
    expect(confirmDialogSrc).toMatch(/"data-testid"\?:/);
  });

  it("data-testid is spread onto AlertDialogContent", () => {
    expect(confirmDialogSrc).toMatch(/AlertDialogContent[\s\S]{0,100}?data-testid=\{dataTestId\}/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-prim-1: wraps the correct AlertDialog primitives
// ─────────────────────────────────────────────────────────────

describe("AC-prim-1: wraps AlertDialog primitives", () => {
  const primitives = [
    "AlertDialog",
    "AlertDialogContent",
    "AlertDialogHeader",
    "AlertDialogTitle",
    "AlertDialogDescription",
    "AlertDialogFooter",
    "AlertDialogAction",
    "AlertDialogCancel",
  ];

  for (const prim of primitives) {
    it(`imports and uses ${prim}`, () => {
      expect(confirmDialogSrc).toContain(prim);
    });
  }

  it("imports from @/components/ui/alert-dialog", () => {
    expect(confirmDialogSrc).toMatch(/from ["']@\/components\/ui\/alert-dialog["']/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-prim-2: AlertDialogCancel is also disabled during loading
// ─────────────────────────────────────────────────────────────

describe("AC-prim-2: AlertDialogCancel is disabled during isLoading", () => {
  it("AlertDialogCancel has disabled={isLoading}", () => {
    const cancelBlock = confirmDialogSrc.match(/<AlertDialogCancel[\s\S]*?>/);
    expect(cancelBlock).not.toBeNull();
    expect(cancelBlock![0]).toContain("disabled={isLoading}");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-prim-3: token-only — no hardcoded hex or arbitrary px
// ─────────────────────────────────────────────────────────────

describe("AC-prim-3: no hardcoded hex or arbitrary px in confirm-dialog.tsx", () => {
  it("does not contain a hardcoded hex color (#xxxxxx)", () => {
    expect(confirmDialogSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("does not contain an arbitrary px class ([Npx])", () => {
    expect(confirmDialogSrc).not.toMatch(/\[\d+px\]/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-migration-1: CampgroundForm uses ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe("AC-migration-1: CampgroundForm uses ConfirmDialog (not hand-rolled AlertDialogContent)", () => {
  const campFormSrc = src("components/CampgroundForm.tsx");

  it("imports ConfirmDialog from @/components/ui/confirm-dialog", () => {
    expect(campFormSrc).toMatch(/from ["']@\/components\/ui\/confirm-dialog["']/);
  });

  it("renders <ConfirmDialog", () => {
    expect(campFormSrc).toContain("<ConfirmDialog");
  });

  it("does not contain inline <AlertDialogContent", () => {
    expect(campFormSrc).not.toContain("<AlertDialogContent");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-migration-2: dashboard/campsites page uses ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe("AC-migration-2: app/dashboard/campsites/page.tsx uses ConfirmDialog", () => {
  const campsitesSrc = src("app/dashboard/campsites/page.tsx");

  it("imports ConfirmDialog from @/components/ui/confirm-dialog", () => {
    expect(campsitesSrc).toMatch(/from ["']@\/components\/ui\/confirm-dialog["']/);
  });

  it("renders <ConfirmDialog", () => {
    expect(campsitesSrc).toContain("<ConfirmDialog");
  });

  it("does not contain inline <AlertDialogContent", () => {
    expect(campsitesSrc).not.toContain("<AlertDialogContent");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-migration-3: bookings/page uses ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe("AC-migration-3: app/bookings/page.tsx uses ConfirmDialog", () => {
  const bookingsPageSrc = src("app/bookings/page.tsx");

  it("imports ConfirmDialog from @/components/ui/confirm-dialog", () => {
    expect(bookingsPageSrc).toMatch(/from ["']@\/components\/ui\/confirm-dialog["']/);
  });

  it("renders <ConfirmDialog", () => {
    expect(bookingsPageSrc).toContain("<ConfirmDialog");
  });

  it("does not contain inline <AlertDialogContent", () => {
    expect(bookingsPageSrc).not.toContain("<AlertDialogContent");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-migration-4: BookingDetailClient uses ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe("AC-migration-4: app/bookings/[id]/BookingDetailClient.tsx uses ConfirmDialog", () => {
  const detailSrc = src("app/bookings/[id]/BookingDetailClient.tsx");

  it("imports ConfirmDialog from @/components/ui/confirm-dialog", () => {
    expect(detailSrc).toMatch(/from ["']@\/components\/ui\/confirm-dialog["']/);
  });

  it("renders <ConfirmDialog with data-testid=\"booking-cancel-dialog\"", () => {
    expect(detailSrc).toContain('data-testid="booking-cancel-dialog"');
  });

  it("btn--booking-cancel testid is still present on the trigger button", () => {
    expect(detailSrc).toContain('data-testid="btn--booking-cancel"');
  });

  it("does not contain inline <AlertDialogContent", () => {
    expect(detailSrc).not.toContain("<AlertDialogContent");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-migration-5: TeamManagement uses ConfirmDialog
// ─────────────────────────────────────────────────────────────

describe("AC-migration-5: components/settings/TeamManagement.tsx uses ConfirmDialog", () => {
  const teamSrc = src("components/settings/TeamManagement.tsx");

  it("imports ConfirmDialog from @/components/ui/confirm-dialog", () => {
    expect(teamSrc).toMatch(/from ["']@\/components\/ui\/confirm-dialog["']/);
  });

  it("renders <ConfirmDialog", () => {
    expect(teamSrc).toContain("<ConfirmDialog");
  });

  it("does not contain inline <AlertDialogContent", () => {
    expect(teamSrc).not.toContain("<AlertDialogContent");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-design-1: DESIGN.md updated — no longer "(planned)"
// ─────────────────────────────────────────────────────────────

describe("AC-design-1: DESIGN.md ConfirmDialog entry is no longer planned", () => {
  const designSrc = src("DESIGN.md");

  it("DESIGN.md does not say ConfirmDialog is planned", () => {
    // Should not match the old "(planned — story B3)" entry
    expect(designSrc).not.toMatch(/ConfirmDialog[\s\S]{0,60}planned — story B3/);
  });

  it("DESIGN.md points to confirm-dialog.tsx as the file path", () => {
    expect(designSrc).toContain("confirm-dialog.tsx");
  });

  it("DESIGN.md lists 'use when: destructive/confirm dialog' guidance", () => {
    expect(designSrc).toMatch(/destructive\/confirm dialog/);
  });
});
