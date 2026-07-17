/**
 * delivery-verify-gate.test.ts — the Verify-coverage guard for the delivery
 * workflow. A story cannot reach Done unless it passed through a Verify-stage role
 * (QA or Security), so a solo frontend-only run can't silently complete without
 * QA/Security ever appearing on the board or in Telegram.
 *
 * Layer: the predicate lives in `lib/delivery/verify-stage.ts` (dependency-light,
 * no generated Prisma client) so it is unit-testable directly here — real behavioral
 * teeth on the exact stage logic. The wiring into complete() (and that it rejects
 * with `no_verify_role`) is proven behaviorally in delivery-tickets-service.test.ts.
 */
import { describe, it, expect } from "vitest";
import { hasPassedVerify } from "../lib/delivery/verify-stage";

// roleHistory holds DeliveryRole enum values as plain strings.
const H = (...roles: string[]): string[] => roles;

describe("hasPassedVerify — Verify-coverage predicate", () => {
  it("[null/empty] false for an empty history (no role ever held it)", () => {
    expect(hasPassedVerify(H())).toBe(false);
  });

  it("[unit] false for a Build-only history (frontend/backend never reached Verify)", () => {
    expect(hasPassedVerify(H("FRONTEND_ENGINEER"))).toBe(false);
    expect(hasPassedVerify(H("BACKEND_ENGINEER"))).toBe(false);
  });

  it("[unit] true once QA (qa-engineer) is in the chain", () => {
    expect(hasPassedVerify(H("FRONTEND_ENGINEER", "QA_ENGINEER"))).toBe(true);
  });

  it("[unit] true once Security (security-reviewer) is in the chain", () => {
    expect(hasPassedVerify(H("BACKEND_ENGINEER", "SECURITY_REVIEWER"))).toBe(true);
  });

  it("[boundary] false for Design + Build + Ship that skips Verify entirely", () => {
    // architect(Design) -> frontend(Build) -> devops-release(Ship): no QA/Security.
    expect(hasPassedVerify(H("ARCHITECT", "FRONTEND_ENGINEER", "DEVOPS_RELEASE"))).toBe(false);
  });

  it("[unit] true for the full Build -> QA -> Security -> DevOps chain", () => {
    expect(
      hasPassedVerify(H("FRONTEND_ENGINEER", "QA_ENGINEER", "SECURITY_REVIEWER", "DEVOPS_RELEASE"))
    ).toBe(true);
  });
});
