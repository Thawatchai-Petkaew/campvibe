/**
 * CAM-278 (T-2) — lib/delivery/pulse.ts contract tests (the DeliveryPulse equivalent of
 * lib/status-pulse.ts, bumped in-process by lib/delivery/tickets.ts — no webhook, ADR-010).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/delivery/client", () => ({ getDeliveryClient: vi.fn() }));

import { readDeliveryPulse, bumpDeliveryPulse } from "@/lib/delivery/pulse";
import { getDeliveryClient } from "@/lib/delivery/client";
import { createFakeDeliveryClient } from "./helpers/delivery-fake-client";

const getClient = vi.mocked(getDeliveryClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readDeliveryPulse", () => {
  it("returns 0 when the singleton row does not exist yet", async () => {
    const fake = createFakeDeliveryClient();
    getClient.mockReturnValue(fake.client);
    expect(await readDeliveryPulse()).toBe(0);
  });

  it("returns the current version once bumped", async () => {
    const fake = createFakeDeliveryClient();
    getClient.mockReturnValue(fake.client);
    await bumpDeliveryPulse();
    await bumpDeliveryPulse();
    expect(await readDeliveryPulse()).toBe(2);
  });
});

describe("bumpDeliveryPulse", () => {
  it("is a no-throw best-effort — a DB error is swallowed, never propagated", async () => {
    const fake = createFakeDeliveryClient();
    fake.client.deliveryPulse.upsert.mockRejectedValueOnce(new Error("connection reset"));
    getClient.mockReturnValue(fake.client);
    await expect(bumpDeliveryPulse()).resolves.toBeUndefined();
  });
});
