// @vitest-environment jsdom
/**
 * cam-539-image-placeholder.test.ts — CAM-539
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this file (the repo default
 * vitest environment stays `node`, see vitest.config.ts) — same pattern as
 * __tests__/cam-533-calendar-shape.test.ts. jsdom is needed here because the
 * errored-image case can only be proven by firing a REAL `error` event on the
 * committed <img>; `renderToStaticMarkup` never fires events, so a node-env test
 * could only have inferred that path from the source.
 *
 * Bug (owner report, 2026-07-26): "ช่วยปรับ icon image fallback ให้ใช้สี ไม่โปรงใส่
 * ลด Gray scell แทน เนื่องจากเส้นที่ทับกันจะดูพัง" — the image fallback read as a
 * broken image rather than as an empty photo slot.
 *
 * Two independent faults compounded, and this suite pins BOTH so neither can
 * come back on its own:
 *
 *   1. GLYPH. lucide `ImageOff` is the library's ERROR mark: 6 nodes including a
 *      full-canvas diagonal line (2,2)->(22,22) laid across a frame deliberately
 *      SPLIT into two disjoint arcs to clear it, plus a mountain line it crosses.
 *      Those intersections are the reported "เส้นที่ทับกัน". `ImageIcon` is 3
 *      nodes — one closed rect, a circle fully inside it, one mountain path —
 *      with no self-intersection. Asserted against the real lucide icon nodes,
 *      not against the icon's NAME, so the geometric property is what is pinned.
 *
 *   2. ALPHA. `text-muted-foreground/40` on `bg-muted` measured 1.63:1 light /
 *      2.15:1 dark — below the 3:1 non-text floor (WCAG 2.1 SC 1.4.11) in BOTH
 *      themes. The contrast assertions below RECOMPUTE the ratio from the real
 *      app/globals.css using the maths CAM-537 exported from
 *      scripts/check-contrast.mjs. No expected ratio is hardcoded: the test
 *      derives the number and compares it to the floor, so a later token repaint
 *      that breaks the placeholder fails here instead of silently passing.
 *
 * The a11y block re-pins today's wiring (role / aria-label / aria-hidden /
 * testid) precisely because CAM-539 is a VISUAL-only change: anything in that
 * block going red means the fix overreached.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import * as React from "react";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock next/image → a ref-forwarding <img> so assertions land on THIS component's
// wiring rather than next/image internals (the ir1/cam-393 precedent).
vi.mock("next/image", () => ({
  __esModule: true,
  default: React.forwardRef(function MockImage(
    props: {
      className?: string;
      src?: unknown;
      alt?: string;
      onError?: () => void;
      onLoad?: () => void;
    },
    ref: React.Ref<HTMLImageElement>
  ) {
    return React.createElement("img", {
      ref,
      className: props.className,
      src: typeof props.src === "string" ? props.src : "",
      alt: props.alt,
      onError: props.onError,
      onLoad: props.onLoad,
    });
  }),
}));

import { ImageWithFallback } from "../components/ui/image-with-fallback";
// The retired glyph, imported ONLY so the defect it caused is proven from the
// library itself rather than asserted from the ticket (see the BR-1 block).
import { ImageOff } from "lucide-react";

const IWF_PATH = resolve(__dirname, "../components/ui/image-with-fallback.tsx");
const iwfSrc = readFileSync(IWF_PATH, "utf-8");

const PLACEHOLDER = '[data-testid$="--fallback-placeholder"]';

afterEach(cleanup);

/* ────────────────────────────────────────────────────────────────────────────
   AC-1 / AC-2 / EC-1 / EC-2 — the placeholder renders in BOTH fallback cases
   ──────────────────────────────────────────────────────────────────────────── */

