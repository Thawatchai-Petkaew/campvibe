/**
 * CAM-457 (tech.md §4) — the `GoldenCase` typed record (BR-1) + its zod
 * schema, used to validate the golden-case fixture at load (load-cases.ts).
 *
 * `utterance` is either a single Thai string (the common case) or an
 * ordered prior-turn list for a CONTEXT case — deliberately typed
 * structurally identical to `ChatMessage` (`lib/validations/ai-chat.ts`,
 * `{role: 'user'|'assistant', content: string}`) so the array can be handed
 * straight to the REAL `buildTurnMessages` (`lib/ai/build-turn-messages.ts`)
 * with no re-shaping — the harness never re-implements that seam (Seams &
 * refs, story.md).
 */
import { z } from 'zod';
import type { ChatMessage } from '@/lib/validations/ai-chat';

/** Structurally == ChatMessage (annotated so a future drift in either shape fails to compile, not silently). */
const turnMessageSchema: z.ZodType<ChatMessage> = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const expectedToolSchema = z.object({
  kind: z.literal('tool'),
  tool: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  /** BR-2 — default is subset match; set true to require an EXACT key-set match. */
  strictParams: z.boolean().optional(),
});

const expectedNoToolSchema = z.object({
  kind: z.literal('no_tool'),
});

/** BR-1 — a malformed/unparseable entry is a load error, never a crash (validated by `load-cases.ts`, never here). */
export const goldenCaseSchema = z.object({
  id: z.string().min(1),
  /** Corpus tag, e.g. "P1" | "P17" | "F" | ... — free-form string, not an enum (the real corpus's group set isn't known yet). */
  group: z.string().min(1),
  zone: z.enum(['A', 'B', 'C']),
  utterance: z.union([z.string().min(1), z.array(turnMessageSchema).min(1)]),
  /** Canned tool-result the mocked `dispatchTool` returns for every dispatched call this case makes (BR-4). Optional — defaults to a generic `{ok:true,data:{}}` when absent. */
  seededState: z.unknown().optional(),
  expected: z.discriminatedUnion('kind', [expectedToolSchema, expectedNoToolSchema]),
  /** BR-3/AC-4 — a single failing guardrail case flips the whole run's verdict, independent of the ≥95% tool-call threshold. */
  guardrail: z.boolean().optional(),
  /** tech.md §4 addition to BR-1 — runs with ctx={userId:'eval-user'} so authed-tier getMy* tools are offered and not rejected as unauthorized_tool; absent/false = guest ctx={} (default, matches prod). */
  auth: z.boolean().optional(),
});

export type GoldenCase = z.infer<typeof goldenCaseSchema>;
export type ExpectedTool = z.infer<typeof expectedToolSchema>;
export type ExpectedNoTool = z.infer<typeof expectedNoToolSchema>;
