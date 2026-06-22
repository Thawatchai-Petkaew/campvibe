/**
 * Tests for lib/email/client.ts
 *
 * Coverage matrix:
 *   - normal: key present → calls Resend endpoint with correct shape + returns { ok, id }
 *   - null/empty: key absent → skips fetch, returns { ok:true, skipped:true }
 *   - error: non-2xx Resend response → returns { ok:false }, does not throw
 *   - error: fetch throws (network failure) → returns { ok:false }, does not throw
 *   - security: API key never appears in any logged output
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// "server-only" stub: vitest runs in node — mock the module to prevent the
// compile-time import check from throwing in the test environment.
vi.mock("server-only", () => ({}));

// Re-import after mock is registered
const { sendEmail } = await import("@/lib/email/client");

const FAKE_KEY = "re_test_abc123";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function makeRequest(status: number, body: unknown = { id: "msg_1" }) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeRequest(200));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

/* -------------------------------------------------------------------------- */
/* Guard: no API key                                                            */
/* -------------------------------------------------------------------------- */

describe("sendEmail — RESEND_API_KEY absent", () => {
  it("returns { ok:true, skipped:true } without calling fetch", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({
      to: "camper@example.com",
      subject: "ยืนยันการจอง",
      html: "<p>test</p>",
    });
    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not log the API key when skipped", async () => {
    delete process.env.RESEND_API_KEY;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendEmail({ to: "x@x.com", subject: "s", html: "<p/>" });
    for (const call of warnSpy.mock.calls) {
      const logged = JSON.stringify(call);
      expect(logged).not.toContain(FAKE_KEY);
    }
    warnSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* Happy path: key present, Resend returns 2xx                                 */
/* -------------------------------------------------------------------------- */

describe("sendEmail — success path", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = FAKE_KEY;
  });

  it("calls the Resend endpoint with POST + correct headers + body fields", async () => {
    const mockFetch = makeRequest(200, { id: "msg_42" });
    vi.stubGlobal("fetch", mockFetch);

    await sendEmail({
      to: "camper@example.com",
      subject: "ยืนยันการจอง",
      html: "<p>สวัสดี</p>",
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_ENDPOINT);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      `Bearer ${FAKE_KEY}`
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
    expect(init.method).toBe("POST");
    const parsed = JSON.parse(init.body as string);
    expect(parsed.to).toBe("camper@example.com");
    expect(parsed.subject).toBe("ยืนยันการจอง");
    expect(parsed.html).toBe("<p>สวัสดี</p>");
    expect(parsed.from).toBeDefined();
  });

  it("returns { ok:true, id } on 2xx", async () => {
    vi.stubGlobal("fetch", makeRequest(200, { id: "msg_42" }));
    const result = await sendEmail({
      to: "camper@example.com",
      subject: "test",
      html: "<p/>",
    });
    expect(result).toEqual({ ok: true, id: "msg_42" });
  });

  it("uses EMAIL_FROM env var when set", async () => {
    process.env.EMAIL_FROM = "TestSender <sender@test.com>";
    const mockFetch = makeRequest(200, { id: "x" });
    vi.stubGlobal("fetch", mockFetch);
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    const parsed = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(parsed.from).toBe("TestSender <sender@test.com>");
  });

  it("includes reply_to when replyTo is provided", async () => {
    const mockFetch = makeRequest(200, { id: "x" });
    vi.stubGlobal("fetch", mockFetch);
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>", replyTo: "host@camp.com" });
    const parsed = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(parsed.reply_to).toBe("host@camp.com");
  });

  it("never logs the API key", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    for (const call of [...infoSpy.mock.calls, ...errorSpy.mock.calls]) {
      expect(JSON.stringify(call)).not.toContain(FAKE_KEY);
    }
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

/* -------------------------------------------------------------------------- */
/* Error paths                                                                  */
/* -------------------------------------------------------------------------- */

describe("sendEmail — non-2xx Resend response", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = FAKE_KEY;
  });

  it("returns { ok:false } on 422 and does not throw", async () => {
    vi.stubGlobal("fetch", makeRequest(422, { message: "invalid to" }));
    const result = await sendEmail({ to: "bad", subject: "s", html: "<p/>" });
    expect(result).toEqual({ ok: false });
  });

  it("returns { ok:false } on 429 (rate limit) and does not throw", async () => {
    vi.stubGlobal("fetch", makeRequest(429, {}));
    const result = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    expect(result).toEqual({ ok: false });
  });

  it("returns { ok:false } on 500 and does not throw", async () => {
    vi.stubGlobal("fetch", makeRequest(500, {}));
    const result = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    expect(result).toEqual({ ok: false });
  });
});

describe("sendEmail — fetch throws (network failure)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = FAKE_KEY;
  });

  it("returns { ok:false } and does not throw when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    expect(result).toEqual({ ok: false });
  });

  it("never leaks the API key in error logs on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await sendEmail({ to: "a@b.com", subject: "s", html: "<p/>" });
    for (const call of errorSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(FAKE_KEY);
    }
    errorSpy.mockRestore();
  });
});
