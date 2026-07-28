// lib/delivery/validations.ts — zod schemas at the app/api/tickets/* boundary (.claude/rules/api.md
// §1). Re-parses every request; client validation is UX only and is never trusted.
//
// Enum literal tuples are hand-written (not derived from the generated Prisma client) so this
// file has zero dependency on `npm run delivery:generate` having run — a pure zod module,
// consistent with the rest of lib/validations/*. __tests__/delivery-tickets-api.test.ts
// asserts these literal lists stay in lockstep with prisma/delivery/schema.prisma's enums
// (a drift guard, not a runtime dependency).
import { z } from "zod";

export const TICKET_TYPES = ["EPIC", "STORY", "TASK"] as const;
// CAM-342: model-tier trial instrumentation. Lowercase (BR-1) -- distinct casing convention
// from the SCREAMING_SNAKE enum tuples above, matching the exact display string stored/shown
// (the chip/modal render this value verbatim, pass-through -- no relabeling table).
export const AGENT_MODEL_TIERS = ["fable", "opus", "sonnet", "haiku"] as const;
export const DELIVERY_ROLES = [
  "PRODUCT_OWNER",
  "ANALYST",
  "ARCHITECT",
  "UX_DESIGNER",
  "FRONTEND_ENGINEER",
  "BACKEND_ENGINEER",
  "QA_ENGINEER",
  "SECURITY_REVIEWER",
  "DEVOPS_RELEASE",
] as const;
export const PERSONAS = ["HOST", "CAMPER", "ADMIN", "PLATFORM"] as const;
export const TICKET_STATES = ["BACKLOG", "TODO", "IN_PROGRESS", "AWAITING_GATE", "DONE", "CANCELED"] as const;

// CAM-595: the bounded-list-read cap shared by lib/delivery/tickets.ts (listTickets, behind
// the CLI) and lib/delivery/status-adapter.ts (fetchTicketsFromDbRaw, behind the /status
// board). Lives here (not in tickets.ts) specifically so status-adapter.ts can import the
// SAME value without pulling in tickets.ts's heavy mutation-side dependency graph (notify,
// github-dispatch, notify-messages) just to read a number -- a shared constant makes the
// "these two caps match" claim enforced by the type system instead of a comment's promise
// (the previous comment drifted silently into a bug: see tech.md). Raised from the original
// 500: measured 2026-07-28 there were 534 unarchived tickets already past the old cap, so
// 500 was ALREADY too small; 1000 buys headroom but is a deliberate deferral, not a fix --
// see docs/specs/.../CAM-595-ticket-list-truncation/tech.md for when this next bites and the
// alternatives considered (raise further / paginate / archive old DONE tickets).
export const TICKET_LIST_TAKE_CAP = 1000;

const ticketTypeSchema = z.enum(TICKET_TYPES);
const deliveryRoleSchema = z.enum(DELIVERY_ROLES);
const personaSchema = z.enum(PERSONAS);
const ticketStateSchema = z.enum(TICKET_STATES);
const agentModelSchema = z.enum(AGENT_MODEL_TIERS);
export type AgentModelTier = (typeof AGENT_MODEL_TIERS)[number];

/** Free-text actor (G2-locked — no FK to a User table; see ADR-010 open trade-off #3). */
const actorSchema = z.string().trim().min(1).max(200);

// ── POST /api/tickets ────────────────────────────────────────────────────────────────────

export const createTicketBodySchema = z.object({
  actor: actorSchema,
  title: z.string().trim().min(1).max(300),
  type: ticketTypeSchema,
  description: z.string().max(20000).optional(),
  epicId: z.string().min(1).max(30).optional(),
  persona: personaSchema.optional(),
  featureName: z.string().max(200).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  currentRole: deliveryRoleSchema.optional(),
  legacyUrl: z.string().url().refine((u) => /^https?:\/\//.test(u), "legacyUrl must be http(s)").optional(),
  legacyLabels: z.array(z.string().max(100)).max(50).optional(),
});
export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

// ── GET /api/tickets?state=&epicId=&archived=&mode= ────────────────────────────────────

// CAM-595: `mode` is a targeted server-side read for the two surfaces that answer "what
// needs a human decision" / "does the newest work conform" — a bounded, client-side-filtered
// scan of the first page is a WRONG answer there, not a partial one (a gate raised on a
// ticket past the cap must still be seen). Mutually exclusive with state/epicId (a fully
// different where-shape — see lib/delivery/tickets.ts buildTicketWhere):
//   "gate"  -> state=AWAITING_GATE OR changesRequested=true (everything `gates` must show)
//   "audit" -> type=EPIC OR state!=DONE (everything `audit` must show, PLUS every epic even
//              a long-Done one, so a story's feature/epic name still resolves for its
//              docs/specs path)
const listTicketsModeSchema = z.enum(["gate", "audit"]);

// CAM-602: `.strict()` -- any query key besides state/epicId/archived/mode is rejected with
// 400 invalid_query, not silently dropped (zod's `z.object` default). Decision + full
// reasoning: docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-602-prove-the-mode/
// tech.md. Summary: GET /api/tickets has exactly two real callers (scripts/ticket-sync.mjs,
// scripts/parity-check.mjs), both internal tooling -- no browser ever hits this endpoint with
// an incidental tracking/cache-busting param, so there is no "friendly to browsers" upside to
// weigh against the cost of a future param silently vanishing the same way `mode` did on an
// older server during CAM-595's own rollout. `token` (the STATUS_TOKEN auth transport,
// lib/status-auth.ts) is deliberately NOT part of this schema -- app/api/tickets/route.ts
// strips it from the reflected query object before parsing, because it is an authz concern,
// not a data field this endpoint's contract owns. This is the systemic half of the CAM-602
// fix: the NEXT query param added to this endpoint inherits "unrecognized key = 400" for
// free, with no per-field re-derivation -- it cannot, however, retroactively make an
// ALREADY-deployed pre-CAM-595 server reject `mode` (that server's route code never read the
// key off the URL at all); see tech.md for why the client-side refusal
// (scripts/lib/ticket-sync-mode-proof.mjs) is the defense for that half.
export const listTicketsQuerySchema = z
  .object({
    state: ticketStateSchema.optional(),
    epicId: z.string().min(1).max(30).optional(),
    archived: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === "true")),
    mode: listTicketsModeSchema.optional(),
  })
  .strict()
  .refine((v) => !(v.mode && (v.state || v.epicId)), {
    message: "mode is mutually exclusive with state/epicId (a different targeted where-shape)",
    path: ["mode"],
  });
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

