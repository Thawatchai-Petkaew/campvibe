/**
 * CAM-265 — CSP onclick fix guard test.
 *
 * Asserts that:
 * 1. app/status/page.tsx has ZERO inline event handlers (on* attributes).
 *    When a nonce-based CSP is present, browsers ignore `'unsafe-inline'` and
 *    block all inline onclick/onchange/etc. handlers. The fix replaces them with
 *    data-act / data-arg attributes dispatched by an event-delegation listener.
 * 2. app/status/dashboard-client.tsx contains the delegated click listener that
 *    reads data-act / data-arg and dispatches to the window.* functions, and
 *    removes itself on cleanup.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const rootDir = join(__dirname, "..");

function readSource(relPath: string): string {
  return readFileSync(join(rootDir, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. page.tsx — no inline event handlers, data-act present
// ---------------------------------------------------------------------------

describe("CAM-265 app/status/page.tsx — CSP-safe event delegation (no inline handlers)", () => {
  let src: string;
  function getPage(): string {
    if (!src) src = readSource("app/status/page.tsx");
    return src;
  }

  it("has NO inline onclick handlers", () => {
    expect(
      getPage(),
      "page.tsx must not contain onclick= (blocked by nonce-CSP)"
    ).not.toMatch(/\bonclick=/);
  });

  it("has NO inline onchange handlers", () => {
    expect(
      getPage(),
      "page.tsx must not contain onchange= (blocked by nonce-CSP)"
    ).not.toMatch(/\bonchange=/);
  });

  it("has NO inline oninput handlers", () => {
    expect(
      getPage(),
      "page.tsx must not contain oninput= (blocked by nonce-CSP)"
    ).not.toMatch(/\boninput=/);
  });

  it("has NO inline onsubmit handlers", () => {
    expect(
      getPage(),
      "page.tsx must not contain onsubmit= (blocked by nonce-CSP)"
    ).not.toMatch(/\bonsubmit=/);
  });

  it("has NO inline on* handlers (broad check)", () => {
    expect(
      getPage(),
      "page.tsx must not contain any on<event>= inline handler attribute"
    ).not.toMatch(/\son\w+="/);
  });

  it("contains data-act attributes (delegation hook)", () => {
    expect(
      getPage(),
      "page.tsx must use data-act= attributes for all interactive elements"
    ).toMatch(/data-act=/);
  });

  it("uses data-act for showView", () => {
    expect(getPage()).toContain('data-act="showView"');
  });

  it("uses data-act for setGroup", () => {
    expect(getPage()).toContain('data-act="setGroup"');
  });

  it("uses data-act for toggleEnv", () => {
    expect(getPage()).toContain('data-act="toggleEnv"');
  });

  it("uses data-act for filterEpics", () => {
    expect(getPage()).toContain('data-act="filterEpics"');
  });

  it("uses data-act for openSwitcher", () => {
    expect(getPage()).toContain('data-act="openSwitcher"');
  });

  it("uses data-act for closeSwitcher", () => {
    expect(getPage()).toContain('data-act="closeSwitcher"');
  });

  it("uses data-act for filterSwitcher", () => {
    expect(getPage()).toContain('data-act="filterSwitcher"');
  });
});

// ---------------------------------------------------------------------------
// 2. dashboard-client.tsx — delegation listener present with cleanup
// ---------------------------------------------------------------------------

describe("CAM-265 app/status/dashboard-client.tsx — delegated click listener", () => {
  let src: string;
  function getClient(): string {
    if (!src) src = readSource("app/status/dashboard-client.tsx");
    return src;
  }

  it("adds a delegated click listener on the document", () => {
    expect(
      getClient(),
      "dashboard-client.tsx must call document.addEventListener(\"click\", ...)"
    ).toContain('addEventListener("click"');
  });

  it("reads data-act from the clicked element", () => {
    expect(
      getClient(),
      "dashboard-client.tsx must read the data-act attribute"
    ).toContain("data-act");
  });

  it("reads data-arg from the clicked element", () => {
    expect(
      getClient(),
      "dashboard-client.tsx must read the data-arg attribute"
    ).toContain("data-arg");
  });

  it("removes the delegated click listener on cleanup", () => {
    expect(
      getClient(),
      "dashboard-client.tsx must call document.removeEventListener(\"click\", ...) for cleanup"
    ).toContain('removeEventListener("click"');
  });

  it("uses closest('[data-act]') for event delegation", () => {
    expect(
      getClient(),
      "dashboard-client.tsx must use .closest(\"[data-act]\") for proper delegation up the DOM"
    ).toContain("closest");
  });
});
