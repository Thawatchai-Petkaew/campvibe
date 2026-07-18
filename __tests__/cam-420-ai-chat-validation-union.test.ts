/**
 * cam-420-ai-chat-validation-union.test.ts — CAM-420 (ADR-013 D6)
 * `lib/validations/ai-chat.ts`'s new `chatRequestV2Schema` +
 * `chatRequestUnionSchema` (the route's ONE input contract, legacy-first).
 *
 * Coverage matrix:
 *   - normal: a v2 body ({message}, {conversationId, message}) parses
 *   - normal: a legacy body ({messages}) still parses via the union
 *   - boundary: message at exactly MAX_CHAT_MESSAGE_LENGTH passes; +1 fails
 *   - error/validation: a non-UUID conversationId is rejected; a body
 *     matching neither shape is rejected
 *   - null/empty: missing `message` (v2) / missing `messages` (legacy) with
 *     no other match -> the union itself fails
 */
import { describe, it, expect } from 'vitest';
import {
  chatRequestV2Schema,
  chatRequestUnionSchema,
  MAX_CHAT_MESSAGE_LENGTH,
} from '../lib/validations/ai-chat';

describe('chatRequestV2Schema — normal', () => {
  it('[unit] accepts {message} with no conversationId', () => {
    const result = chatRequestV2Schema.safeParse({ message: 'หาลานกางเต็นท์ใกล้กรุงเทพ' });
    expect(result.success).toBe(true);
  });

  it('[unit] accepts {conversationId, message} when conversationId is a real UUID', () => {
    const result = chatRequestV2Schema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440010',
      message: 'แล้วอันแรกเสาร์นี้ว่างไหม',
    });
    expect(result.success).toBe(true);
  });
});

describe('chatRequestV2Schema — boundary (message length)', () => {
  it('[boundary] accepts a message at exactly MAX_CHAT_MESSAGE_LENGTH characters', () => {
    const result = chatRequestV2Schema.safeParse({ message: 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH) });
    expect(result.success).toBe(true);
  });

  it('[boundary] rejects a message exceeding MAX_CHAT_MESSAGE_LENGTH by 1 char', () => {
    const result = chatRequestV2Schema.safeParse({ message: 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestV2Schema — error/validation', () => {
  it('[error] rejects a non-UUID conversationId', () => {
    const result = chatRequestV2Schema.safeParse({ conversationId: 'not-a-uuid', message: 'hi' });
    expect(result.success).toBe(false);
  });

  it('[null/empty] rejects a body missing `message`', () => {
    const result = chatRequestV2Schema.safeParse({ conversationId: '550e8400-e29b-41d4-a716-446655440010' });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestUnionSchema — legacy-first union', () => {
  it('[normal] a legacy {messages} body parses via the LEGACY branch (round-trips to the same shape)', () => {
    const result = chatRequestUnionSchema.safeParse({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result.success).toBe(true);
    if (result.success) expect('messages' in result.data).toBe(true);
  });

  it('[normal] a v2 {message} body parses via the V2 branch', () => {
    const result = chatRequestUnionSchema.safeParse({ message: 'hi' });
    expect(result.success).toBe(true);
    if (result.success) expect('messages' in result.data).toBe(false);
  });

  it('[normal] a v2 {conversationId, message} body parses via the V2 branch', () => {
    const result = chatRequestUnionSchema.safeParse({
      conversationId: '550e8400-e29b-41d4-a716-446655440010',
      message: 'hi',
    });
    expect(result.success).toBe(true);
    if (result.success) expect('messages' in result.data).toBe(false);
  });

  it('[error/validation] a body matching NEITHER shape is rejected (empty object)', () => {
    const result = chatRequestUnionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('[error/validation] an empty legacy messages array matches neither shape (fails legacy min(1) and has no `message` for v2)', () => {
    const result = chatRequestUnionSchema.safeParse({ messages: [] });
    expect(result.success).toBe(false);
  });

  it('[null/empty] a non-object body is rejected', () => {
    const result = chatRequestUnionSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('[boundary] an over-length v2 message matches neither shape -> rejected', () => {
    const result = chatRequestUnionSchema.safeParse({ message: 'a'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});
