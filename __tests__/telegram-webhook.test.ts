import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
  answerCallback: vi.fn(async () => {}),
}));
vi.mock("@/lib/linear-actions", () => ({
  removeAwaitingYou: vi.fn(async () => true),
  addComment: vi.fn(async () => true),
}));
vi.mock("@/lib/github-dispatch", () => ({
  fireRepositoryDispatch: vi.fn(async () => ({ dispatched: true })),
}));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/telegram-webhook/route";
import * as notify from "@/lib/notify";
import * as linear from "@/lib/linear-actions";
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

  it("approve callback removes awaiting-you + acks only — webhook is the single 'Approved' source", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "approve:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(linear.removeAwaitingYou).toHaveBeenCalledWith("CAM-11");
    expect(notify.answerCallback).toHaveBeenCalled();
    // Removing awaiting-you triggers the Linear webhook, which is the SINGLE source of the
    // "Approved" notification (covers this tap AND a Linear-UI approval). The tap must NOT send it.
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

  it("reject callback comments + does NOT remove the label + sends rejected message (English, no emoji)", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "reject:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(linear.addComment).toHaveBeenCalledWith("CAM-11", expect.stringContaining("Rejected"));
    expect(linear.removeAwaitingYou).not.toHaveBeenCalled();
    // Should send the rejected message
    expect(notify.sendTelegram).toHaveBeenCalledTimes(1);
    const [text] = vi.mocked(notify.sendTelegram).mock.calls[0];
    expect(text as string).toContain("Sent back for changes");
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    expect(EMOJI_RE.test(text as string)).toBe(false);
  });

  it("reject callback toast is English and emoji-free", async () => {
    await POST(req({ callback_query: { id: "1", data: "reject:CAM-11" } }, SECRET));
    const [, toastText] = vi.mocked(notify.answerCallback).mock.calls[0] as [string, string?];
    if (toastText) {
      const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
      expect(EMOJI_RE.test(toastText)).toBe(false);
    }
  });

  it("free-text reply to a gate message → posts a comment on that issue (no emoji in ack)", async () => {
    const res = await POST(
      req({ message: { text: "ทำต่อได้", reply_to_message: { text: "CAM-11 Waiting for your approval" } } }, SECRET)
    );
    expect(await res.json()).toMatchObject({ comment: "CAM-11" });
    expect(linear.addComment).toHaveBeenCalledWith("CAM-11", expect.stringContaining("ทำต่อได้"));
    const [ackText] = vi.mocked(notify.sendTelegram).mock.calls[0] as [string];
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    expect(EMOJI_RE.test(ackText)).toBe(false);
  });

  it("free-text not tied to a gate → routed as an ad-hoc orchestrator request (no emoji in ack)", async () => {
    const res = await POST(req({ message: { text: "เพิ่มฟีเจอร์ค้นแคมป์" } }, SECRET));
    expect(await res.json()).toMatchObject({ adhoc: true });
    expect(dispatch.fireRepositoryDispatch).toHaveBeenCalledWith("camper-adhoc", { text: "เพิ่มฟีเจอร์ค้นแคมป์" });
    expect(linear.addComment).not.toHaveBeenCalled();
    const [ackText] = vi.mocked(notify.sendTelegram).mock.calls[0] as [string];
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    expect(EMOJI_RE.test(ackText)).toBe(false);
  });

  it("unknown action with a valid id → acked + ignored, no side effects", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "weird:CAM-9" } }, SECRET));
    expect(await res.json()).toMatchObject({ ignored: "weird:CAM-9" });
    expect(notify.answerCallback).toHaveBeenCalled();
    expect(linear.removeAwaitingYou).not.toHaveBeenCalled();
    expect(dispatch.fireRepositoryDispatch).not.toHaveBeenCalled();
  });

  it("malformed callback id → acked + rejected as bad id, no Linear call", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "approve:x" } }, SECRET));
    expect(await res.json()).toMatchObject({ ignored: "bad id" });
    expect(notify.answerCallback).toHaveBeenCalled();
    expect(linear.removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("update with neither callback nor text → ignored", async () => {
    const res = await POST(req({}, SECRET));
    expect(await res.json()).toMatchObject({ ignored: true });
    expect(dispatch.fireRepositoryDispatch).not.toHaveBeenCalled();
  });
});
