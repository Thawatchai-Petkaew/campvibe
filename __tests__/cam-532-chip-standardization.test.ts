/**
 * cam-532-chip-standardization.test.ts — CAM-532 (S5)
 *
 * "Every selectable chip looks and behaves the same."
 *
 * Layer: unit — the URL rule is exercised as REAL behavior (the exported pure
 * `buildCategoryUrl` + a real `URLSearchParams`), the guard is exercised as the
 * REAL detector imported from `scripts/check-ds.mjs`, and only the JSX wiring
 * that has no runtime handle is source-inspected (this repo's vitest runs
 * `environment: 'node'`, no jsdom — see cam-529/cam-531 for the convention).
 *
 * AC coverage:
 *   AC-1  SearchModal renders FilterChip; no hand-rolled pill markup survives
 *   AC-2  every interaction state comes from the primitive, none from the consumer
 *   AC-3  a date-only search preserves a multi-value terrain CSV (the clobber fix)
 *   AC-4  tapping a pill REPLACES the CSV with one code (CAM-529 BR-2)
 *   AC-5  one pill list — CategoryBar's exported CATEGORIES, no second copy
 *   AC-6  check:ds R9 fires on a hand-rolled pill and never on FilterChip itself
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

import { buildCategoryUrl, CATEGORIES } from "../components/CategoryBar";
// The REAL guard implementation — not a copy of its regexes. Importing it also
// proves the module is import-safe (it must not scan the repo or process.exit
// unless invoked as a CLI); the CLI path is asserted separately below.
import { detectHandRolledPills } from "../scripts/check-ds.mjs";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const modalSrc = read("components/SearchModal.tsx");
const chipSrc = read("components/ui/filter-chip.tsx");

// ─────────────────────────────────────────────────────────────
// AC-1 / AC-2 — the primitive owns the chip; the consumer owns nothing
// ─────────────────────────────────────────────────────────────

describe("AC-1: SearchModal renders the FilterChip primitive, not a hand-rolled pill", () => {
  it("[structural] imports and renders <FilterChip variant=\"pill\">", () => {
    expect(modalSrc).toContain('from "@/components/ui/filter-chip"');
    expect(modalSrc).toMatch(/<FilterChip\b/);
    expect(modalSrc).toContain('variant="pill"');
  });

  it("[structural] every drifted className from the hand-rolled pill is gone", () => {
    // The six documented drifts (design.md §Root cause) — deleted, not ported.
    expect(modalSrc).not.toContain("shadow-primary/20");
    expect(modalSrc).not.toContain("transition-all");
    expect(modalSrc).not.toContain("bg-background text-muted-foreground");
    expect(modalSrc).not.toContain("w-3.5 h-3.5");
    expect(modalSrc).not.toMatch(/px-5 h-11 rounded-full border/);
  });

  it("[structural] the modal contains no <button> at all — every control is a primitive", () => {
    expect(modalSrc).not.toMatch(/<button\b/);
  });
});

describe("AC-2: interaction states come from the primitive, never from the consumer", () => {
  it("[structural] FilterChip owns hover, focus ring, active, disabled and the 44px tap target", () => {
    expect(chipSrc).toContain("h-11");
    expect(chipSrc).toContain("min-w-[44px]");
    expect(chipSrc).toContain("rounded-full");
    expect(chipSrc).toContain("hover:border-foreground");
    expect(chipSrc).toContain("hover:bg-primary/85");
    expect(chipSrc).toContain("focus-visible:ring-2");
    expect(chipSrc).toContain("focus-visible:ring-ring");
    expect(chipSrc).toContain("active:scale-95");
    // CAM-662 — opacity may never de-emphasize a control; disabled is now a
    // flat solid fill/text pair (bg-disabled/text-disabled-foreground), not opacity-50.
    expect(chipSrc).toContain("disabled && \"border-transparent bg-disabled text-disabled-foreground pointer-events-none\"");
    expect(chipSrc).not.toMatch(/disabled && "opacity-50/);
  });

  it("[structural] selected state is bg-primary text-primary-foreground (DESIGN.md §3 Chip family)", () => {
    expect(chipSrc).toContain("border-primary bg-primary text-primary-foreground");
    // The retired wording must not come back into the primitive.
    expect(chipSrc).not.toContain("bg-foreground text-background");
  });

  it("[structural] selection is exposed to assistive tech, not by color alone", () => {
    expect(chipSrc).toContain("aria-pressed={selected}");
  });

  it("[structural] DESIGN.md states the same selected treatment the primitive implements", () => {
    const design = read("DESIGN.md");
    expect(design).toContain("bg-primary text-primary-foreground border-primary");
    expect(design).not.toMatch(/selected = `bg-foreground text-background`/);
  });
});

// ─────────────────────────────────────────────────────────────
// AC-5 — one list, no copy
// ─────────────────────────────────────────────────────────────

describe("AC-5: the pill list has exactly one source", () => {
  it("[structural] SearchModal imports CATEGORIES/buildCategoryUrl and declares no list of its own", () => {
    expect(modalSrc).toContain('from "@/components/CategoryBar"');
    expect(modalSrc).toContain("CATEGORIES");
    expect(modalSrc).toContain("buildCategoryUrl");
    expect(modalSrc).not.toContain("EXPERIENCE_TYPES");
    expect(modalSrc).not.toMatch(/labelKey:\s*['"]campground['"]/);
  });

  it("[unit] the shared list carries the CAM-529 additions the old copy was missing", () => {
    const values = CATEGORIES.map((c) => `${c.param}:${c.value}`);
    expect(values).toContain("type:GLAMP");
    expect(values).toContain("terrain:SEA");
    expect(values).toContain("terrain:WATF");
  });

  it("[structural] labels still resolve through locales/, never inline copy", () => {
    expect(modalSrc).toContain("{(t.categories as any)[item.labelKey]}");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-3 / AC-4 — the terrain clobber fix (Prove-It: fails on the old code)
// ─────────────────────────────────────────────────────────────

/** Mirrors SearchModal.handleSearch's category step exactly (BR-3/BR-4). */
function categoryUrlFor(selectedKey: string | null, params: URLSearchParams): string {
  const selected = CATEGORIES.find((item) => item.labelKey === selectedKey);
  const query = params.toString();
  return selected ? buildCategoryUrl(selected, params) : query ? `/?${query}` : "/";
}