describe("CAM-539 AC-1/AC-2 — the placeholder renders for no-src and for errored", () => {
  it("[null/empty] AC-1/EC-1: no src → placeholder renders and keeps its testid", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, { alt: "no photo", "data-testid": "img--camp-card" })
    );
    // Prove-It: FAILS if the fallback branch stops rendering or the testid
    // suffix that other suites pin is renamed.
    const el = container.querySelector('[data-testid="img--camp-card--fallback-placeholder"]');
    expect(el).not.toBeNull();
  });

  it("[null/empty] EC-1: an explicitly empty/null src is still a fallback, not a broken <img>", () => {
    for (const src of ["", null, undefined]) {
      const { container } = render(
        React.createElement(ImageWithFallback, { src, alt: "no photo" })
      );
      expect(container.querySelector(PLACEHOLDER)).not.toBeNull();
      expect(container.querySelector("img")).toBeNull();
      cleanup();
    }
  });

  it("[error] AC-2/EC-2: a src that FAILS to load swaps to the same placeholder", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, {
        src: "/gone.jpg",
        alt: "broken photo",
        sizes: "50vw",
      })
    );
    // Before the error the real <img> is mounted and there is no placeholder.
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(container.querySelector(PLACEHOLDER)).toBeNull();

    // Fire the REAL error event — this is why the file runs under jsdom.
    fireEvent.error(img!);

    // Prove-It: FAILS if onError stops setting `errored`, or if the errored
    // branch is given a different visual from the no-src branch.
    expect(container.querySelector(PLACEHOLDER)).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("[unit] AC-1/AC-2: the errored and no-src cases render the SAME glyph markup", () => {
    // Both mean "no photo here" to a camper, so they deliberately share ONE
    // visual. Prove-It: FAILS if someone reintroduces a distinct error mark.
    const noSrc = render(React.createElement(ImageWithFallback, { alt: "x" }));
    const noSrcHtml = noSrc.container.querySelector(PLACEHOLDER)!.outerHTML;
    cleanup();

    const errored = render(
      React.createElement(ImageWithFallback, { src: "/gone.jpg", alt: "x", sizes: "50vw" })
    );
    fireEvent.error(errored.container.querySelector("img")!);
    const erroredHtml = errored.container.querySelector(PLACEHOLDER)!.outerHTML;

    expect(erroredHtml).toBe(noSrcHtml);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   BR-1 — the glyph carries no self-intersecting stroke
   Asserted against the real lucide icon nodes, so this pins the GEOMETRY that
   caused the owner's report, not merely the icon's name.
   ──────────────────────────────────────────────────────────────────────────── */

describe("CAM-539 BR-1 — the glyph is a whole frame, not a struck-through error mark", () => {
  /** The rendered SVG of the component's fallback glyph. */
  function renderedGlyph(): SVGElement {
    const { container } = render(React.createElement(ImageWithFallback, { alt: "x" }));
    return container.querySelector(PLACEHOLDER) as unknown as SVGElement;
  }

  it("[unit] BR-1: the retired glyph really does carry a full-canvas diagonal (the defect)", () => {
    // Documents WHY the swap happened, proven from the library's own render
    // rather than asserted from the ticket.
    const { container } = render(React.createElement(ImageOff));
    const svg = container.querySelector("svg")!;
    const diagonal = Array.from(svg.querySelectorAll("line")).some(
      (l) =>
        l.getAttribute("x1") === "2" &&
        l.getAttribute("y1") === "2" &&
        l.getAttribute("x2") === "22" &&
        l.getAttribute("y2") === "22"
    );
    expect(diagonal).toBe(true);
    // and its frame is SPLIT into arcs (no closed rect) to make room for it
    expect(svg.querySelectorAll("rect")).toHaveLength(0);
  });

  it("[unit] BR-1: the chosen glyph has NO slash — nothing crosses at 32px", () => {
    // A `line` node spanning the canvas is the slash the owner reported.
    // Prove-It: FAILS if the component is pointed back at any struck-through
    // "off" glyph, since every one of those carries the diagonal.
    expect(renderedGlyph().querySelectorAll("line")).toHaveLength(0);
  });

  it("[unit] BR-1: the chosen glyph's frame is ONE closed rect, not disjoint arcs", () => {
    expect(renderedGlyph().querySelectorAll("rect")).toHaveLength(1);
  });

  it("[unit] BR-1: the component renders that glyph and no longer imports ImageOff", () => {
    expect(iwfSrc).not.toContain("ImageOff");
    expect(iwfSrc).toContain("ImageIcon");
    // Aliased import — the file already imports `Image` from next/image, so an
    // unaliased lucide `Image` would collide.
    expect(iwfSrc).toMatch(/import\s*\{\s*ImageIcon\s*\}\s*from\s*["']lucide-react["']/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   BR-2 — solid colour, no alpha
   ──────────────────────────────────────────────────────────────────────────── */

describe("CAM-539 BR-2 — the glyph colour is a token at full opacity", () => {
  it("[unit] BR-2: the rendered glyph uses the muted-foreground token", () => {
    const { container } = render(React.createElement(ImageWithFallback, { alt: "x" }));
    const cls = container.querySelector(PLACEHOLDER)!.getAttribute("class") ?? "";
    expect(cls).toContain("text-muted-foreground");
  });

  it("[regression] EC-5: NO alpha modifier survives on the glyph's colour class", () => {
    const { container } = render(React.createElement(ImageWithFallback, { alt: "x" }));
    const cls = container.querySelector(PLACEHOLDER)!.getAttribute("class") ?? "";
    // Asserts the ABSENCE of an alpha suffix on any colour utility, rather than
    // the presence of one exact string — so `/40`, `/50`, `/[.4]`, any future
    // re-fade is caught, not just the one value CAM-539 removed.
    const alphaOnColour = cls.match(/\b(?:text|fill|stroke)-[a-z-]+\/(?:\d+|\[[^\]]+\])/g);
    expect(alphaOnColour).toBeNull();
  });

  it("[unit] BR-2: no hardcoded colour is introduced (token-only, DESIGN.md §6)", () => {
    const { container } = render(React.createElement(ImageWithFallback, { alt: "x" }));
    const el = container.querySelector(PLACEHOLDER)!;
    expect(el.getAttribute("class") ?? "").not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch)\(/i);
    expect(el.getAttribute("style")).toBeNull();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   AC-3 / AC-4 / BR-3 — measured contrast, RECOMPUTED from the real stylesheet
   ──────────────────────────────────────────────────────────────────────────── */

describe("CAM-539 AC-3/AC-4/BR-3 — the glyph clears the 3:1 non-text floor in BOTH themes", () => {
  // The floor for a non-text graphic that carries information (WCAG 2.1 SC
  // 1.4.11). It is NOT judged at the 4.5:1 body-text floor — the placeholder is
  // a shape, not copy.
  const NON_TEXT_FLOOR = 3;

  /** `check-contrast.mjs` is plain JS, so its token maps arrive untyped. */
  type TokenMap = Record<string, string>;

  /** Recompute {light,dark} ratios for the glyph on its frame from globals.css. */
  async function measureGlyphOnFrame() {
    const m = await import("../scripts/check-contrast.mjs");
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    const { light, dark } = m.parseTokens(css) as { light: TokenMap; dark: TokenMap };
    const out: Record<string, { full: number; at40: number }> = {};
    for (const [theme, tokens] of Object.entries({ light, dark })) {
      const frame = m.resolveSurface(tokens, "--muted");
      const glyph = m.resolveOver(tokens, "--muted-foreground", frame);
      // The pre-fix value, recomputed the same way, so the regression direction
      // is proven rather than asserted from the ticket.
      const faded = m.compositeOver(
        m.oklchToSrgb(m.parseOklch(tokens["--muted-foreground"])),
        0.4,
        frame
      );
      out[theme] = {
        full: m.contrastRatio(glyph, frame),
        at40: m.contrastRatio(faded, frame),
      };
    }
    return out;
  }

  it("[unit] AC-3: light mode clears the non-text floor", async () => {
    const { light } = await measureGlyphOnFrame();
    // Prove-It: FAILS if --muted-foreground or --muted is repainted such that
    // the placeholder stops being legible. Nothing here is hardcoded.
    expect(light.full).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
  });

  it("[unit] AC-4: dark mode clears the non-text floor", async () => {
    const { dark } = await measureGlyphOnFrame();
    expect(dark.full).toBeGreaterThanOrEqual(NON_TEXT_FLOOR);
  });

  it("[regression] BR-2/BR-3: the OLD /40 treatment provably failed the floor in both themes", () => {
    // This is the measurement that justifies the change. If a future refactor
    // makes /40 pass (i.e. the tokens moved a long way), this test goes red and
    // the design decision gets re-examined rather than silently inherited.
    return measureGlyphOnFrame().then(({ light, dark }) => {
      expect(light.at40).toBeLessThan(NON_TEXT_FLOOR);
      expect(dark.at40).toBeLessThan(NON_TEXT_FLOOR);
      // and the fix must be a real improvement, not a rounding win
      expect(light.full).toBeGreaterThan(light.at40);
      expect(dark.full).toBeGreaterThan(dark.at40);
    });
  });

  it("[unit] BR-4: no new token was invented for this — both are pre-existing", async () => {
    const m = await import("../scripts/check-contrast.mjs");
    const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");
    const { light, dark } = m.parseTokens(css) as {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
    for (const tokens of [light, dark]) {
      expect(tokens["--muted"]).toBeDefined();
      expect(tokens["--muted-foreground"]).toBeDefined();
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   AC-5 / AC-6 — nothing else moved (this is a visual-only change)
   ──────────────────────────────────────────────────────────────────────────── */

describe("CAM-539 AC-5 — the accessibility wiring is unchanged", () => {
  it("[a11y] AC-5: with alt, the wrapper is role=img + aria-label and the glyph is hidden", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, { alt: "ลานกางเต็นท์", "data-testid": "img--camp" })
    );
    const wrapper = container.querySelector('[data-testid="img--camp"]')!;
    expect(wrapper.getAttribute("role")).toBe("img");
    expect(wrapper.getAttribute("aria-label")).toBe("ลานกางเต็นท์");
    // The glyph must not announce — otherwise the slot is read out twice.
    expect(container.querySelector(PLACEHOLDER)!.getAttribute("aria-hidden")).toBe("true");
  });

  it("[a11y] EC-3: with no alt, the decorative slot is aria-hidden and has no role", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, { alt: "", "data-testid": "img--deco" })
    );
    const wrapper = container.querySelector('[data-testid="img--deco"]')!;
    expect(wrapper.getAttribute("aria-hidden")).toBe("true");
    expect(wrapper.getAttribute("role")).toBeNull();
  });

  it("[unit] AC-5: the glyph keeps its 32px size (the size was never the defect)", () => {
    const { container } = render(React.createElement(ImageWithFallback, { alt: "x" }));
    const cls = container.querySelector(PLACEHOLDER)!.getAttribute("class") ?? "";
    expect(cls).toContain("w-8");
    expect(cls).toContain("h-8");
  });
});

describe("CAM-539 AC-6 — the fade / LCP path is not perturbed", () => {
  it("[unit] AC-6: a priority (LCP hero) image still renders opaque immediately", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, {
        src: "/hero.jpg",
        alt: "hero",
        priority: true,
        sizes: "100vw",
      })
    );
    const cls = container.querySelector("img")!.getAttribute("class") ?? "";
    expect(cls).toContain("opacity-100");
    expect(cls).not.toContain("opacity-0");
  });

  it("[unit] AC-6: the frame keeps bg-muted so the slot stays reserved (CLS)", () => {
    const { container } = render(
      React.createElement(ImageWithFallback, { alt: "x", "data-testid": "img--frame" })
    );
    expect(container.querySelector('[data-testid="img--frame"]')!.getAttribute("class")).toContain(
      "bg-muted"
    );
  });

  it("[unit] AC-6/EC-4: the cached-image reconcile and onError wiring survive", () => {
    // Prove-It: FAILS if the CAM-393 already-complete guard or the error hook is
    // dropped while editing the placeholder beside them.
    expect(iwfSrc).toContain("imgRef.current?.complete === true");
    expect(iwfSrc).toContain("onError={() => setErrored(true)}");
    expect(iwfSrc).toContain("onLoad={() => setLoaded(true)}");
  });
});
