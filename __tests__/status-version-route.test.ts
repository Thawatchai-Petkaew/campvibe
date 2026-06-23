import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/status-pulse", () => ({ readPulse: vi.fn(async () => 0) }));

import { GET } from "@/app/api/status/version/route";
import { readPulse } from "@/lib/status-pulse";

const rp = vi.mocked(readPulse);

function req(token?: string) {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  return new Request(`http://localhost/api/status/version${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STATUS_TOKEN;
});

describe("status/version", () => {
  it("[AC4] returns the current pulse version", async () => {
    rp.mockResolvedValueOnce(7);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 7 });
  });

  it("returns 0 when the pulse row does not exist", async () => {
    rp.mockResolvedValueOnce(0);
    expect(await (await GET(req())).json()).toEqual({ version: 0 });
  });

  it("[AC5] 401 on a wrong token when STATUS_TOKEN is set", async () => {
    process.env.STATUS_TOKEN = "secret";
    const res = await GET(req("nope"));
    expect(res.status).toBe(401);
  });

  it("200 with the correct token", async () => {
    process.env.STATUS_TOKEN = "secret";
    rp.mockResolvedValueOnce(3);
    const res = await GET(req("secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ version: 3 });
  });
});
