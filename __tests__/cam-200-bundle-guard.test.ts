/**
 * CAM-200 PERF-BUNDLE — bundle regression guard
 *
 * Prevents the 173 KB lucide-react wildcard import from creeping back into
 * FilterModal, and ensures SearchModal / LoginModal / RegisterModal are
 * lazy-loaded via next/dynamic in their parent files.
 *
 * These are source-inspect tests — they assert on file content, not runtime
 * behaviour, so they are fast, zero-dependency, and CI-safe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");

function read(rel: string) {
  return readFileSync(path.join(root, rel), "utf-8");
}

// ---------------------------------------------------------------------------
// Action A guard: FilterModal must NOT use the wildcard lucide import
// ---------------------------------------------------------------------------

describe("CAM-200 Action A — FilterModal lucide wildcard ban", () => {
  const src = read("components/FilterModal.tsx");

  it("must not contain `import * as LucideIcons from lucide-react`", () => {
    expect(src).not.toContain("import * as LucideIcons");
  });

  it("must not contain `import * as Lucide` (any variant)", () => {
    expect(src).not.toContain("import * as Lucide");
  });

  it("must define ICON_MAP with named lucide imports", () => {
    expect(src).toContain("const ICON_MAP");
  });

  it("must use ICON_MAP in getIconComponent (not LucideIcons[iconName])", () => {
    expect(src).toContain("ICON_MAP[iconName]");
    expect(src).not.toContain("LucideIcons[iconName]");
  });

  it("must not contain @ts-ignore (removed with the wildcard import)", () => {
    // The @ts-ignore was only needed to suppress the dynamic key lookup on the
    // wildcard import. With ICON_MAP it is no longer needed or present.
    expect(src).not.toContain("@ts-ignore");
  });

  it("must include HelpCircle as the fallback in ICON_MAP", () => {
    expect(src).toContain("HelpCircle");
  });
});

// ---------------------------------------------------------------------------
// Action B guard: SearchModal must be lazy-loaded via next/dynamic in Navbar
// ---------------------------------------------------------------------------

describe("CAM-200 Action B — SearchModal lazy in Navbar", () => {
  const src = read("components/Navbar.tsx");

  it("must not statically import SearchModal", () => {
    // A static import would be: import { SearchModal } from "./SearchModal"
    // or: import SearchModal from "./SearchModal"
    // Dynamic import via next/dynamic uses: import("./SearchModal")
    expect(src).not.toMatch(/^import\s+\{?\s*SearchModal/m);
  });

  it("must use next/dynamic for SearchModal", () => {
    expect(src).toContain('import("./SearchModal")');
    expect(src).toContain("ssr: false");
  });
});

// ---------------------------------------------------------------------------
// Action D guard: LoginModal and RegisterModal must be lazy in Navbar
// ---------------------------------------------------------------------------

describe("CAM-200 Action D — LoginModal + RegisterModal lazy in Navbar", () => {
  const src = read("components/Navbar.tsx");

  it("must not statically import LoginModal in Navbar", () => {
    expect(src).not.toMatch(/^import\s+\{?\s*LoginModal/m);
  });

  it("must not statically import RegisterModal in Navbar", () => {
    expect(src).not.toMatch(/^import\s+\{?\s*RegisterModal/m);
  });

  it("must use next/dynamic for LoginModal in Navbar", () => {
    expect(src).toContain('import("./LoginModal")');
  });

  it("must use next/dynamic for RegisterModal in Navbar", () => {
    expect(src).toContain('import("./RegisterModal")');
  });
});

// ---------------------------------------------------------------------------
// Action D guard: LoginModal must be lazy in InfiniteScrollGrid
// ---------------------------------------------------------------------------

describe("CAM-200 Action D — LoginModal lazy in InfiniteScrollGrid", () => {
  const src = read("components/InfiniteScrollGrid.tsx");

  it("must not statically import LoginModal", () => {
    expect(src).not.toMatch(/^import\s+\{?\s*LoginModal/m);
  });

  it("must use next/dynamic for LoginModal", () => {
    expect(src).toContain('import("@/components/LoginModal")');
  });
});
