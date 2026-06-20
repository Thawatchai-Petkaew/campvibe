import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/delivery-config", () => ({
  getAutonomousMode: vi.fn(async () => false),
  setAutonomousMode: vi.fn(async (on: boolean) => on),
}));

import { GET, POST } from "@/app/api/status/config/route";
import * as cfg from "@/lib/delivery-config";

const TOKEN = "status-secret";

function req(method: string, opts: { token?: string; body?: unknown } = {}) {
  return new Request("http://localhost/api/status/config", {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined
      ? { body: typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body) }
      : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STATUS_TOKEN = TOKEN;
});

describe("status/config", () => {
  it("GET 401 without bearer", async () => {
    expect((await GET(req("GET"))).status).toBe(401);
  });

  it("GET 401 with wrong token", async () => {
    expect((await GET(req("GET", { token: "nope" }))).status).toBe(401);
  });

  it("GET returns current autonomousMode", async () => {
    const res = await GET(req("GET", { token: TOKEN }));
    expect(await res.json()).toEqual({ autonomousMode: false });
    expect(cfg.getAutonomousMode).toHaveBeenCalled();
  });

  it("POST toggles and returns the new state", async () => {
    const res = await POST(req("POST", { token: TOKEN, body: { autonomousMode: true } }));
    expect(await res.json()).toEqual({ autonomousMode: true });
    expect(cfg.setAutonomousMode).toHaveBeenCalledWith(true, "status-dashboard");
  });

  it("POST 400 when autonomousMode is not a boolean", async () => {
    const res = await POST(req("POST", { token: TOKEN, body: { autonomousMode: "yes" } }));
    expect(res.status).toBe(400);
    expect(cfg.setAutonomousMode).not.toHaveBeenCalled();
  });

  it("POST 401 without bearer", async () => {
    expect((await POST(req("POST", { body: { autonomousMode: true } }))).status).toBe(401);
  });

  it("POST 400 on malformed JSON", async () => {
    const res = await POST(req("POST", { token: TOKEN, body: "{not json" }));
    expect(res.status).toBe(400);
    expect(cfg.setAutonomousMode).not.toHaveBeenCalled();
  });
});
