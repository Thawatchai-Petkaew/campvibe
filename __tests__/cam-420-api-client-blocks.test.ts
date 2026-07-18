/**
 * cam-420-api-client-blocks.test.ts — CAM-420 (ADR-013 D6) forward-compat
 * `blocks[]` envelope + `conversationId` addition to `lib/api-client.ts`'s
 * `parseAiChatSuccessBody`.
 *
 * The binding contract (pinned here): an unrecognized `blocks[].type` is
 * FORWARD-COMPAT DATA, never a parse failure — the client on an older build
 * must be able to receive a response carrying a future block type without
 * throwing or rejecting the whole turn. Only a STRUCTURALLY malformed entry
 * (missing/wrong-typed `type`/`v`) is dropped, mirroring how a malformed
 * card is already dropped by `isAiChatCardResponse`.
 *
 * AC -> test matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * AC-8 unknown block type -> kept, parse never throws (skip-render is the
 *      render layer's job — out of scope, no consuming UI exists yet).
 * EC-7 same as AC-8; malformed entries are dropped without dropping the rest.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from 'vitest';
import { parseAiChatSuccessBody } from '@/lib/api-client';

describe('parseAiChatSuccessBody — blocks[] envelope (AC-8, EC-7)', () => {
  it('[normal] absent blocks -> outcome has no `blocks` key (byte-identical to pre-CAM-420 shape)', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'ok', cards: [] });
    expect(outcome).toEqual({ kind: 'ok', answer: 'ok', cards: [] });
    expect(outcome).not.toHaveProperty('blocks');
  });

  it('[normal] a well-formed block with a KNOWN-shape but UNRECOGNIZED type string is kept, not rejected', () => {
    const outcome = parseAiChatSuccessBody({
      answer: 'ok',
      cards: [],
      blocks: [{ type: 'trip_plan_v9_future', v: 1, data: { foo: 'bar' } }],
    });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome.blocks).toEqual([{ type: 'trip_plan_v9_future', v: 1, data: { foo: 'bar' } }]);
  });

  it('[error/validation] a malformed entry (missing `v`) is dropped; a well-formed sibling in the same array survives', () => {
    const outcome = parseAiChatSuccessBody({
      answer: 'ok',
      cards: [],
      blocks: [{ type: 'bad' }, { type: 'good', v: 2, data: null }],
    });
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome.blocks).toEqual([{ type: 'good', v: 2, data: null }]);
  });

  it('[null/empty] an empty blocks array never crashes and yields no `blocks` key', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'ok', cards: [], blocks: [] });
    expect(outcome).not.toHaveProperty('blocks');
  });

  it('[boundary] `blocks` present but not an array does not crash — treated as absent', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'ok', cards: [], blocks: 'not-an-array' });
    expect(outcome.kind).toBe('ok');
    expect(outcome).not.toHaveProperty('blocks');
  });

  it('[normal] `conversationId` present on a v2 response is surfaced on the outcome', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'ok', cards: [], conversationId: 'conv-1' });
    if (outcome.kind !== 'ok') throw new Error('unreachable');
    expect(outcome.conversationId).toBe('conv-1');
  });

  it('[null/empty] `conversationId` absent (legacy response) -> outcome has no `conversationId` key', () => {
    const outcome = parseAiChatSuccessBody({ answer: 'ok', cards: [] });
    expect(outcome).not.toHaveProperty('conversationId');
  });
});