/** Mirrors resolveSelectedExperience (kept in sync by the structural test below). */
function resolveSelected(params: URLSearchParams): string | null {
  const typeParam = params.get("type");
  const terrainParam = params.get("terrain");
  if (!typeParam && !terrainParam) return "all";
  if (typeParam && terrainParam) return null;
  const match = CATEGORIES.find((item) => {
    if (item.param === "type") return typeParam === item.value;
    if (item.param === "terrain") return terrainParam === item.value;
    return false;
  });
  return match ? match.labelKey : null;
}

describe("AC-3 [Prove-It]: a date-only search preserves a multi-value terrain CSV", () => {
  it("[unit] terrain=SEA,WATF survives pressing search with only the dates changed", () => {
    const params = new URLSearchParams("terrain=SEA,WATF");
    const selected = resolveSelected(params); // no pill can represent a CSV
    expect(selected).toBeNull();

    params.set("startDate", "2026-08-01");
    const url = categoryUrlFor(selected, params);

    expect(new URLSearchParams(url.split("?")[1]).get("terrain")).toBe("SEA,WATF");
    expect(url).toContain("startDate=2026-08-01");
  });

  it("[unit] an unknown terrain code is preserved too, never silently dropped", () => {
    const params = new URLSearchParams("terrain=CAVE&keyword=เขาใหญ่");
    expect(resolveSelected(params)).toBeNull();
    const url = categoryUrlFor(resolveSelected(params), params);
    expect(new URLSearchParams(url.split("?")[1]).get("terrain")).toBe("CAVE");
  });

  it("[unit] type and terrain both set is not representable, so both are preserved", () => {
    const params = new URLSearchParams("type=CAGD&terrain=BEAC");
    expect(resolveSelected(params)).toBeNull();
    const query = new URLSearchParams(categoryUrlFor(null, params).split("?")[1]);
    expect(query.get("type")).toBe("CAGD");
    expect(query.get("terrain")).toBe("BEAC");
  });

  it("[unit] params this row does not own are never touched", () => {
    const params = new URLSearchParams("terrain=SEA,WATF&access=DRIV&province=Chiang Mai");
    const query = new URLSearchParams(categoryUrlFor(resolveSelected(params), params).split("?")[1]);
    expect(query.get("access")).toBe("DRIV");
    expect(query.get("province")).toBe("Chiang Mai");
  });
});

