/**
 * app/api/telegram-webhook/route.ts — single mutation path (CAM-281 T-5b retired the
 * legacy Linear branch; the delivery service — lib/delivery/tickets.ts — is now the ONLY
 * path). See __tests__/cam-281-dual-mode-writes.test.ts for the fuller behavioral +
 * error-mapping + source-inspection coverage of this route; this file keeps the original
 * CAM-136/CAM-1xx contract cases (auth, bad json, unknown action, malformed id, emoji-free
 * copy) updated for the single path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
  answerCallback: vi.fn(async () => {}),
}));
vi.mock("@/lib/delivery/tickets", () => ({
  approve: vi.fn(async () => ({ identifier: "CAM-11", state: "IN_PROGRESS" })),
  reject: vi.fn(async () => ({ identifier: "CAM-11", state: "IN_PROGRESS" })),
  addComment: vi.fn(async () => ({ id: "comment_1" })),
}));
vi.mock("@/lib/github-dispatch", () => ({
  fireRepositoryDispatch: vi.fn(async () => ({ dispatched: true })),
}));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/telegram-webhook/route";
import * as notify from "@/lib/notify";
import * as ticketsService from "@/lib/delivery/tickets";
import * as dispatch from "@/lib/github-dispatch";

const SECRET = "test-secret";

function req(body: unknown, secret?: string) {
  return new Request("http://localhost/api/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  vi.mocked(ticketsService.approve).mockResolvedValue({ identifier: "CAM-11", state: "IN_PROGRESS" } as never);
  vi.mocked(ticketsService.reject).mockResolvedValue({ identifier: "CAM-11", state: "IN_PROGRESS" } as never);
  vi.mocked(ticketsService.addComment).mockResolvedValue({ id: "comment_1" } as never);
});

describe("telegram-webhook", () => {
  it("401 without the secret header", async () => {
    expect((await POST(req({}, undefined))).status).toBe(401);
  });

  it("401 with a wrong secret", async () => {
    expect((await POST(req({}, "wrong"))).status).toBe(401);
  });

  it("400 on bad json", async () => {
    expect((await POST(req("{not json", SECRET))).status).toBe(400);
  });

  it("approve callback calls the delivery approve() verb + acks only — the service is the single 'Approved' source", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "approve:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(ticketsService.approve).toHaveBeenCalledWith("CAM-11", expect.any(String));
    expect(notify.answerCallback).toHaveBeenCalled();
    // approve() (mocked here) owns the "approved" Telegram notification in the same call —
    // the tap must NOT send one itself.
    expect(notify.sendTelegram).not.toHaveBeenCalled();
  });

  it("approve callback toast is English and emoji-free", async () => {
    await POST(req({ callback_query: { id: "1", data: "approve:CAM-11" } }, SECRET));
    const [, toastText] = vi.mocked(notify.answerCallback).mock.calls[0] as [string, string?];
    if (toastText) {
      const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
      expect(EMOJI_RE.test(toastText)).toBe(false);
    }
  });

  it("reject callback calls the delivery reject() verb with the fixed note + acks only, never double-notifies", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "reject:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(ticketsService.reject).toHaveBeenCalledWith(
      "CAM-11",
      expect.any(String),
      "Rejected via Telegram — needs changes before continuing"
    );
    // reject() (mocked here) owns the "rejected" notification in the same call.
    expect(notify.sendTelegram).not.toHaveBeenCalled();
  });

  it("reject callback toast is English and emoji-free", async () => {
    await POST(req({ callback_query: { id: "1", data: "reject:CAM-11" } }, SECRET));
    const [, toastText] = vi.mocked(notify.answerCallback).mock.calls[0] as [string, string?];
    if (toastText) {
      const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
      expect(EMOJI_RE.test(toastText)).toBe(false);
    }
  });

  it("free-text reply to a gate message → posts a comment via the delivery service (no emoji in ack)", async () => {
    const res = await POST(
      req({ message: { text: "ทำต่อได้", reply_to_message: { text: "CAM-11 Waiting for your approval" } } }, SECRET)
    );
    expect(await res.json()).toMatchObject({ comment: "CAM-11" });
    expect(ticketsService.addComment).toHaveBeenCalledWith("CAM-11", expect.any(String), expect.stringContaining("ทำต่อได้"));
    const [ackText] = vi.mocked(notify.sendTelegram).mock.calls[0] as [string];
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    expect(EMOJI_RE.test(ackText)).toBe(false);
  });

  it("free-text not tied to a gate → routed as an ad-hoc orchestrator request (no emoji in ack)", async () => {
    const res = await POST(req({ message: { text: "เพิ่มฟีเจอร์ค้นแคมป์" } }, SECRET));
    expect(await res.json()).toMatchObject({ adhoc: true });
    expect(dispatch.fireRepositoryDispatch).toHaveBeenCalledWith("camper-adhoc", { text: "เพิ่มฟีเจอร์ค้นแคมป์" });
    expect(ticketsService.addComment).not.toHaveBeenCalled();
    const [ackText] = vi.mocked(notify.sendTelegram).mock.calls[0] as [string];
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    expect(EMOJI_RE.test(ackText)).toBe(false);
  });

  it("unknown action with a valid id → acked + ignored, no side effects", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "weird:CAM-9" } }, SECRET));
    expect(await res.json()).toMatchObject({ ignored: "weird:CAM-9" });
    expect(notify.answerCallback).toHaveBeenCalled();
    expect(ticketsService.approve).not.toHaveBeenCalled();
    expect(dispatch.fireRepositoryDispatch).not.toHaveBeenCalled();
  });

  it("malformed callback id → acked + rejected as bad id, no delivery-service call", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "approve:x" } }, SECRET));
    expect(await res.json()).toMatchObject({ ignored: "bad id" });
    expect(notify.answerCallback).toHaveBeenCalled();
    expect(ticketsService.approve).not.toHaveBeenCalled();
  });

  it("update with neither callback nor text → ignored", async () => {
    const res = await POST(req({}, SECRET));
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(dispatch.fireRepositoryDispatch).not.toHaveBeenCalled();
  });
});
