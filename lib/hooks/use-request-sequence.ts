"use client";

import { useCallback, useRef } from "react";

// CAM-608 — the CAM-359 monotonic requestId guard, extracted for reuse.
//
// CAM-359 found that a mount-effect async load can legitimately be in flight
// more than once at a time (React Strict Mode's dev-only double-invoked
// mount effect racing a post-mutation refetch, a user re-triggering a load
// before the first resolves, ...), and the two calls are not guaranteed to
// resolve in the order they were issued. Without a guard, whichever call
// RESOLVES LAST wins the state update regardless of which one was ISSUED
// last — a slower, now-stale call can silently overwrite fresher state (a
// spot/booking/hold the user just created or navigated to disappearing
// again). The fix is this exact mechanism, first landed inline in
// components/spot-management-section.tsx: a monotonic counter, bumped once
// per issued call; a state commit is accepted only if the counter still
// matches the id that call was issued with.
//
// CAM-608 needed the SAME guard on three independent async loads on one
// route (`app/dashboard/campsites/[id]/availability/**`) and the ticket's
// own instruction (mirroring `.claude/rules/api.md`'s CAM-341/360 lesson —
// a fix re-derived per surface is how that class of bug shipped twice) is
// to reuse CAM-359's mechanism rather than re-derive it a second/third/fourth
// time inline. This hook packages the identical mechanism (not a new one) so
// every call site applies it the same way.
//
// Usage:
//   const { next, isCurrent } = useRequestSequence();
//   const loadX = useCallback(async () => {
//     const requestId = next();          // call once, BEFORE the first await
//     ...
//     const res = await fetch(...);
//     if (!isCurrent(requestId)) return;  // stale — a newer call has since been issued
//     setState(...);
//   }, [next, isCurrent, ...]);
export function useRequestSequence() {
  const ref = useRef(0);

  const next = useCallback(() => ++ref.current, []);
  const isCurrent = useCallback((requestId: number) => ref.current === requestId, []);

  return { next, isCurrent };
}