describe("AC-4: an explicit pill tap REPLACES the owned param (CAM-529 BR-2, never merges)", () => {
  it("[unit] tapping ภูเขา over terrain=SEA,WATF yields terrain=MTNS only", () => {
    const params = new URLSearchParams("terrain=SEA,WATF&access=DRIV");
    const query = new URLSearchParams(categoryUrlFor("mountain", params).split("?")[1]);
    expect(query.get("terrain")).toBe("MTNS");
    expect(query.get("access")).toBe("DRIV");
  });

  it("[unit] tapping a type pill clears the other dimension (mutual exclude)", () => {
    const params = new URLSearchParams("terrain=SEA,WATF");
    const query = new URLSearchParams(categoryUrlFor("campground", params).split("?")[1]);
    expect(query.get("type")).toBe("CAGD");
    expect(query.get("terrain")).toBeNull();
  });

  it("[unit] tapping ทั้งหมด clears both category params but keeps the rest", () => {
    const params = new URLSearchParams("type=CAGD&keyword=ริมน้ำ&guests=2");
    const query = new URLSearchParams(categoryUrlFor("all", params).split("?")[1]);
    expect(query.get("type")).toBeNull();
    expect(query.get("terrain")).toBeNull();
    expect(query.get("keyword")).toBe("ริมน้ำ");
    expect(query.get("guests")).toBe("2");
  });

  it("[structural] the component uses buildCategoryUrl and no longer deletes terrain blindly", () => {
    expect(modalSrc).toContain("buildCategoryUrl(selected, params)");
    expect(modalSrc).not.toContain('params.delete("terrain")');
    expect(modalSrc).not.toContain('params.delete("type")');
  });

  it("[structural] resolveSelectedExperience can return null (the unrepresentable state)", () => {
    expect(modalSrc).toContain("function resolveSelectedExperience(searchParams: URLSearchParams): string | null");
    expect(modalSrc).toContain("if (typeParam && terrainParam) return null;");
    expect(modalSrc).toContain("useState(() => resolveSelectedExperience(searchParams))");
  });
});

// ─────────────────────────────────────────────────────────────
// AC-6 — the guard, proven in BOTH directions
// ─────────────────────────────────────────────────────────────

// A synthetic hand-rolled pill: byte-shaped like the one CAM-532 deleted.
const HAND_ROLLED_PILL_FIXTURE = `
export function ExperienceRow({ items, selected, onPick }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = selected === item.key;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(item.key)}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-full border transition-all text-sm",
              active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
            )}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
`;

