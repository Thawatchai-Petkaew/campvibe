/**
 * CAM-271 AC-2, Seams & refs (traced pipeline, CAM-342 lesson) —
 * lib/ai/serialize-conversation.ts
 *
 * Coverage matrix:
 *   - normal: a single user message serializes to one labelled line
 *   - normal: a multi-turn conversation preserves order + every turn's role label
 *   - null/empty: an empty array serializes to an empty string, no crash
 */
import { describe, it, expect } from 'vitest';
import { serializeConversation } from '../lib/ai/serialize-conversation';
import type { ChatMessage } from '../lib/validations/ai-chat';

describe('serializeConversation', () => {
  it('[unit] serializes a single user message to one labelled line', () => {
    const messages: ChatMessage[] = [{ role: 'user', content: 'หาลานกางเต็นท์ใกล้กรุงเทพ' }];
    expect(serializeConversation(messages)).toBe('user: หาลานกางเต็นท์ใกล้กรุงเทพ');
  });

  it('[unit] preserves turn order + role label across a multi-turn conversation (AC-2)', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'หาลานกางเต็นท์ใกล้กรุงเทพ' },
      { role: 'assistant', content: 'พบ 3 แห่งครับ' },
      { role: 'user', content: 'แล้วอันแรกเสาร์นี้ว่างไหม' },
    ];
    const result = serializeConversation(messages);
    expect(result).toBe(
      'user: หาลานกางเต็นท์ใกล้กรุงเทพ\nassistant: พบ 3 แห่งครับ\nuser: แล้วอันแรกเสาร์นี้ว่างไหม'
    );
    // Order is preserved: the earlier turns appear before the later ones.
    expect(result.indexOf('หาลานกางเต็นท์')).toBeLessThan(result.indexOf('พบ 3 แห่ง'));
    expect(result.indexOf('พบ 3 แห่ง')).toBeLessThan(result.indexOf('เสาร์นี้ว่างไหม'));
  });

  it('[null/empty] serializes an empty array to an empty string, no crash', () => {
    expect(serializeConversation([])).toBe('');
  });
});
