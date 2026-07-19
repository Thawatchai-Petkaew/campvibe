/**
 * components/ai-chat/AiAmbientCanvas.tsx — CAM-426
 *
 * Decorative campfire-night particle canvas for the น้องกองไฟ assistant
 * surface only (design.md §3, DESIGN.md §2.1 sanctioned exception). Renders
 * three dimmed camping gimmicks — fireflies-follow-cursor, star sparkles,
 * and rising embers — positioned behind the panel's glass content
 * (`absolute inset-0 -z-10`). Carries NO information: `aria-hidden`,
 * `pointer-events-none`, `role="presentation"`; never receives focus or a
 * pointer event itself.
 *
 * Perf caps (mandatory, design.md §3): particle cap halved on narrow
 * viewport / low-core devices, a ~30fps rAF throttle via a delta
 * accumulator (particle arrays pre-allocated once, no per-frame alloc),
 * pause on hidden tab (`visibilitychange`), DPR capped at 2, and the whole
 * loop gated on `prefers-reduced-motion: no-preference` (re-checked on the
 * media-query `change` event) — under reduce-motion it paints one static
 * dim star frame and never starts `requestAnimationFrame`.
 *
 * Colors are read from the `--ai-ember` / `--ai-firefly` / `--ai-star`
 * custom properties via `getComputedStyle` on mount and re-read whenever
 * the `<html>` element's `class` attribute changes (light/dark toggle) —
 * never a hardcoded color literal in this file, so `check:palette` stays
 * green and the canvas tracks the active theme automatically.
 *
 * Mounted via `next/dynamic(ssr:false)` from `AiChatPanel` — a canvas has
 * no server-render value and this keeps its JS out of the panel's critical
 * first-load chunk. CWV impact: not measured (design.md §3 budget note);
 * the throttle + cap + hidden-pause are the guardrails.
 */
"use client";

import { useEffect, useRef } from "react";

/** Desktop particle ceiling (design.md §3); halved on narrow viewport / <=4 cores. */
const DESKTOP_CAP = { fireflies: 12, stars: 20, embers: 10 };
const NARROW_BREAKPOINT_PX = 768; // Tailwind `md`
const FRAME_INTERVAL_MS = 1000 / 30; // ~30fps throttle

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

    let rafId: number | null = null;
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
    const pointer = { x: -1000, y: -1000, active: false };
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
    }

    function drawStaticFrame() {
      // Reduced-motion fallback: one dim, static star frame — no rAF started.
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

    function step(now: number) {
      rafId = requestAnimationFrame(step);
      if (now - lastFrameAt < FRAME_INTERVAL_MS) return;
      lastFrameAt = now;
      if (width === 0 || height === 0) return;

      ctx.clearRect(0, 0, width, height);

      // star sparkles: static position, twinkling opacity (max alpha 0.55)
      ctx.fillStyle = colors.star;
      for (const star of stars) {
        star.phase += 0.02;
        ctx.globalAlpha = 0.55 * (0.5 + 0.5 * Math.sin(star.phase));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // fireflies-follow-cursor: drift; a subset eases toward the pointer (max alpha 0.45)
      ctx.fillStyle = colors.firefly;
      fireflies.forEach((fly, i) => {
        if (pointer.active && i % 2 === 0) {
          fly.vx += (pointer.x - fly.x) * 0.0006;
          fly.vy += (pointer.y - fly.y) * 0.0006;
          fly.vx *= 0.96;
          fly.vy *= 0.96;
        }
        fly.x += fly.vx;
        fly.y += fly.vy;
        if (fly.x < 0 || fly.x > width) fly.vx *= -1;
        if (fly.y < 0 || fly.y > height) fly.vy *= -1;
        fly.phase += 0.03;
        ctx.globalAlpha = 0.45 * (0.4 + 0.6 * Math.sin(fly.phase));
        ctx.beginPath();
        ctx.arc(fly.x, fly.y, fly.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // rising embers: rise + drift sideways, fade near the top, respawn (max alpha 0.40)
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

    function stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function start() {
      stop();
      if (!reducedMotionQuery.matches) {
        drawStaticFrame();
        return;
      }
      lastFrameAt = 0;
      rafId = requestAnimationFrame(step);
    }

    function handleVisibility() {
      if (document.hidden) stop();
      else start();
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    }

    function handlePointerLeave() {
      pointer.active = false;
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
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", start);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", start);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
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
