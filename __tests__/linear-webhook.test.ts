import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
}));

import { POST } from "@/app/api/linear-webhook/route";
import { sendTelegram } from "@/lib/notify";

const SECRET = "test-linear-secret";
const tg = vi.mocked(sendTelegram);

function sign(raw: string): string {
  return crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
}

function req(body: unknown, opts: { sign?: boolean } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.sign !== false) headers["linear-signature"] = sign(raw);
  return new Request("http://localhost/api/linear-webhook", { method: "POST", headers, body: raw });
}

function issueUpdate(data: Record<string, unknown>, updatedFrom: Record<string, unknown> = {}) {
  return { type: "Issue", action: "update", data, updatedFrom };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LINEAR_WEBHOOK_SECRET = SECRET;
  delete process.env.GITHUB_REPO;
  delete process.env.GH_DISPATCH_TOKEN;
});

describe("linear-webhook", () => {
  it("[AC6] rejects an invalid/missing signature with 401, no notify", async () => {
    const res = await POST(req({ type: "Issue", action: "update", data: {} }, { sign: false }));
    expect(res.status).toBe(401);
    expect(tg).not.toHaveBeenCalled();
  });

  it("ignores non-Issue events without notifying", async () => {
    const res = await POST(req({ type: "Comment", action: "create", data: {} }));
    expect(await res.json()).toMatchObject({ ignored: "Comment/create" });
    expect(tg).not.toHaveBeenCalled();
  });

  it("[AC1] notifies with Approve/Reject when awaiting-you is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "Gate G3 · ship", url: "https://linear.app/x", labels: [{ id: "l1", name: "awaiting-you" }] },
      { labelIds: [] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["awaiting-you"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text, opts] = tg.mock.calls[0];
    expect(text).toContain("CAM-9");
    expect(JSON.stringify(opts?.buttons)).toContain("approve:CAM-9");
  });

  it("[AC2] notifies done when the state changes to a completed type", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", state: { type: "completed", name: "Done" }, labels: [] },
      { stateId: "old" }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["done"]) });
    expect(tg).toHaveBeenCalledTimes(1);
  });

  it("[AC3] notifies released when the released label is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "r", name: "released" }, { id: "p", name: "platform" }] },
      { labelIds: ["p"] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["released"]) });
    expect(tg).toHaveBeenCalledTimes(1);
  });

  it("[AC4] notifies handoff with the human role label when a role:* label is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "rb", name: "role:backend-engineer" }] },
      { labelIds: [] }
    );
    const res = await POST(req(body));
    expect((await res.json()).notified).toContain("role:backend-engineer");
    expect(tg.mock.calls[0][0]).toContain("Backend");
  });

  it("does not re-notify for a label that was already present", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "r", name: "released" }] },
      { labelIds: ["r"] } // released was already there; only some other field changed
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: [] });
    expect(tg).not.toHaveBeenCalled();
  });

  it("[AC5] does not notify on an unrelated update", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "p", name: "platform" }] },
      { title: "old title" }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: [] });
    expect(tg).not.toHaveBeenCalled();
  });

  it("keeps the gate-approval dispatch path (awaiting-you removed) without notifying", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "Gate G3 · ship", labels: [] },
      { labelIds: ["aw"] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ approved: true, dispatched: false });
    expect(tg).not.toHaveBeenCalled();
  });
});
