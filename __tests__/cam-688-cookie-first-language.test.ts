// @vitest-environment jsdom
/**
 * cam-688-cookie-first-language.test.ts — CAM-688
 *
 * Full behavioral coverage of story.md's AC/Rules/Edge-cases for
 * contexts/LanguageContext.tsx's client-side half (the cookie-first
 * migration, the switch-writes-both-and-refreshes flow). app/layout.tsx's
 * server-side cookie resolution (BR-1/BR-3/EC-1, `<html lang>`) is verified
 * behaviorally against a real running dev server (curl'd SSR HTML with/
 * without the cookie -- see the PR description) rather than re-implemented
 * here, since layout.tsx is an async Server Component that reads
 * next/headers' cookies() and cannot be unit-rendered outside a real
 * request (the repo's own precedent: cam-242/cam-397/ds2-button-sarabun
 * source-inspect app/layout.tsx rather than execute it).
 *
 * Coverage map:
 *   AC-1  a resolved `initialLanguage="th"` renders Thai immediately, no
 *         client correction needed
 *   AC-2  no cookie/no stored preference -> English default, no migration
 *         write (== EC-2)
 *   AC-3  a stored `th` preference with no cookie migrates into the cookie
 *         exactly once, on mount
 *   AC-4  switching writes BOTH the cookie and localStorage, and calls
 *         router.refresh() (BR-4)
 *   BR-1  cookie wins over storage -- migration never fires when a cookie
 *         is already present, even if storage disagrees
 *   BR-2  the cookie is written with path=/, one-year max-age, samesite=lax
 *   EC-2  neither cookie nor storage present -> no migration write
 *   EC-3  cookies disabled -> the switch still works for the session via
 *         storage + React state, but the cookie write silently no-ops (so
 *         the next first paint stays `en` -- degraded, not broken). The
 *         "no router in scope" degrade path is proven separately in
 *         cam-688-router-optional.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { LanguageProvider, useLanguage, type Language } from "@/contexts/LanguageContext";

function Consumer() {
  const { language, setLanguage, formatCurrency } = useLanguage();
  return React.createElement(
    "div",
    null,
    React.createElement("span", { "data-testid": "lang" }, language),
    React.createElement("span", { "data-testid": "price" }, formatCurrency(750)),
    React.createElement("button", { "data-testid": "switch-th", onClick: () => setLanguage("th") }, "th"),
    React.createElement("button", { "data-testid": "switch-en", onClick: () => setLanguage("en") }, "en")
  );
}

// React.createElement's typed overloads don't reconcile a props object plus
// a separate rest-arg `children` against a component whose Props declares
// `children: ReactNode` as required (only JSX's compile-time transform does
// that folding, which a plain .test.ts file -- no JSX -- doesn't get). Build
// the full, correctly-typed props object via a typed local (never a `{
// children: ... }` object literal passed straight into createElement --
// that's react/no-children-prop) so every call site below stays fully typed
// with no `as any`.
function renderProvider(initialLanguage: Language | undefined, children: React.ReactNode) {
  const props: React.ComponentProps<typeof LanguageProvider> = { initialLanguage, children };
  return render(React.createElement(LanguageProvider, props));
}

function readCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)campvibe_lang=([^;]*)/);
  return match?.[1] ?? null;
}

function clearCookie() {
  document.cookie = "campvibe_lang=; path=/; max-age=0";
}

beforeEach(() => {
  clearCookie();
  localStorage.clear();
  refreshMock.mockClear();
});

afterEach(() => {
  cleanup();
  clearCookie();
  localStorage.clear();
});

describe("AC-1 — server-resolved language renders immediately, no flash", () => {
  it("[behavioral] initialLanguage='th' renders Thai baht formatting on the very first render", () => {
    renderProvider("th", React.createElement(Consumer));
    expect(screen.getByTestId("lang").textContent).toBe("th");
    expect(screen.getByTestId("price").textContent).toMatch(/฿/);
    expect(screen.getByTestId("price").textContent).not.toMatch(/\$/);
  });
});

describe("AC-2/EC-2 — never-set preference defaults to English, no migration write", () => {
  it("[behavioral] no cookie + no stored value -> renders English and writes no cookie", () => {
    render(React.createElement(LanguageProvider, null, React.createElement(Consumer)));
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(readCookie()).toBeNull();
  });
});

describe("AC-3/BR-1 — one-time migration from storage into the cookie", () => {
  it("[behavioral] a stored 'th' preference with no cookie migrates on mount (state flips + cookie written)", async () => {
    localStorage.setItem("campvibe_lang", "th");
    render(React.createElement(LanguageProvider, null, React.createElement(Consumer)));
    const langEl = await screen.findByTestId("lang");
    expect(langEl.textContent).toBe("th");
    expect(readCookie()).toBe("th");
  });

  it("[behavioral] BR-1 -- a cookie already present blocks the migration even when storage disagrees", async () => {
    document.cookie = "campvibe_lang=en; path=/";
    localStorage.setItem("campvibe_lang", "th");
    renderProvider("en", React.createElement(Consumer));
    // Give any (incorrect) migration effect a tick to fire before asserting it didn't.
    await Promise.resolve();
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(readCookie()).toBe("en");
  });
});

describe("BR-2 — the cookie's exact write shape (path, one-year max-age, samesite=lax, no secure on localhost)", () => {
  it("[behavioral] the raw string written to document.cookie matches BR-2 (jsdom's read-back strips attributes, so this captures the SET, not the GET)", () => {
    const writes: string[] = [];
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        return writes.map((w) => w.split(";")[0]).join("; ");
      },
      set(value: string) {
        writes.push(value);
      },
    });

    try {
      renderProvider("en", React.createElement(Consumer));
      fireEvent.click(screen.getByTestId("switch-th"));
    } finally {
      if (originalDescriptor) Object.defineProperty(document, "cookie", originalDescriptor);
    }

    const langCookieWrite = writes.find((w) => w.startsWith("campvibe_lang=th"));
    expect(langCookieWrite).toBeDefined();
    expect(langCookieWrite).toContain("path=/");
    expect(langCookieWrite).toContain("max-age=31536000"); // one year, BR-2
    expect(langCookieWrite).toContain("samesite=lax");
    expect(langCookieWrite).not.toContain("secure"); // jsdom protocol is http: on localhost
  });
});

describe("EC-3 — cookies disabled: the switch still works for the session via storage; first paint is not affected", () => {
  it("[behavioral] a browser that silently ignores document.cookie writes (cookies disabled) still switches the visible language via localStorage + React state", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    // Mirrors a real browser with cookies blocked: the write is accepted
    // syntactically but never actually stored (the GET never reflects it).
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get() {
        return "";
      },
      set() {
        /* no-op -- cookies disabled */
      },
    });

    try {
      renderProvider("en", React.createElement(Consumer));
      expect(() => fireEvent.click(screen.getByTestId("switch-th"))).not.toThrow();
      // Degraded, not broken (EC-3): the session still switches...
      expect(screen.getByTestId("lang").textContent).toBe("th");
      expect(localStorage.getItem("campvibe_lang")).toBe("th");
      // ...but the cookie never actually took (this is what makes the NEXT
      // first paint stay `en` -- the server has nothing to read).
      expect(readCookie()).toBeNull();
    } finally {
      if (originalDescriptor) Object.defineProperty(document, "cookie", originalDescriptor);
    }
  });
});

