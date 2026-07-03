// lib/delivery/errors.ts — typed errors the tickets service throws; the API layer
// (app/api/tickets/*) maps these to safe HTTP responses (never leaks internals/stack).

/**
 * An invalid state-machine transition or a failed precondition (ADR-010 transition table).
 * `code` is a short machine-readable reason the API maps to 400; `message` is safe to log
 * server-side only (never returned verbatim if it ever contained anything sensitive —
 * today it never does, it only echoes state names).
 */
export class TicketTransitionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TicketTransitionError";
    this.code = code;
  }
}

/** The ticket identifier does not exist. The API maps this to 404. */
export class TicketNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Ticket ${identifier} not found`);
    this.name = "TicketNotFoundError";
  }
}
