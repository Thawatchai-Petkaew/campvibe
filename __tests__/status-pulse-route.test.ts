import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/status-pulse", () => ({ bumpPulse: vi.fn(async () => {}) }));

import { POST } from "@/app/api/status/pulse/route";
import { bumpPulse } from "@/lib/status-pulse";

const bump = vi.mocked(bumpPulse);

function req(opts: { token?: string; header?: string } = {}) {
  const qs = opts.token ? `?token=${encodeURIComponent(opts.token)}` : "";
  const headers: Record<string, string> = {};
  if (opts.header) headers["x-status-token"] = opts.header;
  return new Request(`http://localhost/api/status/pulse${qs}`, { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;
});

describe("status/pulse", () => {
  it("bumps the pulse and returns ok when no token is configured (open in dev)", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(bump).toHaveBeenCalledTimes(1);
  });

  it("401 on a wrong token when STATUS_TOKEN is set — does NOT bump", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await POST(req({ token: "nope" }));
    expect(res.status).toBe(401);
    expect(bump).not.toHaveBeenCalled();
  });

  it("200 with the correct token via query param", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await POST(req({ token: "secret" }));
    expect(res.status).toBe(200);
    expect(bump).toHaveBeenCalledTimes(1);
  });

  it("200 with the correct token via x-status-token header", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await POST(req({ header: "secret" }));
    expect(res.status).toBe(200);
    expect(bump).toHaveBeenCalledTimes(1);
  });
});
