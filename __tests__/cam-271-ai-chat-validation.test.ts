/**
 * CAM-271 BR-3, AC-7, EC-2 — lib/validations/ai-chat.ts (zod boundary)
 *
 * Coverage matrix:
 *   - normal: a minimal valid conversation (one user message) passes
 *   - normal: a valid multi-turn conversation (user + assistant alternating) passes
 *   - boundary: exactly MAX_CHAT_MESSAGES messages passes; MAX+1 fails
 *   - boundary: a message at exactly MAX_CHAT_MESSAGE_LENGTH passes; +1 char fails
 *   - error/validation: an unknown role is rejected
 *   - error/validation: no `user` message present is rejected (all-assistant)
 *   - null/empty: empty messages array is rejected; missing `messages` key rejected
 */
import { describe, it, expect } from 'vitest';
import { chatRequestSchema, MAX_CHAT_MESSAGES, MAX_CHAT_MESSAGE_LENGTH } from '../lib/validations/ai-chat';

function userMsg(content: string) {
  return { role: 'user' as const, content };
}
function assistantMsg(content: string) {
  return { role: 'assistant' as const, content };
}

describe('chatRequestSchema — normal', () => {
  it('[unit] accepts a minimal valid conversation (one user message)', () => {
    const result = chatRequestSchema.safeParse({ messages: [userMsg('หาลานกางเต็นท์ใกล้กรุงเทพ')] });
    expect(result.success).toBe(true);
  });

  it('[unit] accepts a valid multi-turn conversation (user + assistant alternating)', () => {
    const result = chatRequestSchema.safeParse({
      messages: [userMsg('หาลานกางเต็นท์ใกล้กรุงเทพ'), assistantMsg('พบ 3 แห่งครับ'), userMsg('แล้วอันแรกเสาร์นี้ว่างไหม')],
    });
    expect(result.success).toBe(true);
  });
});

describe('chatRequestSchema — boundary (message count)', () => {
  it('[boundary] accepts exactly MAX_CHAT_MESSAGES messages', () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES }, (_, i) =>
      i % 2 === 0 ? userMsg(`q${i}`) : assistantMsg(`a${i}`)
    );
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(true);
  });

  it('[boundary] rejects MAX_CHAT_MESSAGES + 1 messages (AC-7, EC-2)', () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, (_, i) =>
      i % 2 === 0 ? userMsg(`q${i}`) : assistantMsg(`a${i}`)
    );
    const result = chatRequestSchema.safeParse({ messages });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestSchema — boundary (message length)', () => {
  it('[boundary] accepts a message at exactly MAX_CHAT_MESSAGE_LENGTH characters', () => {
    const result = chatRequestSchema.safeParse({ messages: [userMsg('a'.repeat(MAX_CHAT_MESSAGE_LENGTH))] });
    expect(result.success).toBe(true);
  });

  it('[boundary] rejects a message exceeding MAX_CHAT_MESSAGE_LENGTH by 1 char (AC-7, EC-2)', () => {
    const result = chatRequestSchema.safeParse({ messages: [userMsg('a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1))] });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestSchema — error/validation', () => {
  it('[error] rejects an unknown role (e.g. system) — AC-7, EC-2', () => {
    const result = chatRequestSchema.safeParse({ messages: [{ role: 'system', content: 'hi' }] });
    expect(result.success).toBe(false);
  });

  it('[error] rejects a conversation with no user message present (all-assistant) — BR-3', () => {
    const result = chatRequestSchema.safeParse({ messages: [assistantMsg('สวัสดีครับ')] });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestSchema — null/empty/malformed', () => {
  it('[null/empty] rejects an empty messages array', () => {
    const result = chatRequestSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('[null/empty] rejects a missing `messages` key (malformed body) — AC-7, EC-2', () => {
    const result = chatRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('[null/empty] rejects a non-object body (malformed body)', () => {
    const result = chatRequestSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('[null/empty] rejects a message missing `content`', () => {
    const result = chatRequestSchema.safeParse({ messages: [{ role: 'user' }] });
    expect(result.success).toBe(false);
  });
});
