/**
 * cam-430-search-attempted-wire.test.ts — CAM-430 (QA-authored gap closure)
 *
 * BR-1/Reader-writer sweep (story.md) names the exact chain:
 *   openrouter-client (AssistantTurnResult.searchAttempted)
 *     -> app/api/ai/chat/route.ts (reads it, writes the wire body — BOTH
 *        the legacy and v2 branches)
 *     -> lib/api-client.ts (parseAiChatSuccessBody parses the wire body into
 *        AiChatOutcome.searchAttempted)
 *     -> components/ai-chat/conversation.ts (appendOutcome reads it).
 *
 * The openrouter-client layer is covered by cam-270/cam-415/cam-416-*, and
 * the conversation.ts layer by cam-272-ai-chat-conversation.test.ts's
 * appendOutcome block — but NEITHER middle layer (route.ts's wire
 * serialization, api-client.ts's wire parse) had a direct test before this
 * file: every existing route/api-client fixture simply never set
 * `searchAttempted` on its mocked turn result, so the two `if
 * (result.searchAttempted === true) body.searchAttempted = true;` branches
 * (legacy + v2) and api-client.ts's `if (searchAttempted === true)
 * outcome.searchAttempted = true;` line were 100% uncovered by any test
 * that actually exercises them (same category of gap QA closed for CAM-427's
 * options[] trim branch — see that story's test.md Defects section).
 *
 * Coverage matrix:
 *   - normal: searchAttempted:true on the turn result -> ships in the wire
 *     body (legacy + v2); a wire body carrying searchAttempted:true parses
 *     to outcome.searchAttempted === true.
 *   - null/empty: a turn/body with NO searchAttempted key keeps the exact
 *     pre-CAM-430 key set (byte-identical, BR-1 "absent means no signal").
 *   - boundary/error: a wire body sending `searchAttempted: false` (a
 *     malformed/future producer) must NOT flip the parsed outcome to true —
 *     absent and false must never diverge in the consumer's eyes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { _store } from '@/lib/rate-limit';
import { parseAiChatSuccessBody } from '@/lib/api-client';

const mockRunAssistantTurn = vi.fn();
vi.mock('@/lib/ai/openrouter-client', () => ({
  runAssistantTurnFromMessages: (...args: unknown[]) => mockRunAssistantTurn(...args),
}));

const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockCreateConversation = vi.fn();
const mockLoadWindow = vi.fn();
const mockAppendTurn = vi.fn();
vi.mock('@/lib/ai/conversation-store', () => ({
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  loadWindow: (...args: unknown[]) => mockLoadWindow(...args),
  appendTurn: (...args: unknown[]) => mockAppendTurn(...args),
  // CAM-460 (D1) — handleV2Turn now calls deriveShownState(history) on every
  // v2 turn; this file doesn't assert on shown-results content, so a static
  // "nothing shown" stub keeps every existing assertion here unchanged.
  deriveShownState: () => ({ lastResults: [], shownIds: [] }),
  MAX_CONTENT_TEXT_LENGTH: 4000,
}));

const { POST } = await import('@/app/api/ai/chat/route');

const USER_ID = '550e8400-e29b-41d4-a716-446655440001';
const CONVERSATION_ID = '550e8400-e29b-41d4-a716-446655440010';

function makeSession(userId: string) {
  return { user: { id: userId, email: 'test@campvibe.com', name: 'Tester' } };
}

function makeRequest(body: unknown, ip: string): NextRequest {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

let ipCounter = 700;
function freshIp(): string {
  ipCounter += 1;
  return `203.0.117.${ipCounter}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  _store.clear();
});

describe('POST /api/ai/chat — legacy {messages} path forwards searchAttempted', () => {
  it('[normal] a turn result with searchAttempted:true ships it in the 200 body', async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'พบแคมป์ครับ', cards: [], searchAttempted: true });

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'หาแคมป์' }] }, freshIp()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ answer: 'พบแคมป์ครับ', cards: [], searchAttempted: true });
  });

  it('[null/empty] a turn result with no searchAttempted keeps the EXACT pre-CAM-430 key set', async () => {
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'สวัสดีครับ', cards: [] });

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'สวัสดี' }] }, freshIp()));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['answer', 'cards']);
    expect(body).toEqual({ answer: 'สวัสดีครับ', cards: [] });
  });
});

describe('POST /api/ai/chat — v2 {message} path forwards searchAttempted', () => {
  it('[normal] a turn result with searchAttempted:true ships it alongside conversationId', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    mockCreateConversation.mockResolvedValueOnce({ ok: true, data: { id: CONVERSATION_ID } });
    mockRunAssistantTurn.mockResolvedValueOnce({
      ok: true,
      answer: 'พบแคมป์ 2 แห่งครับ',
      cards: [{ id: 'c1' }],
      searchAttempted: true,
    });
    mockAppendTurn.mockResolvedValueOnce({ ok: true, data: { userMessageId: 'u1', assistantMessageId: 'a1' } });

    const res = await POST(makeRequest({ message: 'หาลานกางเต็นท์ใกล้กรุงเทพ' }, freshIp()));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      answer: 'พบแคมป์ 2 แห่งครับ',
      cards: [{ id: 'c1' }],
      searchAttempted: true,
      conversationId: CONVERSATION_ID,
    });
  });

  it('[null/empty] a turn result with no searchAttempted omits the key (byte-identical to pre-CAM-430)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(USER_ID));
    mockCreateConversation.mockResolvedValueOnce({ ok: true, data: { id: CONVERSATION_ID } });
    mockRunAssistantTurn.mockResolvedValueOnce({ ok: true, answer: 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ', cards: [] });
    mockAppendTurn.mockResolvedValueOnce({ ok: true, data: { userMessageId: 'u2', assistantMessageId: 'a2' } });

    const res = await POST(makeRequest({ message: 'สวัสดี' }, freshIp()));
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['answer', 'cards', 'conversationId']);
  });
});

describe('parseAiChatSuccessBody — searchAttempted parse (api-client.ts wire boundary)', () => {
  it('[normal] a wire body with searchAttempted:true parses to outcome.searchAttempted === true', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'พบแคมป์ครับ', cards: [], searchAttempted: true });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome.searchAttempted).toBe(true);
  });

  it('[null/empty] a wire body with no searchAttempted key leaves the outcome without the property (absent, never a defined false)', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'สวัสดีครับ', cards: [] });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome).not.toHaveProperty('searchAttempted');
  });

  it('[error/validation] a wire body sending searchAttempted:false (a malformed/future producer) is treated as absent, never coerced to true', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'สวัสดีครับ', cards: [], searchAttempted: false });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome).not.toHaveProperty('searchAttempted');
  });
});
