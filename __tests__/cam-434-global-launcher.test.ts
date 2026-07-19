/**
 * cam-434-global-launcher.test.ts — CAM-434
 *
 * "Chat launcher on EVERY page (move to root layout, not Home-only)" —
 * owner staging feedback D. Full spec:
 * docs/specs/ai-assistant/chat-experience-overhaul/CAM-434-global-launcher/story.md
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'` with no jsdom — see cam-272-ai-chat-components
 * .test.ts for the established convention); rendered-DOM behaviour is
 * proven by reading the shipped source for the exact wiring the AC rows
 * require.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const layoutSrc = read("app/layout.tsx");
const pageSrc = read("app/page.tsx");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");

describe("AC-1/AC-2 — launcher mounts globally from the root layout, not Home", () => {
  it("[structural] app/layout.tsx imports and mounts AiChatLauncher inside the client provider tree", () => {
    expect(layoutSrc).toContain('import { AiChatLauncher } from "@/components/ai-chat/AiChatLauncher"');
    expect(layoutSrc).toContain("<AiChatLauncher />");
  });

  it("[structural] the mount sits inside LanguageProvider (useLanguage() must be in scope)", () => {
    const providerIdx = layoutSrc.indexOf("<LanguageProvider>");
    const launcherIdx = layoutSrc.indexOf("<AiChatLauncher />");
    const closeIdx = layoutSrc.indexOf("</LanguageProvider>");
    expect(providerIdx).toBeGreaterThan(-1);
    expect(launcherIdx).toBeGreaterThan(providerIdx);
    expect(launcherIdx).toBeLessThan(closeIdx);
  });

  it("[structural] app/page.tsx no longer imports or mounts AiChatLauncher (single instance, no duplicate)", () => {
    expect(pageSrc).not.toContain("AiChatLauncher");
  });
});

describe("AC-3 — the panel + ambient canvas stay lazy on every route (no new bundle cost)", () => {
  it("[unit] AiChatPanel is still next/dynamic(ssr:false) and only mounts after the first tap", () => {
    expect(launcherSrc).toContain('import dynamic from "next/dynamic"');
    expect(launcherSrc).toContain("ssr: false");
    expect(launcherSrc).toContain("{open && <AiChatPanel");
  });
});

describe("AC-4/AC-5 — route-hide guard excludes internal, non-consumer surfaces", () => {
  it("[unit] isHiddenRoute excludes /status (+ sub-paths) and /coming-soon", () => {
    expect(launcherSrc).toContain('pathname === "/coming-soon"');
    expect(launcherSrc).toContain('pathname === "/status"');
    expect(launcherSrc).toContain('pathname.startsWith("/status/")');
  });

  it("[structural] the guard returns null before any decorative/interactive markup renders", () => {
    expect(launcherSrc).toMatch(/if\s*\(isHiddenRoute\(pathname\)\)\s*return null;/);
  });

  it("[unit] usePathname is imported from next/navigation (App Router idiom)", () => {
    expect(launcherSrc).toContain('import { usePathname } from "next/navigation"');
  });
});
