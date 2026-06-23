import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

vi.mock("@/lib/notify", () => ({
  sendTelegram: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/status-pulse", () => ({ bumpPulse: vi.fn(async () => {}) }));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/linear-webhook/route";
import { sendTelegram } from "@/lib/notify";
import { bumpPulse } from "@/lib/status-pulse";

const SECRET = "test-linear-secret";
const tg = vi.mocked(sendTelegram);
const bump = vi.mocked(bumpPulse);

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

  it("ignores non-Issue events without notifying or pulsing", async () => {
    const res = await POST(req({ type: "Comment", action: "create", data: {} }));
    expect(await res.json()).toMatchObject({ ignored: "Comment/create" });
    expect(tg).not.toHaveBeenCalled();
    expect(bump).not.toHaveBeenCalled();
  });

  it("[AC2] bumps the pulse + revalidates the status cache on any Issue event (even a non-update create)", async () => {
    const res = await POST(req({ type: "Issue", action: "create", data: { identifier: "CAM-9" } }));
    expect(await res.json()).toMatchObject({ ignored: "Issue/create", pulsed: true });
    expect(bump).toHaveBeenCalledTimes(1);
    expect(tg).not.toHaveBeenCalled(); // created is gated off by default
  });

  it("[AC1] notifies gate (English 'Waiting for your approval') when awaiting-you is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "Gate G3 · ship", url: "https://linear.app/x", labels: [{ id: "l1", name: "awaiting-you" }] },
      { labelIds: [] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["awaiting-you"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text, opts] = tg.mock.calls[0];
    expect(text).toContain("CAM-9");
    expect(text).toContain("Waiting for your approval");
    expect(JSON.stringify(opts?.buttons)).toContain("approve:CAM-9");
    expect(JSON.stringify(opts?.buttons)).toContain("reject:CAM-9");
  });

  it("[AC2] notifies done (English 'Completed') when the state changes to a completed type", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", state: { type: "completed", name: "Done" }, labels: [] },
      { stateId: "old" }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["done"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Completed");
  });

  it("notifies started (English 'Work started') when state changes to a started type", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", state: { type: "started", name: "In Progress" }, labels: [] },
      { stateId: "old" }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["started"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Work started");
  });

  it("notifies blocked (English 'Blocked') when blocked label is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "b1", name: "blocked" }] },
      { labelIds: [] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["blocked"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Blocked");
  });

  it("[AC3] notifies released (English 'Now live') when the released label is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "r", name: "released" }, { id: "p", name: "platform" }] },
      { labelIds: ["p"] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ notified: expect.arrayContaining(["released"]) });
    expect(tg).toHaveBeenCalledTimes(1);
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Now live");
  });

  it("[AC4] notifies handoff (English 'Handed over to Backend') when a role:* label is added", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "story", labels: [{ id: "rb", name: "role:backend-engineer" }] },
      { labelIds: [] }
    );
    const res = await POST(req(body));
    expect((await res.json()).notified).toContain("handoff:backend-engineer");
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Backend");
    expect(text).toContain("Handed over to");
  });

  it("notifies handoff via the title [role] change (forward to a new role)", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "[ux-designer] story", labels: [] },
      { title: "[product-owner] story" }
    );
    const res = await POST(req(body));
    expect((await res.json()).notified).toContain("handoff:ux-designer");
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Handed over to Designer");
  });

  it("notifies handoff on a RETURN even when the role:* label already exists (regression)", async () => {
    // QA hands the work back to Frontend; role:frontend-engineer was added earlier and never removed.
    const body = issueUpdate(
      {
        identifier: "CAM-9",
        title: "[frontend-engineer] story",
        labels: [
          { id: "rf", name: "role:frontend-engineer" },
          { id: "rq", name: "role:qa-engineer" },
        ],
      },
      { title: "[qa-engineer] story", labelIds: ["rf", "rq"] } // no label added; only the title changed
    );
    const res = await POST(req(body));
    expect((await res.json()).notified).toContain("handoff:frontend-engineer");
    const [text] = tg.mock.calls[0];
    expect(text).toContain("Handed over to Frontend");
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

  it("gate-approval dispatch fires when awaiting-you is removed, but the webhook does NOT send 'Approved' (the Telegram tap does)", async () => {
    const body = issueUpdate(
      { identifier: "CAM-9", title: "Gate G3 · ship", labels: [] },
      { labelIds: ["aw"] }
    );
    const res = await POST(req(body));
    expect(await res.json()).toMatchObject({ approved: true, dispatched: false });
    expect(tg).not.toHaveBeenCalled();
  });

  it("created (default off) does NOT send Telegram even on Issue/create", async () => {
    const res = await POST(req({ type: "Issue", action: "create", data: { identifier: "CAM-9" } }));
    expect(await res.json()).toMatchObject({ ignored: "Issue/create" });
    expect(tg).not.toHaveBeenCalled();
  });

  it("no emoji in any Telegram message text", async () => {
    const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u;
    const events = [
      issueUpdate(
        { identifier: "CAM-9", title: "Gate G3 · ship", url: "https://linear.app/x", labels: [{ id: "l1", name: "awaiting-you" }] },
        { labelIds: [] }
      ),
    ];
    for (const body of events) {
      vi.clearAllMocks();
      await POST(req(body));
      for (const [text] of tg.mock.calls) {
        expect(EMOJI_RE.test(text as string), `emoji found in message: ${text}`).toBe(false);
      }
    }
  });
});
