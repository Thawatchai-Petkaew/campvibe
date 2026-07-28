/**
 * components/ai-chat/AiAmbientCanvas.tsx — CAM-426, frozen to a single static
 * paint by CAM-627
 *
 * Decorative campfire-night particle canvas for the น้องกองไฟ assistant
 * surface only (design.md §3, DESIGN.md §2.1 sanctioned exception). Renders
 * three dimmed camping gimmicks — fireflies, star sparkles, and rising
 * embers — positioned behind the panel's glass content (`absolute inset-0
 * -z-10`). Carries NO information: `aria-hidden`, `pointer-events-none`,
 * `role="presentation"`; never receives focus or a pointer event itself.
 *
 * CAM-627 (owner report, Golf: "ช่วยเอา animate ที่อยู่ใน chat ออกทั้งหมด
 * เพราะเครื่องร้อนมากตอนเปิด chat เหลือไว้แค่น้องกองไฟ" — the machine ran hot
 * for as long as the chat panel stayed open). Profiled with the panel open
 * and idle (Chrome/CDP trace, this machine): the continuous ~30fps
 * `requestAnimationFrame` loop this file used to run was the dominant,
 * clearly-attributable renderer-main-thread cost while idle (~630-665ms of
 * JS per 4s idle window with the loop running vs ~100-110ms with it
 * stopped — see the story's design.md for the full before/after numbers).
 * That loop is gone. `step()` below still runs the exact same throttle +
 * particle-update code (unchanged), but now exactly ONCE per trigger
 * (mount, resize, theme change, tab-foreground, motion-preference change)
 * instead of forever — one frozen frame, not a loop. `drawStaticFrame()`
 * (the pre-existing reduced-motion fallback, stars only) is UNTOUCHED, so
 * reduced-motion campers see exactly what they always saw.
 *
 * What the panel loses: continuous drift/twinkle for stars/fireflies/embers
 * and the fireflies-follow-cursor interactivity (meaningless without a
 * repeating loop, so that pointer-tracking code is retired, not frozen).
 * What it keeps: the full three-layer camping-night composition (stars +
 * fireflies + embers), painted once per trigger instead of never re-painted
 * — so a resize, a light/dark toggle, or returning to the tab still shows a
 * correct, current-size, current-theme frame; it just never animates.
 *
 * Perf caps that still apply (design.md §3): particle cap halved on narrow
 * viewport / low-core devices, DPR capped at 2, and colors are read from the
 * `--ai-ember` / `--ai-firefly` / `--ai-star` custom properties via
 * `getComputedStyle` — never a hardcoded color literal in this file, so
 * `check:palette` stays green and the canvas tracks the active theme.
 *
 * Mounted via `next/dynamic(ssr:false)` from `AiChatPanel` — a canvas has
 * no server-render value and this keeps its JS out of the panel's critical
 * first-load chunk.
 */
"use client";

import { useEffect, useRef } from "react";

/** Desktop particle ceiling (design.md §3); halved on narrow viewport / <=4 cores. */
const DESKTOP_CAP = { fireflies: 12, stars: 20, embers: 10 };
const NARROW_BREAKPOINT_PX = 768; // Tailwind `md`
const FRAME_INTERVAL_MS = 1000 / 30; // throttle floor for the one-shot paint below

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
}

/** Reads a token color from CSS custom properties — never a literal in this file. */
function readTokenColor(varName: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || "currentColor";
}