// ── PATCH /api/tickets/[id] — { action, ...params } discriminated union ────────────────

const noteMaxLen = 4000;

export const patchTicketBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    actor: actorSchema,
    role: deliveryRoleSchema.optional(),
    // trial-2 feedback (CAM-342 follow-up): the `start` verb can also carry the model-tier
    // stamp -- omitted leaves Ticket.agentModel unchanged (BR-3); a value outside
    // AGENT_MODEL_TIERS fails here with 400 (BR-1, EC-3), same as handoff/updateFields.
    agentModel: agentModelSchema.optional(),
  }),
  z.object({ action: z.literal("raiseGate"), actor: actorSchema, note: z.string().max(noteMaxLen).optional() }),
  z.object({
    action: z.literal("approve"),
    actor: actorSchema,
    nextRole: deliveryRoleSchema.optional(),
  }),
  z.object({ action: z.literal("reject"), actor: actorSchema, note: z.string().max(noteMaxLen).optional() }),
  z.object({ action: z.literal("complete"), actor: actorSchema }),
  z.object({ action: z.literal("release"), actor: actorSchema }),
  // CAM-370: durable on-staging marker — no extra params (mirrors "release" above).
  z.object({ action: z.literal("stage"), actor: actorSchema }),
  z.object({ action: z.literal("cancel"), actor: actorSchema, note: z.string().max(noteMaxLen).optional() }),
  z.object({
    action: z.literal("reopen"),
    actor: actorSchema,
    // Required, non-empty (G2-locked): reopen without a note is a 400, enforced again in
    // the service layer (defense in depth — zod here, assertion there).
    note: z.string().trim().min(1).max(noteMaxLen),
  }),
  z.object({
    action: z.literal("handoff"),
    actor: actorSchema,
    role: deliveryRoleSchema,
    note: z.string().max(noteMaxLen).optional(),
    // CAM-342: optional model-tier stamp -- omitted leaves Ticket.agentModel unchanged
    // (BR-3, EC-4); a value outside AGENT_MODEL_TIERS fails here with 400 (BR-1, EC-3).
    agentModel: agentModelSchema.optional(),
  }),
  z.object({ action: z.literal("archive"), actor: actorSchema }),
  z.object({ action: z.literal("unarchive"), actor: actorSchema }),
  z.object({
    action: z.literal("setBlocked"),
    actor: actorSchema,
    blocked: z.boolean(),
    note: z.string().max(noteMaxLen).optional(),
  }),
  z.object({
    action: z.literal("updateFields"),
    actor: actorSchema,
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(20000).nullable().optional(),
    priority: z.number().int().min(0).max(4).optional(),
    persona: personaSchema.nullable().optional(),
    featureName: z.string().max(200).nullable().optional(),
    // CAM-300: re-parent — accepts a CAM identifier or internal id (resolved + type-checked
    // in the service), or null to detach from its epic.
    epicId: z.string().trim().min(1).max(30).nullable().optional(),
    // CAM-342: optional model-tier stamp (same rule as handoff's agentModel above) --
    // no null variant: the tier is only ever added/overwritten, never cleared via the API.
    agentModel: agentModelSchema.optional(),
  }),
]);
export type PatchTicketBody = z.infer<typeof patchTicketBodySchema>;

// ── POST /api/tickets/[id]/comments ─────────────────────────────────────────────────────

export const addCommentBodySchema = z.object({
  actor: actorSchema,
  body: z.string().trim().min(1).max(10000),
});
export type AddCommentBody = z.infer<typeof addCommentBodySchema>;

/** CAM-xxx identifier, e.g. CAM-278. Shared by every /api/tickets/[id] route. */
export const TICKET_ID_RE = /^[A-Z]+-\d+$/;
