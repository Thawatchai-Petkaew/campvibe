// lib/delivery/http.ts — shared error → HTTP response mapping for app/api/tickets/* (the
// route seam). Never leaks internals/stack to the client (.claude/rules/api.md §5).
import { NextResponse } from "next/server";
import { TicketNotFoundError, TicketTransitionError } from "@/lib/delivery/errors";

export function ticketErrorResponse(err: unknown): NextResponse {
  if (err instanceof TicketTransitionError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: 400 });
  }
  if (err instanceof TicketNotFoundError) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  console.error(
    JSON.stringify({
      event: "tickets_api_internal_error",
      reason: err instanceof Error ? err.message : String(err),
    })
  );
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}
