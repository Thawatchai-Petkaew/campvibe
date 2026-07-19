/**
 * CAM-412 — components/ai-chat/conversation.ts streaming-entry helpers
 * (`appendOrStartStreamingDelta` / `replaceStreamingWithOutcome`). Pure,
 * framework-free unit tests (mirrors __tests__/cam-272-ai-chat-conversation.test.ts's
 * treatment of the rest of this state machine).
 *
 * AC -> test matrix
 * ───────────────────────────────────────────────────────────────────────
 * AC-1  first delta creates the transient streaming entry; further deltas
 *       append onto the SAME entry (same id), never a duplicate row.
 * AC-1/AC-4 settling replaces the streaming entry with the normal "answer"
 *       entry (cards/suggestions attached) — never both shown at once.
 * AC-4  a mid-stream "error" outcome discards the partial (drops the
 *       streaming entry, appends the error notice instead).
 * AC-8/EC-7 a turn that never streamed anything (JSON-fallback path, zero
 *       deltas) still settles correctly — `replaceStreamingWithOutcome` is a
 *       no-op pass-through to `appendOutcome` when there's no streaming
 *       entry to drop.
 * ───────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from 'vitest';
import {
  appendOrStartStreamingDelta,
  appendUserQuestion,
  buildOutgoingHistory,
  replaceStreamingWithOutcome,
} from '@/components/ai-chat/conversation';
import type { AiChatOutcome } from '@/lib/api-client';

describe('appendOrStartStreamingDelta (AC-1)', () => {
  it('[normal] the first delta creates ONE transient streaming entry', () => {
    const base = appendUserQuestion([], 'หาแคมป์');
    const withDelta = appendOrStartStreamingDelta(base, 'พบแคมป์ ');
    expect(withDelta).toHaveLength(2);
    const last = withDelta[withDelta.length - 1];
    expect(last).toMatchObject({ role: 'assistant', kind: 'streaming', text: 'พบแคมป์ ' });
  });

  it('[normal] subsequent deltas append onto the SAME entry (same id), never a duplicate row', () => {
    let entries = appendUserQuestion([], 'q');
    entries = appendOrStartStreamingDelta(entries, 'พบแคมป์ ');
    const idAfterFirst = entries[entries.length - 1].id;
    entries = appendOrStartStreamingDelta(entries, '2 แห่งครับ');
    expect(entries).toHaveLength(2); // still just [user, streaming] — no duplicate
    const last = entries[entries.length - 1];
    expect(last.id).toBe(idAfterFirst);
    expect(last).toMatchObject({ kind: 'streaming', text: 'พบแคมป์ 2 แห่งครับ' });
  });

  it('[null/empty] an empty-string delta is a safe no-op append (never crashes, never duplicates)', () => {
    let entries = appendUserQuestion([], 'q');
    entries = appendOrStartStreamingDelta(entries, '');
    expect(entries[entries.length - 1]).toMatchObject({ kind: 'streaming', text: '' });
  });
});

describe('replaceStreamingWithOutcome (AC-1/AC-4/AC-8)', () => {
  const okOutcome: AiChatOutcome = { kind: 'ok', answer: 'พบแคมป์ 2 แห่งครับ', cards: [] };

  it('[normal] settling replaces the streaming entry with the normal answer entry — never both at once', () => {
    let entries = appendUserQuestion([], 'q');
    entries = appendOrStartStreamingDelta(entries, 'พบแคมป์ 2 แห่งครับ');
    const settled = replaceStreamingWithOutcome(entries, okOutcome, 'q');

    expect(settled).toHaveLength(2); // [user, answer] — streaming entry is GONE, not appended alongside
    const last = settled[settled.length - 1];
    expect(last).toMatchObject({ role: 'assistant', kind: 'answer', text: 'พบแคมป์ 2 แห่งครับ' });
    expect(settled.some((e) => 'kind' in e && e.kind === 'streaming')).toBe(false);
  });

  it('[error] AC-4: a mid-stream error outcome DISCARDS the partial — drops the streaming entry, appends the error notice', () => {
    let entries = appendUserQuestion([], 'q');
    entries = appendOrStartStreamingDelta(entries, 'เริ่มตอบแล้วแต่');
    const settled = replaceStreamingWithOutcome(entries, { kind: 'error' }, 'q');

    expect(settled).toHaveLength(2);
    const last = settled[settled.length - 1];
    expect(last).toMatchObject({ role: 'assistant', kind: 'error', retryQuestion: 'q' });
    // The partial text never survives anywhere in the settled entries.
    expect(JSON.stringify(settled)).not.toContain('เริ่มตอบแล้วแต่');
  });

  it('[null/empty] EC-7: a turn with ZERO deltas (no streaming entry ever created) still settles correctly', () => {
    const entries = appendUserQuestion([], 'q'); // no appendOrStartStreamingDelta ever called
    const settled = replaceStreamingWithOutcome(entries, okOutcome, 'q');
    expect(settled).toHaveLength(2);
    expect(settled[settled.length - 1]).toMatchObject({ kind: 'answer', text: okOutcome.kind === 'ok' ? okOutcome.answer : '' });
  });

  it('[concurrent] an "aborted" outcome (client-internal only) discards the partial with no new entry appended', () => {
    const base = appendUserQuestion([], 'q');
    const withDelta = appendOrStartStreamingDelta(base, 'บางส่วน');
    const settled = replaceStreamingWithOutcome(withDelta, { kind: 'aborted' } as AiChatOutcome, 'q');
    expect(settled).toEqual(base); // back to just the user bubble — streaming entry dropped, nothing appended
  });
});

describe('ChatEntry — the streaming entry never flows into outgoing history', () => {
  it('[null/empty] buildOutgoingHistory silently EXCLUDES an in-flight streaming entry (never sent back as a fake "assistant said X" history turn)', () => {
    const base = appendUserQuestion([], 'q1');
    const withStreaming = appendOrStartStreamingDelta(base, 'ยังตอบไม่จบ');
    const history = buildOutgoingHistory(withStreaming, 'q2');
    // Only the two real user turns reach the wire — the growing partial
    // answer is neither role:"user" nor kind:"answer", so it is skipped.
    expect(history).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'user', content: 'q2' },
    ]);
  });
});
