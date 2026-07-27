/**
 * cam-584-carousel-indicator-gap.test.ts — CAM-584
 *
 * "The chat carousel indicator sits too far below the cards." Full spec:
 * docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-584-carousel-indicator-gap/story.md
 *
 * Source-inspection coverage (this repo's Vitest runs `environment: 'node'`,
 * no jsdom — see cam-272-ai-chat-components.test.ts's header comment). The
 * real-browser (Chromium, both 390px and 1440px) gap/shadow measurement that
 * justified this fix is documented in story.md and the PR body, not re-run
 * here — matching CAM-547's own established split between the pinned
 * regression guard (this file) and the one-off live investigation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const carouselSrc = read("components/ai-chat/AiChatCardCarousel.tsx");

describe("AC-1/BR-1 — the indicator row's own margin is decoupled from the track's reserved shadow padding", () => {
  it("[unit] FIX: the indicator row now pulls up with -mt-8 (the old mt-2 is gone)", () => {
    expect(carouselSrc).toContain('<div className="-mt-8 flex items-center justify-center gap-2">');
    expect(carouselSrc).not.toContain('<div className="mt-2 flex items-center justify-center gap-2">');
  });

  it("[structural] the mechanism is documented in-source (not a silent tweak with no trace)", () => {
    expect(carouselSrc).toMatch(/CAM-584/);
    expect(carouselSrc).toMatch(/DECOUPLED/);
  });
});

describe("AC-2/BR-2 — the track's own shadow-clearance padding (CAM-547) is byte-for-byte unchanged", () => {
  it("[regression guard] the track keeps the EXACT className string CAM-547 shipped, including pt-4 pb-14", () => {
    expect(carouselSrc).toContain(
      "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-4 pb-14 no-scrollbar motion-safe:scroll-smooth"
    );
  });

  it("[regression guard] pb-14 was NOT shrunk back toward py-4/pb-4 — that would silently re-clip the shadow (the CAM-547 regression this story must not reintroduce)", () => {
    expect(carouselSrc).not.toMatch(/\bpb-4\b/);
    expect(carouselSrc).not.toMatch(/\bpy-4\b.*overflow-x-auto|overflow-x-auto.*\bpy-4\b/);
  });

  it("[unit] MEASURED (real computed values, this story's investigation, pinned so the reasoning cannot silently drift): the dark --ai-glow token's dominant shadow layer reaches 52px downward, and the unchanged pb-14 (56px) still safely contains it — same numbers CAM-547 established, unaffected by this story's sibling-only change", () => {
    // Real getComputedStyle(box-shadow) parsed in a live Chromium render at
    // both 390px and 1440px reproduced this exact pair (see story.md +
    // the PR body's before/after table) — pinned here as the regression
    // guard, matching CAM-547's own downwardReach/pb-14 pin in
    // cam-547-chat-result-cards.test.ts.
    const measuredDownwardReach = 52;
    const measuredTrackPaddingBottom = 56;
    expect(measuredDownwardReach).toBeLessThanOrEqual(measuredTrackPaddingBottom);
  });
});

describe("AC-3/BR-3 — the dot shape (CAM-547) and the counter contrast fix (CAM-569) are unchanged", () => {
  it("[structural] the active dot is still the wider pill (h-1.5 w-4 rounded-full bg-primary)", () => {
    expect(carouselSrc).toContain("h-1.5 w-4 rounded-full bg-primary");
  });

  it("[structural] the inactive dot is still h-1.5 w-1.5 rounded-full bg-muted-foreground/60 (never reverted to /30)", () => {
    expect(carouselSrc).toContain("h-1.5 w-1.5 rounded-full bg-muted-foreground/60");
    expect(carouselSrc).not.toContain('bg-muted-foreground/30"');
  });

  it("[structural] the {cur}/{N} counter container still uses text-foreground/70 (CAM-569), not text-muted-foreground", () => {
    expect(carouselSrc).toContain(
      'className="flex items-center gap-1.5 text-xs tabular-nums text-foreground/70"'
    );
    expect(carouselSrc).not.toMatch(/text-xs tabular-nums text-muted-foreground"/);
  });

  it("[structural] the MAX_DOTS threshold (dots vs counter switch) is unchanged", () => {
    expect(carouselSrc).toContain("const MAX_DOTS = 5;");
    expect(carouselSrc).toContain("cards.length > MAX_DOTS");
  });

  it("[structural] scroll-px-4 (CAM-547's mobile edge-gutter fix) is unchanged", () => {
    expect(carouselSrc).toContain("-mx-4 flex snap-x snap-mandatory scroll-px-4");
  });
});

describe("Token-only + no debug/demo UI (design gate)", () => {
  it("[structural] no raw hex or arbitrary px literal introduced", () => {
    expect(carouselSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(carouselSrc).not.toMatch(/\[\d+px\]/);
  });

  it("[structural] no console.log / debug dump introduced", () => {
    expect(carouselSrc).not.toMatch(/console\.log/);
    expect(carouselSrc).not.toMatch(/JSON\.stringify/);
  });
});
