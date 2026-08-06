// @vitest-environment jsdom
/**
 * cam-688-router-optional.test.ts — CAM-688
 *
 * BR-4 (router.refresh() after an in-session switch, so the server-rendered
 * <html lang> does not go stale) requires calling `useRouter()` from
 * next/navigation. Outside a real Next.js App Router tree, that hook throws
 * ("invariant expected app router to be mounted") -- true for several of
 * the 9 pre-existing test files that mount LanguageProvider bare with no
 * next/navigation mock (cam-604, cam-616-catalog-error-states,
 * cam-616-dashboard-and-notifications, cam-638, cam-639, cam-684 -- all
 * outside this diff's file surface, so they cannot be edited to add a mock).
 *
 * This file deliberately does NOT mock next/navigation, so it exercises the
 * REAL (unmocked) `useRouter()` -- the exact condition those 9 files are
 * under -- and proves LanguageProvider degrades `router.refresh()` to a
 * no-op instead of crashing. Runs under a simulated DOM (this file's own
 * top-of-file directive) since it needs `localStorage` and clickable DOM
 * nodes; see `__tests__/cam-688-ssr-no-storage-read.test.ts` for the
 * separate node-environment SSR guard.
 */
import { afterEach, describe, expect, it } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

function Consumer() {
  const { language, setLanguage } = useLanguage();
  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "lang" }, language),
    React.createElement("button", { "data-testid": "switch", onClick: () => setLanguage("th") }, "switch")
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("CAM-688 — LanguageProvider mounts and switches language with no Next.js App Router context in scope", () => {
  it("[behavioral] mounting bare (no initialLanguage prop) does not throw -- mirrors the 9 existing test files this diff cannot edit", () => {
    expect(() =>
      render(React.createElement(LanguageProvider, null, React.createElement(Consumer)))
    ).not.toThrow();
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });

  it("[behavioral] switching language (which calls router.refresh()) does not throw when no router is mounted -- refresh degrades to a no-op", () => {
    render(React.createElement(LanguageProvider, null, React.createElement(Consumer)));
    expect(() => fireEvent.click(screen.getByTestId("switch"))).not.toThrow();
    expect(screen.getByTestId("lang").textContent).toBe("th");
  });
});
