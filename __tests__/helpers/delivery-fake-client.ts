// __tests__/helpers/delivery-fake-client.ts — an in-memory fake standing in for the
// generated delivery PrismaClient, shared by delivery-tickets-service / delivery-status-
// adapter tests. Implements only the subset of the Prisma API surface lib/delivery/*
// actually calls (ticket/ticketComment/ticketEvent/deliveryPulse + a no-isolation
// $transaction that just invokes the callback with the same fake client).
//
// Not a full Prisma re-implementation — a test double. Loose `any` typing here is
// justified (test infrastructure only, never shipped code — .claude/rules/code.md #1).
import { vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FakeTicketRow = Record<string, any> & {
  id: string;
  number: number;
  identifier: string;
  title: string;
  state: string;
  type: string;
  currentRole: string | null;
  roleHistory: string[];
  regressionRound: number;
  changesRequested: boolean;
  blocked: boolean;
  archivedAt: Date | null;
  releasedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  gateRaisedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

let seq = 0;
function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}`;
}

/** Build a fully-defaulted ticket row (mirrors prisma/delivery/schema.prisma defaults). */
export function makeTicketRow(overrides: Partial<FakeTicketRow> & { number: number; identifier: string; title: string; type: string }): FakeTicketRow {
  const now = new Date();
  return {
    id: nextId("ticket"),
    description: null,
    state: "BACKLOG",
    priority: 0,
    currentRole: null,
    persona: null,
    epicId: null,
    featureName: null,
    gateRaisedAt: null,
    changesRequested: false,
    regressionRound: 0,
    releasedAt: null,
    blocked: false,
    roleHistory: [],
    assigneeName: null,
    legacyUrl: null,
    legacyLabels: [],
    archivedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFakeDeliveryClient() {
  const tickets = new Map<string, FakeTicketRow>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events: any[] = [];
  let pulse: { id: string; version: number } | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    ticket: {
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: { where: { identifier?: string; id?: string }; include?: { epic?: unknown } }) => {
          let row: FakeTicketRow | null = null;
          if (where.identifier) {
            row = [...tickets.values()].find((t) => t.identifier === where.identifier) ?? null;
          } else if (where.id) {
            row = tickets.get(where.id) ?? null;
          }
          if (!row) return null;
          // Mirrors findMany's epic join below — only attached when the caller actually
          // requests `include: { epic: ... }`, same as real Prisma.
          if (include?.epic) {
            return {
              ...row,
              epic: row.epicId && tickets.get(row.epicId) ? { id: row.epicId, title: tickets.get(row.epicId)!.title } : null,
            };
          }
          return row;
        }
      ),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          take,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: any = {}) => {
          let rows = [...tickets.values()];
          if (where?.archivedAt === null) rows = rows.filter((t) => t.archivedAt === null);
          if (where?.archivedAt?.not === null) rows = rows.filter((t) => t.archivedAt !== null);
          if (where?.state) rows = rows.filter((t) => t.state === where.state);
          if (where?.epicId) rows = rows.filter((t) => t.epicId === where.epicId);
          if (orderBy?.number === "asc") rows = [...rows].sort((a, b) => a.number - b.number);
          if (typeof take === "number") rows = rows.slice(0, take);
          return rows.map((t) => ({
            ...t,
            epic: t.epicId && tickets.get(t.epicId) ? { id: t.epicId, title: tickets.get(t.epicId)!.title } : null,
          }));
        }
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async ({ data }: { data: any }) => {
        const row = makeTicketRow(data);
        tickets.set(row.id, row);
        return row;
      }),
      update: vi.fn(
        async ({
          where,
          data,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: { where: { id: string }; data: any }) => {
          const existing = tickets.get(where.id);
          if (!existing) throw new Error(`fake ticket ${where.id} not found`);
          const updated: FakeTicketRow = { ...existing, ...data, updatedAt: new Date() };
          tickets.set(where.id, updated);
          return updated;
        }
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aggregate: vi.fn(async (_args: any) => {
        const rows = [...tickets.values()];
        const max = rows.length ? Math.max(...rows.map((r) => r.number)) : null;
        return { _max: { number: max } };
      }),
    },
    ticketComment: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async ({ data }: { data: any }) => {
        const row = { id: nextId("comment"), createdAt: new Date(), ...data };
        comments.push(row);
        return row;
      }),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: any = {}) => {
          let rows = comments.filter((c) => !where?.ticketId || c.ticketId === where.ticketId);
          if (orderBy?.createdAt === "asc") {
            rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          }
          return rows;
        }
      ),
    },
    ticketEvent: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn(async ({ data }: { data: any }) => {
        const row = { id: nextId("event"), createdAt: new Date(), ...data };
        events.push(row);
        return row;
      }),
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: any = {}) => {
          let rows = events.filter((e) => !where?.ticketId || e.ticketId === where.ticketId);
          if (orderBy?.createdAt === "asc") {
            rows = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          }
          return rows;
        }
      ),
    },
    deliveryPulse: {
      findUnique: vi.fn(async () => (pulse ? { version: pulse.version } : null)),
      upsert: vi.fn(
        async ({
          update,
          create,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }: any) => {
          if (pulse) {
            pulse = { id: pulse.id, version: pulse.version + (update?.version?.increment ?? 0) };
          } else {
            pulse = { id: create.id, version: create.version };
          }
          return pulse;
        }
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(client)),
  };

  return {
    client,
    store: { tickets, comments, events, getPulse: () => pulse },
  };
}

export type FakeDeliveryClient = ReturnType<typeof createFakeDeliveryClient>["client"];
