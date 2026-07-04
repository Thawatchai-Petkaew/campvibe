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

const ticketTypeSchema = z.enum(TICKET_TYPES);
const deliveryRoleSchema = z.enum(DELIVERY_ROLES);
const personaSchema = z.enum(PERSONAS);
const ticketStateSchema = z.enum(TICKET_STATES);

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

// ── GET /api/tickets?state=&epicId=&archived= ──────────────────────────────────────────

export const listTicketsQuerySchema = z.object({
  state: ticketStateSchema.optional(),
  epicId: z.string().min(1).max(30).optional(),
  archived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

// ── PATCH /api/tickets/[id] — { action, ...params } discriminated union ────────────────

const noteMaxLen = 4000;

export const patchTicketBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), actor: actorSchema, role: deliveryRoleSchema.optional() }),
  z.object({ action: z.literal("raiseGate"), actor: actorSchema, note: z.string().max(noteMaxLen).optional() }),
  z.object({
    action: z.literal("approve"),
    actor: actorSchema,
    nextRole: deliveryRoleSchema.optional(),
  }),
  z.object({ action: z.literal("reject"), actor: actorSchema, note: z.string().max(noteMaxLen).optional() }),
  z.object({ action: z.literal("complete"), actor: actorSchema }),
  z.object({ action: z.literal("release"), actor: actorSchema }),
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
