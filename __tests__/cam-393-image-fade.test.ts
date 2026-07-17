/**
 * cam-393-image-fade.test.ts — CAM-393: images fade into their reserved frame.
 *
 * Layer (two complementary parts, following the repo's ImageWithFallback
 * precedent in ir1-image-resilience.test.ts + the real-render approach in
 * status-map-shell.test.ts):
 *
 *   Part A — REAL render via `react-dom/server` `renderToStaticMarkup` (zero new
 *   deps, already used repo-wide). This exercises the ONE correctness property
 *   that runs at initial render (a `useState` initializer, not an effect):
 *   a `priority` (LCP hero) image renders OPAQUE immediately (no fade → LCP
 *   protected), while a non-priority image starts HIDDEN (opacity-0) so it can
 *   fade into its frame. A regression that flips this branch fails here where a
 *   pure source-grep would not.
 *
 *   Part B — source-inspection for the parts a static SSR render cannot fire:
 *   the onLoad reveal (event) and the already-complete/cached guard (effect +
 *   ref commit). Each carries a Prove-It note (the change that makes it red).
 *
 * next/image is mocked to a ref-forwarding <img> so the assertions land on THIS
 * component's opacity wiring, not next/image internals. Effects/refs do not run
 * under renderToStaticMarkup — documented, not hidden (same honest limitation
 * status-map-shell.test.ts records).
 */
import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { resolve } from "path";

// Mock next/image → a ref-forwarding <img> that passes className straight through.
vi.mock("next/image", () => ({
  __esModule: true,
  default: React.forwardRef(function MockImage(
    props: { className?: string; src?: unknown; alt?: string },
    ref: React.Ref<HTMLImageElement>
  ) {
    return React.createElement("img", {
      ref,
      className: props.className,
      src: typeof props.src === "string" ? props.src : "",
      alt: props.alt,
    });
  }),
}));

import { ImageWithFallback } from "../components/ui/image-with-fallback";

const iwfSrc = readFileSync(
  resolve(__dirname, "../components/ui/image-with-fallback.tsx"),
  "utf-8"
);

describe("CAM-393 ImageWithFallback — frame + fade-in (Part A: real render)", () => {
  it("[unit] AC-2/BR-2: a priority (LCP) image renders opaque immediately, no fade", () => {
    const html = renderToStaticMarkup(
      React.createElement(ImageWithFallback, {
        src: "/hero.jpg",
        alt: "hero",
        priority: true,
        sizes: "100vw",
      })
    );
    // Prove-It: FAILS if `useState(priority === true)` loses the priority seed
    // (hero would start opacity-0 → invisible until hydration → LCP regression).
    expect(html).toContain("opacity-100");
    expect(html).not.toContain("opacity-0");
  });

  it("[unit] AC-1: a non-priority image starts hidden (opacity-0) to fade into its frame", () => {
    const html = renderToStaticMarkup(
      React.createElement(ImageWithFallback, {
        src: "/card.jpg",
        alt: "card",
        sizes: "50vw",
      })
    );
    // Prove-It: FAILS if the opacity gate or the transition class is removed.
    expect(html).toContain("opacity-0");
    expect(html).toContain("motion-safe:transition-opacity");
  });

  it("[null/empty] AC-3: no src → fallback placeholder, no image opacity classes", () => {
    const html = renderToStaticMarkup(
      React.createElement(ImageWithFallback, { alt: "missing" })
    );
    expect(html).toContain("fallback-placeholder");
    expect(html).not.toContain("opacity-0");
  });
});

describe("CAM-393 ImageWithFallback — fade wiring (Part B: source, effect/event)", () => {
  it("[unit] AC-2: onLoad reveals the image (fade completes when the photo loads)", () => {
    // Prove-It: FAILS if the onLoad→setLoaded(true) handler is dropped.
    expect(iwfSrc).toContain("onLoad={() => setLoaded(true)}");
  });

  it("[boundary] EC-1: an already-complete (cached/SSR) image is revealed on mount", () => {
    // Prove-It: FAILS if the ref.complete guard is removed → stuck-invisible image.
    expect(iwfSrc).toContain("imgRef.current?.complete === true");
    expect(iwfSrc).toContain("ref={imgRef}");
  });

  it("[unit] BR-1: the fade respects prefers-reduced-motion (motion-safe only)", () => {
    expect(iwfSrc).toContain("motion-safe:transition-opacity");
  });

  it("[token] no hardcoded palette introduced (DESIGN.md, token-only)", () => {
    expect(iwfSrc).not.toMatch(/bg-gray-\d/);
    expect(iwfSrc).not.toMatch(/(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/);
  });
});
