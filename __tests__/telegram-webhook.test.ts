import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
  answerCallback: vi.fn(async () => {}),
}));
vi.mock("@/lib/linear-actions", () => ({
  removeAwaitingYou: vi.fn(async () => true),
  addComment: vi.fn(async () => true),
}));

import { POST } from "@/app/api/telegram-webhook/route";
import * as notify from "@/lib/notify";
import * as linear from "@/lib/linear-actions";

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

  it("approve callback removes awaiting-you + acks", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "approve:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "approve", id: "CAM-11", changed: true });
    expect(linear.removeAwaitingYou).toHaveBeenCalledWith("CAM-11");
    expect(notify.answerCallback).toHaveBeenCalled();
  });

  it("reject callback comments + does NOT remove the label", async () => {
    const res = await POST(req({ callback_query: { id: "1", data: "reject:CAM-11" } }, SECRET));
    expect(await res.json()).toMatchObject({ action: "reject", id: "CAM-11" });
    expect(linear.addComment).toHaveBeenCalledWith("CAM-11", expect.stringContaining("Rejected"));
    expect(linear.removeAwaitingYou).not.toHaveBeenCalled();
  });

  it("free-text reply to a gate message → posts a comment on that issue", async () => {
    const res = await POST(
      req({ message: { text: "ทำต่อได้", reply_to_message: { text: "⏳ CAM-11 รออนุมัติ" } } }, SECRET)
    );
    expect(await res.json()).toMatchObject({ comment: "CAM-11" });
    expect(linear.addComment).toHaveBeenCalledWith("CAM-11", expect.stringContaining("ทำต่อได้"));
  });

  it("free-text not tied to a gate → ack only (phase 3 routing)", async () => {
    const res = await POST(req({ message: { text: "hello" } }, SECRET));
    expect(await res.json()).toMatchObject({ note: "free-text (phase 3)" });
    expect(linear.addComment).not.toHaveBeenCalled();
  });
});
