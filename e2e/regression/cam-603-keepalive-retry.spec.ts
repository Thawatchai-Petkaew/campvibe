/**
 * CAM-603 — Prove-It guard for `isTransientKeepAliveRace` /
 * `withKeepAliveRaceRetry` (helpers.ts): the narrow, capped retry that
 * hardens every `request.*` call in this suite against the Node
 * keep-alive-timeout race documented in `e2e/regression/README.md` and
 * `docs/specs/platform-hardening/taxonomy-ui-foundation/
 * CAM-603-e2e-midrun-abort/tech.md`.
 *
 * No network/browser needed — this asserts the retry's own decision logic
 * against synthetic errors, so it cannot itself be flaky. `vitest.config.ts`
 * excludes `e2e/**`, so this lives here (as a Playwright test) rather than
 * under `__tests__/`.
 */
import { test, expect } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import { isTransientKeepAliveRace, withKeepAliveRaceRetry } from "./helpers";

function errorWith(message: string): Error {
  return new Error(message);
}

test.describe("isTransientKeepAliveRace — narrow predicate", () => {
  test("matches Playwright's real relayed message shape (freshly reproduced locally, see tech.md)", () => {
    // Verbatim message this predicate MISSED in its first draft (which checked
    // `err.code` — Playwright relays this as a plain Error with no `.code` set
    // at all, the failure folded entirely into `message`).
    expect(isTransientKeepAliveRace(errorWith("apiRequestContext.get: read ECONNRESET"))).toBe(true);
  });

  test("matches the ticket's original client-side signature (socket hang up)", () => {
    expect(isTransientKeepAliveRace(errorWith("apiRequestContext.get: socket hang up"))).toBe(true);
  });

  test("matches the server-mirrored signature (aborted)", () => {
    expect(isTransientKeepAliveRace(errorWith("aborted"))).toBe(true);
  });

  test("does NOT match ECONNREFUSED — a dead webServer must fail loudly, never retry", () => {
    expect(isTransientKeepAliveRace(errorWith("apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3100"))).toBe(
      false
    );
    expect(isTransientKeepAliveRace(errorWith("aborted ECONNREFUSED"))).toBe(false);
  });

  test("does NOT match an unrelated error (e.g. a real assertion failure)", () => {
    expect(isTransientKeepAliveRace(new Error("expected 200, got 404"))).toBe(false);
    expect(isTransientKeepAliveRace("not even an Error instance")).toBe(false);
  });
});

test.describe("withKeepAliveRaceRetry — capped at exactly one retry", () => {
  test("retries once and succeeds on the narrow error class, recording a visible annotation", async ({}, testInfo) => {
    let calls = 0;
    const fakeResponse = { ok: () => true } as APIResponse;
    const result = await withKeepAliveRaceRetry("GET /fake", async () => {
      calls++;
      if (calls === 1) throw errorWith("apiRequestContext.get: read ECONNRESET");
      return fakeResponse;
    });
    expect(calls).toBe(2); // exactly one retry
    expect(result).toBe(fakeResponse);
    expect(testInfo.annotations.some((a) => a.type === "cam-603-transient-retry")).toBe(true);
  });

  test("a SECOND consecutive failure propagates — never swallowed", async () => {
    let calls = 0;
    await expect(
      withKeepAliveRaceRetry("GET /fake", async () => {
        calls++;
        throw errorWith("apiRequestContext.get: socket hang up");
      })
    ).rejects.toThrow("socket hang up");
    expect(calls).toBe(2); // one original attempt + one retry, then it stops
  });

  test("ECONNREFUSED (a real dead server) fails immediately — no retry at all", async () => {
    let calls = 0;
    await expect(
      withKeepAliveRaceRetry("GET /fake", async () => {
        calls++;
        throw errorWith("apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3100");
      })
    ).rejects.toThrow("ECONNREFUSED");
    expect(calls).toBe(1); // no retry attempted
  });

  test("an unrelated failure (e.g. a real 500) propagates immediately — no retry", async () => {
    let calls = 0;
    await expect(
      withKeepAliveRaceRetry("GET /fake", async () => {
        calls++;
        throw new Error("boom: unrelated failure");
      })
    ).rejects.toThrow("boom: unrelated failure");
    expect(calls).toBe(1);
  });
});
