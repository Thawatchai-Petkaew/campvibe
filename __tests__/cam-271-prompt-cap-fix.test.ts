/**
 * CAM-271 — functional-security fix (post-merge finding):
 * `sanitizeForPrompt`'s default 2000-char cap, applied to the WHOLE
 * serialized transcript, silently truncated FROM THE END — cutting off the
 * newest turn (the camper's current question) on any thread whose combined
 * length exceeded MAX_USER_TEXT_LENGTH (zod alone permits up to
 * 10 x 2000 = 20000 chars). Fix: `MAX_PROMPT_CHARS` (12000) is a
 * transcript-level cap applied in `serializeConversation` — over cap, the
 * OLDEST messages are dropped whole (never mid-message) so the newest turn
 * always survives; that already-bounded string is then forwarded through
 * `runAssistantTurn`'s new `maxPromptChars` option so `sanitizeForPrompt`
 * does not re-cut it back down to the single-message default.
 *
 * Coverage matrix:
 *   - boundary: a 10-message transcript near the zod max drops the OLDEST
 *     messages, keeps the newest user turn verbatim, stays <= MAX_PROMPT_CHARS
 *   - security: proves the ACTUAL bug (sanitizeForPrompt's default cap loses
 *     the newest turn) and proves the fix (the override preserves it)
 *   - normal: single-turn / short-transcript behavior is unaffected
 *   - null/empty: an empty conversation still serializes safely
 */
import { describe, it, expect } from 'vitest';
import { serializeConversation, MAX_PROMPT_CHARS } from '../lib/ai/serialize-conversation';
import { sanitizeForPrompt, MAX_USER_TEXT_LENGTH } from '../lib/ai/sanitize';
import type { ChatMessage } from '../lib/validations/ai-chat';

/** A MAX_CHAT_MESSAGE_LENGTH-ish, uniquely-markable message body. */
function longContent(marker: string, length = 2000): string {
  return `${marker} `.padEnd(length, 'x');
}

function tenMessageTranscript(): ChatMessage[] {
  return Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: longContent(`MARKER_${i}`),
  }));
}

describe('serializeConversation — MAX_PROMPT_CHARS transcript cap (boundary)', () => {
  it('[boundary] a 10-message transcript near the zod max drops the OLDEST messages, keeps the newest turn verbatim, and stays within MAX_PROMPT_CHARS', () => {
    const result = serializeConversation(tenMessageTranscript());

    expect(result.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    // The newest turn (last message, index 9 — the camper's current question) survives intact.
    expect(result).toContain('MARKER_9');
    // The oldest turn was dropped to make room.
    expect(result).not.toContain('MARKER_0');
  });

  it('[boundary] a transcript already within MAX_PROMPT_CHARS is returned unchanged (nothing dropped)', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'หาลานกางเต็นท์ใกล้กรุงเทพ' },
      { role: 'assistant', content: 'พบ 3 แห่งครับ' },
      { role: 'user', content: 'แล้วอันแรกเสาร์นี้ว่างไหม' },
    ];
    const result = serializeConversation(messages);
    expect(result).toBe(
      'user: หาลานกางเต็นท์ใกล้กรุงเทพ\nassistant: พบ 3 แห่งครับ\nuser: แล้วอันแรกเสาร์นี้ว่างไหม'
    );
  });

  it('[null/empty] an empty conversation still serializes to an empty string, no crash', () => {
    expect(serializeConversation([])).toBe('');
  });
});

describe('sanitizeForPrompt — proves the bug AND the fix (security)', () => {
  it('[security] WITHOUT the transcript-level override, the newest turn is lost — this is the bug the finding reported', () => {
    const transcript = serializeConversation(tenMessageTranscript());
    // The bounded transcript is still longer than the single-message default cap.
    expect(transcript.length).toBeGreaterThan(MAX_USER_TEXT_LENGTH);

    const withoutOverride = sanitizeForPrompt(transcript); // old call shape (1 arg)
    expect(withoutOverride.length).toBe(MAX_USER_TEXT_LENGTH);
    expect(withoutOverride).not.toContain('MARKER_9'); // the newest turn is gone
  });

  it('[security] WITH the MAX_PROMPT_CHARS override, the newest turn survives sanitization intact', () => {
    const transcript = serializeConversation(tenMessageTranscript());

    const withOverride = sanitizeForPrompt(transcript, MAX_PROMPT_CHARS);
    expect(withOverride.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    expect(withOverride).toContain('MARKER_9'); // the fix: newest turn survives
  });
});

describe('sanitizeForPrompt — single-string callers unchanged (backward-compat, normal)', () => {
  it('[normal] a short single-turn question is unaffected by the new optional parameter', () => {
    expect(sanitizeForPrompt('มีแคมป์ริมทะเลไหมคะ')).toBe('มีแคมป์ริมทะเลไหมคะ');
  });

  it('[boundary] default cap (no second arg) still truncates at MAX_USER_TEXT_LENGTH — unchanged single-turn behavior', () => {
    const long = 'a'.repeat(MAX_USER_TEXT_LENGTH + 500);
    const result = sanitizeForPrompt(long);
    expect(result.length).toBe(MAX_USER_TEXT_LENGTH);
  });

  it('[boundary] leaves input at exactly MAX_USER_TEXT_LENGTH unchanged (default arg)', () => {
    const exact = 'b'.repeat(MAX_USER_TEXT_LENGTH);
    expect(sanitizeForPrompt(exact)).toBe(exact);
  });
});