describe("AC-6: check:ds R9 fires on a hand-rolled pill", () => {
  it("[unit] flags the synthetic hand-rolled <button> pill with its line number", () => {
    const hits = detectHandRolledPills(HAND_ROLLED_PILL_FIXTURE, "components/Fixture.tsx");
    expect(hits).toHaveLength(1);
    expect(hits[0].file).toBe("components/Fixture.tsx");
    expect(hits[0].line).toBeGreaterThan(0);
    expect(hits[0].match).toContain("rounded-full + border + selected state");
  });

  it("[unit] flags a <div role=\"button\"> pill too (the same drift wearing a div)", () => {
    const src = `<div role="button" aria-pressed={isSelected} className="rounded-full border px-4 h-11">x</div>`;
    expect(detectHandRolledPills(src, "components/Fixture.tsx")).toHaveLength(1);
  });

  it("[unit] flags a selected-conditional pill even with no aria-pressed", () => {
    const src = `<button className={cn("rounded-full border h-11", selected ? "bg-primary" : "bg-card")}>x</button>`;
    expect(detectHandRolledPills(src, "components/Fixture.tsx")).toHaveLength(1);
  });
});

describe("AC-6 / EC-5: check:ds R9 does NOT fire on legitimate markup", () => {
  it("[unit] is silent on the real FilterChip primitive", () => {
    expect(detectHandRolledPills(chipSrc, "components/ui/filter-chip.tsx")).toHaveLength(0);
  });

  it("[unit] the FilterChip exemption is load-bearing, not a coincidence", () => {
    // Same source, primitive declaration renamed: the rule DOES fire, proving
    // the exemption (not a weak heuristic) is what keeps the primitive clean.
    const renamed = chipSrc.replace("export function FilterChip", "export function HandRolled");
    expect(detectHandRolledPills(renamed, "components/HandRolled.tsx").length).toBeGreaterThan(0);
  });

  it("[unit] is silent on a consumer that uses the primitive (SearchModal today)", () => {
    expect(detectHandRolledPills(modalSrc, "components/SearchModal.tsx")).toHaveLength(0);
  });

  it("[unit] is silent on CategoryBar (an underline nav tab, not a chip)", () => {
    const bar = read("components/CategoryBar.tsx");
    expect(detectHandRolledPills(bar, "components/CategoryBar.tsx")).toHaveLength(0);
  });

  it("[unit] is silent on a plain rounded-full icon button with no selected state", () => {
    const src = `<button aria-label="ปิด" className="rounded-full border size-11"><X /></button>`;
    expect(detectHandRolledPills(src, "components/Fixture.tsx")).toHaveLength(0);
  });

  it("[unit] is silent on a selectable control that is NOT pill-shaped", () => {
    const src = `<button aria-pressed={active} className="rounded-2xl border h-32">card</button>`;
    expect(detectHandRolledPills(src, "components/Fixture.tsx")).toHaveLength(0);
  });

  it("[unit] a > inside an arrow-function attribute does not truncate the tag scan", () => {
    // If readOpeningTag stopped at the "=>" the className would never be seen.
    const src = `<button onClick={() => setOpen(true)} aria-pressed={active} className="rounded-full border h-11">x</button>`;
    expect(detectHandRolledPills(src, "components/Fixture.tsx")).toHaveLength(1);
  });
});

describe("AC-6: the guard is wired into the real CLI (a rule nobody runs is not a guard)", () => {
  it("[integration] npm run check:ds prints the R9 row and passes repo-wide (backlog 0)", () => {
    const out = execSync("npm run check:ds", {
      cwd: resolve(__dirname, ".."),
      encoding: "utf-8",
    });
    expect(out).toContain("R9  Hand-rolled selectable pill");
    expect(out).toMatch(/ok\s+\(0\)\s+R9/);
    expect(out).toContain("check:ds — PASS (0 violations)");
  });

  it("[structural] the rollout mode + measured backlog are recorded in the guard source", () => {
    const guard = read("scripts/check-ds.mjs");
    expect(guard).toMatch(/const R9_MODE = "(blocking|report)"/);
    expect(guard).toContain("backlog = 1");
    expect(guard).toContain("backlog = 0");
  });
});