export function AiAmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const ctx2d = canvasEl?.getContext("2d");
    if (!canvasEl || !ctx2d) return;
    // Re-bind with an explicit non-null type: control-flow narrowing above does
    // not propagate into the nested function declarations below, so these two
    // declared-type bindings (not just narrowed ones) are what those closures use.
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctx2d;

    let lastFrameAt = 0;
    let width = 0;
    let height = 0;
    let fireflies: Particle[] = [];
    let stars: Particle[] = [];
    let embers: Particle[] = [];
    let colors = {
      ember: readTokenColor("--ai-ember"),
      firefly: readTokenColor("--ai-firefly"),
      star: readTokenColor("--ai-star"),
    };
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: no-preference)");

    function particleCap() {
      const narrow = window.innerWidth < NARROW_BREAKPOINT_PX;
      const lowCpu = (navigator.hardwareConcurrency ?? 8) <= 4;
      const halve = narrow || lowCpu;
      return {
        fireflies: halve ? Math.round(DESKTOP_CAP.fireflies / 2) : DESKTOP_CAP.fireflies,
        stars: halve ? Math.round(DESKTOP_CAP.stars / 2) : DESKTOP_CAP.stars,
        embers: halve ? Math.round(DESKTOP_CAP.embers / 2) : DESKTOP_CAP.embers,
      };
    }

    function seed() {
      const { fireflies: fCount, stars: sCount, embers: eCount } = particleCap();
      fireflies = Array.from({ length: fCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        phase: Math.random() * Math.PI * 2,
        size: 1.5 + Math.random() * 1.5,
      }));
      stars = Array.from({ length: sCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.7,
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        size: 0.75 + Math.random() * 1,
      }));
      embers = Array.from({ length: eCount }, () => ({
        x: Math.random() * width,
        y: height + Math.random() * height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -(0.15 + Math.random() * 0.2),
        phase: Math.random() * Math.PI * 2,
        size: 1.5 + Math.random() * 1.5,
      }));
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      // CAM-627: assigning canvas.width/height clears the bitmap — repaint
      // immediately so a resize (e.g. the panel's expand/collapse toggle)
      // never leaves the canvas blank now that nothing loops.
      start();
    }

    function drawStaticFrame() {
      // Reduced-motion fallback (unchanged by CAM-627): one dim, static star
      // frame — no rAF, no other particle layers.
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.star;
      ctx.globalAlpha = 0.35;
      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // CAM-627: this used to reschedule itself via requestAnimationFrame and
    // run forever (the continuous ~30fps loop this story measured and
    // removed). It still runs the exact same throttle check + particle
    // update/draw code, but now only once per call — a single frozen frame
    // showing all three layers (stars, fireflies, embers) at once.
    function step(now: number) {
      if (now - lastFrameAt < FRAME_INTERVAL_MS) return;
      lastFrameAt = now;
      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      // star sparkles
      ctx.fillStyle = colors.star;
      for (const star of stars) {
        star.phase += 0.02;
        ctx.globalAlpha = 0.55 * (0.5 + 0.5 * Math.sin(star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // fireflies (frozen at their seeded drift position — no cursor-follow;
      // meaningless without a repeating loop, so that behavior is retired)
      ctx.fillStyle = colors.firefly;
      for (const fly of fireflies) {
        fly.x += fly.vx;
        fly.y += fly.vy;
        if (fly.x < 0 || fly.x > width) fly.vx *= -1;
        if (fly.y < 0 || fly.y > height) fly.vy *= -1;
        fly.phase += 0.03;
        ctx.globalAlpha = 0.45 * (0.4 + 0.6 * Math.sin(fly.phase));
        ctx.beginPath();
        ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // rising embers, frozen mid-rise
      ctx.fillStyle = colors.ember;
      for (const ember of embers) {
        ember.x += ember.vx;
        ember.y += ember.vy;
        if (ember.y < -10) {
          ember.y = height + 10;
          ember.x = Math.random() * width;
        }
        ctx.globalAlpha = 0.4 * Math.max(0, 1 - ember.y / height);
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, ember.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    // CAM-627: no longer starts a loop — paints exactly one frame. Reduced
    // motion (unchanged branch/behavior) gets the pre-existing stars-only
    // static frame; everyone else gets the fuller one-shot step() paint.
    function start() {
      if (!reducedMotionQuery.matches) {
        drawStaticFrame();
        return;
      }
      step(performance.now());
    }

    function handleVisibility() {
      // CAM-627: nothing to pause/resume anymore (no loop) — repaint once on
      // return to the tab in case the theme or viewport changed while hidden.
      if (!document.hidden) start();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const themeObserver = new MutationObserver(() => {
      colors = {
        ember: readTokenColor("--ai-ember"),
        firefly: readTokenColor("--ai-firefly"),
        star: readTokenColor("--ai-star"),
      };
      start(); // CAM-627: repaint immediately so a light/dark toggle isn't stuck on stale colors.
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", start);

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", start);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      role="presentation"
      data-testid="canvas--ai-ambient"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
