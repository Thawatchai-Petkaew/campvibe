/**
 * CAM-278 (T-2) — lib/delivery/client.ts contract tests (real implementation, not mocked):
 * throws only when actually used without DELIVERY_DATABASE_URL, and caches a singleton once
 * constructed (survives repeated calls within the process — see ADR-010 + the module doc
 * comment on why this is cached on globalThis).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("getDeliveryClient", () => {
  beforeEach(() => {
    delete process.env.DELIVERY_DATABASE_URL;
    globalThis.deliveryPrismaGlobal = undefined;
    vi.resetModules();
  });

  it("throws a clear, safe error when DELIVERY_DATABASE_URL is not set", async () => {
    const { getDeliveryClient } = await import("@/lib/delivery/client");
    expect(() => getDeliveryClient()).toThrow(/DELIVERY_DATABASE_URL is not set/);
  });

  it("constructs (no live connection attempted) once DELIVERY_DATABASE_URL is set, and caches the singleton", async () => {
    process.env.DELIVERY_DATABASE_URL = "postgresql://user:pass@localhost:5432/delivery_test";
    const { getDeliveryClient } = await import("@/lib/delivery/client");
    const a = getDeliveryClient();
    const b = getDeliveryClient();
    expect(a).toBe(b); // same cached instance, not reconstructed per call
  });
});
