/**
 * CAM-509 (S2/SEE pillar) — capture-only helper backing the `AssistantTurnLog`
 * table (prisma/schema.prisma). STORE ONLY (BR-2): no analysis, no LLM, no
 * network call beyond the single Prisma insert — the weekly `/ai-chat-improve`
 * skill (a separate follow-up, no card) is what reads and analyzes these rows
 * later, on the Claude subscription (zero paid API).
 *
 * Wired from the two turn-completion seams in `lib/ai/openrouter-client.ts`
 * (`runAssistantTurnFromMessages` + `runAssistantTurnFromMessagesStreaming`).
 *
 * BR-1 (fire-and-forget, never blocking) — `logAssistantTurn` never throws
 * and is never awaited by its caller. It prefers Next.js `after()` (keeps the
 * write alive past the response in a serverless runtime, EC-1); when
 * `after()` is unavailable (called outside a request scope — e.g. a direct
 * unit-test call to the openrouter-client functions), it falls back to an
 * un-awaited call to the same swallow-on-failure writer, so the turn's answer
 * is NEVER delayed or broken by a log-write failure (AC-4, EC-3).
 */
import 'server-only';
import { createHash } from 'crypto';
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

/** BR-5 — the only three path labels a completed turn can carry. */
export type AssistantTurnPath = 'guest_nonstream' | 'guest_sse' | 'authed';

/** One entry of the stored `toolCalls` JSON array (Data section — `{tool, params}` only, no transient bookkeeping fields). */
export interface AssistantTurnToolCall {
  tool: string;
  params: unknown;
}

/** The fully-assembled record `logAssistantTurn` writes — one row per completed turn. */
export interface AssistantTurnLogRecord {
  path: AssistantTurnPath;
  /** BR-4/EC-2 — a stable salted hash (see `hashUserId`), never the raw id; `null` for a guest turn. */
  userIdHash: string | null;
  userText: string;
  toolCalls: AssistantTurnToolCall[];
  assistantText: string | null;
  missFlags: string[];
  roundCount: number;
  latencyMs: number | null;
  model: string;
}

/**
 * BR-4/EC-2 — `sha256(userId + SALT)`, truncated to 32 hex chars (128 bits —
 * ample for de-dup/grouping in later analysis, never reversible back to the
 * raw id without the salt). `SALT` comes from env only (`AI_TURN_LOG_SALT`,
 * `.env.example`), never a committed real value; an unset salt in dev/CI
 * still yields a stable (if weaker) hash rather than throwing, so a missing
 * env var can never surface as a broken chat turn (BR-1).
 */
export function hashUserId(userId: string): string {
  const salt = process.env.AI_TURN_LOG_SALT ?? '';
  return createHash('sha256').update(`${userId}${salt}`).digest('hex').slice(0, 32);
}

/**
 * BR-3 — the deterministic, CHEAP miss-flag set computable at completion; no
 * text classification, no LLM (the semantic misses are the weekly skill's
 * Opus-analysis job, not this function's). `zero_result` reuses the existing
 * `searchAttempted && cards.length===0` signal already on `AssistantTurnResult`
 * (openrouter-client.ts); `deferred_tool` reuses the `dispatchTool`
 * `unknown_tool` code (tool-registry.ts); `no_tool` is suppressed (EC-4) when
 * `userText` is empty/whitespace — a no-input turn is signal, not a miss.
 */
export function computeMissFlags(input: {
  searchAttempted: boolean;
  cardCount: number;
  toolCallCount: number;
  deferredTool: boolean;
  userText: string;
}): string[] {
  const flags: string[] = [];
  if (input.searchAttempted && input.cardCount === 0) flags.push('zero_result');
  if (input.deferredTool) flags.push('deferred_tool');
  if (input.toolCallCount === 0 && input.userText.trim().length > 0) flags.push('no_tool');
  return flags;
}

/**
 * The actual Prisma insert, always wrapped so a throw (DB down, constraint,
 * connection error) is caught and logged server-side — never propagated
 * (BR-1/EC-3). No secret/PII in the log line (observability.md field
 * hygiene): only the path + error TYPE, never the raw error message/stack,
 * never userText/assistantText/userIdHash.
 */
async function writeTurnLog(record: AssistantTurnLogRecord): Promise<void> {
  try {
    await prisma.assistantTurnLog.create({
      data: {
        path: record.path,
        userIdHash: record.userIdHash,
        userText: record.userText,
        toolCalls: record.toolCalls as unknown as Prisma.InputJsonValue,
        assistantText: record.assistantText,
        missFlags: record.missFlags,
        roundCount: record.roundCount,
        latencyMs: record.latencyMs,
        model: record.model,
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'ai_turn_log_write_failed',
        path: record.path,
        errorType: error instanceof Error ? error.name : typeof error,
      })
    );
  }
}

/**
 * QA fix (post-merge-review, Important — proven, not theoretical): ~15
 * pre-existing test files call the openrouter-client seams without mocking
 * `@/lib/prisma`; Prisma auto-loads `.env`, so during `npm test` the
 * fire-and-forget write would otherwise land real synthetic rows (fake Thai
 * test strings, "connection refused" fixtures) in the SAME local dev DB the
 * owner's dev server reads and the future `/ai-chat-improve` skill mines for
 * real signal — silently polluting the corpus. Telemetry must never write
 * under the test runner, so this is a hard, unconditional guard, checked
 * BEFORE anything else in this function. `VITEST` and `NODE_ENV==='test'`
 * are both set by Vitest by default (never by `next dev`/`next build`, which
 * are `development`/`production`) — this can never disable real dev/prod
 * logging, only a real test run. A test that needs to prove the write path
 * itself (against a mocked `@/lib/prisma`) explicitly stubs both env vars
 * away first (`vi.stubEnv`) — see cam-509-assistant-turn-log.test.ts.
 */
function isTestRunner(): boolean {
  return Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';
}

/**
 * BR-1 — fire-and-forget: the caller never awaits this (a `void`-returning
 * function, not a Promise), so a slow or failing write can never add latency
 * to — or break — the chat response (AC-4, EC-1). Prefers `after()`
 * (Next.js request-scoped runtimes keep the function alive until the
 * callback settles, so the write survives a serverless response even when
 * un-awaited); when `after()` throws because it was called outside a request
 * scope (its own documented behavior — e.g. a direct unit-test call to the
 * openrouter-client seams), the fallback is an un-awaited call to the SAME
 * `writeTurnLog`, which already swallows its own errors internally — so the
 * fallback can never produce an unhandled promise rejection either.
 */
export function logAssistantTurn(record: AssistantTurnLogRecord): void {
  if (isTestRunner()) return;
  try {
    after(() => writeTurnLog(record));
  } catch {
    void writeTurnLog(record);
  }
}

/**
 * BR-4 retention — purge rows older than `days` (default 90). Called by the
 * weekly `/ai-chat-improve` skill run (and/or a cron) — never by the hot
 * chat path. Returns the number of rows deleted.
 */
export async function deleteTurnLogsOlderThan(days = 90): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.assistantTurnLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
