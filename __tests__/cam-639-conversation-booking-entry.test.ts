/**
 * cam-639-conversation-booking-entry.test.ts — CAM-639 (epic CAM-630,
 * in-chat guided booking)
 *
 * Pure-logic coverage for the new `kind:"booking"` `ChatEntry` arm
 * (components/ai-chat/conversation.ts). Three invariants, each pinned by its
 * own test below (per the ticket's "three invariants you must not break"):
 *
 *   1. `buildOutgoingHistory` keeps excluding booking entries structurally
 *      (byte-identical output with/without them in the thread).
 *   2. `replaceStreamingWithOutcome` does not swallow a trailing booking
 *      entry — only a trailing `kind:"streaming"` entry is ever dropped.
 *   3. `restoreEntriesFromMessages` never produces a `kind:"booking"` entry —
 *      every restored non-user message is a plain `kind:"answer"` entry.
 */
import { describe, expect, it } from "vitest";
import {
  buildOutgoingHistory,
  replaceStreamingWithOutcome,
  restoreEntriesFromMessages,
  type ChatEntry,
} from "../components/ai-chat/conversation";
import type { BookingQuestionView } from "../components/ai-chat/AiChatBookingStep";
import type { AiConversationMessageView } from "../lib/api-client";

const bookingView: BookingQuestionView = {
  kind: "question",
  step: "date",
  isCurrent: true,
  questionText: "Let's get Phu Chi Fa booked. Which day would you like?",
  chips: [{ kind: "date", date: "2026-08-08", remaining: 6 }],
  controls: [{ kind: "cancel" }],
};

function bookingEntry(id = "b1"): ChatEntry {
  return { id, role: "assistant", kind: "booking", step: "date", view: bookingView };
}

describe("buildOutgoingHistory (invariant 1) — booking entries never reach model history", () => {
  it("[normal] a thread WITH booking entries produces a byte-identical array to the same thread WITHOUT them", () => {
    const withoutBooking: ChatEntry[] = [
      { id: "1", role: "user", text: "หาแคมป์ภูชี้ฟ้า" },
      { id: "2", role: "assistant", kind: "answer", text: "เจอแล้วนะ", cards: [], zeroResult: false },
    ];
    const withBooking: ChatEntry[] = [
      withoutBooking[0]!,
      bookingEntry("b1"),
      withoutBooking[1]!,
      bookingEntry("b2"),
    ];

    const historyWithout = buildOutgoingHistory(withoutBooking, "อยากไปกี่คืน");
    const historyWith = buildOutgoingHistory(withBooking, "อยากไปกี่คืน");

    expect(historyWith).toEqual(historyWithout);
  });

  it("[boundary] a thread of ONLY booking entries sends just the new question", () => {
    const history = buildOutgoingHistory([bookingEntry("b1"), bookingEntry("b2")], "q");
    expect(history).toEqual([{ role: "user", content: "q" }]);
  });
});

describe("replaceStreamingWithOutcome (invariant 2) — a trailing booking entry is never swallowed", () => {
  it("[normal] a trailing booking entry falls through to append — it is not dropped like a streaming entry", () => {
    const entries: ChatEntry[] = [{ id: "1", role: "user", text: "q" }, bookingEntry("b1")];
    const next = replaceStreamingWithOutcome(entries, { kind: "ok", answer: "ตอบแล้ว", cards: [] }, "q");
    // Both the original booking entry AND the new answer are present —
    // nothing was dropped from `entries` before the outcome was appended.
    expect(next).toHaveLength(3);
    expect(next[1]).toEqual(bookingEntry("b1"));
    expect(next[2]).toMatchObject({ kind: "answer", text: "ตอบแล้ว" });
  });

  it("[normal] a trailing STREAMING entry is still dropped (unchanged prior behavior)", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "user", text: "q" },
      { id: "2", role: "assistant", kind: "streaming", text: "partial" },
    ];
    const next = replaceStreamingWithOutcome(entries, { kind: "ok", answer: "final", cards: [] }, "q");
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ kind: "answer", text: "final" });
  });
});

describe("restoreEntriesFromMessages (invariant 3) — never resurrects a booking turn", () => {
  function message(overrides: Partial<AiConversationMessageView>): AiConversationMessageView {
    return { id: "m1", role: "USER", seq: 0, contentText: "", blocks: null, createdAt: "2026-01-01T00:00:00.000Z", ...overrides };
  }

  it("[normal] every restored non-user message is a plain kind:answer entry, never kind:booking", () => {
    const messages: AiConversationMessageView[] = [
      message({ id: "m1", role: "USER", seq: 0, contentText: "หาแคมป์ริมน้ำ" }),
      message({ id: "m2", role: "ASSISTANT", seq: 1, contentText: "นี่เลยลานริมน้ำ" }),
    ];
    const restored = restoreEntriesFromMessages(messages);
    expect(restored.every((e) => e.role === "user" || e.kind !== "booking")).toBe(true);
    expect(restored[1]).toMatchObject({ role: "assistant", kind: "answer" });
  });

  it("[boundary] a message whose stored text happens to look like booking copy still restores as a plain answer (no live interactive block)", () => {
    const messages: AiConversationMessageView[] = [
      message({ id: "m1", role: "ASSISTANT", seq: 0, contentText: "ขั้นที่ 1 จาก 3 · เลือกวัน อยากไปวันไหนดี" }),
    ];
    const restored = restoreEntriesFromMessages(messages);
    expect(restored).toHaveLength(1);
    expect(restored[0]!.role).toBe("assistant");
    expect(restored[0]!.role === "assistant" && restored[0]!.kind).toBe("answer");
  });
});