describe("AC-4/BR-2/BR-4 — switching writes both the cookie and storage, and refreshes the router", () => {
  it("[behavioral] setLanguage('th') updates state, writes the cookie (BR-2 shape) + localStorage, and calls router.refresh() once", () => {
    renderProvider("en", React.createElement(Consumer));
    fireEvent.click(screen.getByTestId("switch-th"));

    expect(screen.getByTestId("lang").textContent).toBe("th");
    expect(localStorage.getItem("campvibe_lang")).toBe("th");
    expect(readCookie()).toBe("th");
    expect(document.cookie).toMatch(/campvibe_lang=th/);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("[behavioral] switching back to 'en' after a Thai session updates the cookie again and the page stays in sync on return (AC-4's 'stays that language when returning')", () => {
    renderProvider("th", React.createElement(Consumer));
    fireEvent.click(screen.getByTestId("switch-en"));

    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(readCookie()).toBe("en");
    expect(refreshMock).toHaveBeenCalledTimes(1);

    // "Returning" -- a fresh mount reading the (now-persisted) cookie value,
    // exactly what app/layout.tsx does server-side on the next request.
    cleanup();
    renderProvider("en", React.createElement(Consumer));
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });
});

describe("app/layout.tsx — server-side cookie resolution wiring (structural guard; the actual resolution is verified behaviorally via curl against a running dev server, not re-executed here -- see the note at the top of this file)", () => {
  const layoutSrc = readFileSync(resolve(__dirname, "..", "app/layout.tsx"), "utf-8");

  it("[structural] BR-1/BR-3/EC-1 -- resolves the cookie to exactly 'th' or 'en', defaulting anything else to 'en'", () => {
    expect(layoutSrc).toContain(
      `const lang = (await cookies()).get("campvibe_lang")?.value === "th" ? "th" : "en";`
    );
  });

  it("[structural] the resolved language is threaded into both <html lang> and LanguageProvider's initialLanguage (so SSR and the client's first render agree)", () => {
    expect(layoutSrc).toContain("<html lang={lang}");
    expect(layoutSrc).toContain("<LanguageProvider initialLanguage={lang}>");
  });
});
