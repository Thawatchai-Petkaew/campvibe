/**
 * CAM-278 (T-2) — ADR-010 module boundary guard.
 *
 * Source-inspection (no runtime imports): walks the real file tree and asserts
 *   1. lib/delivery/* never imports a product module (@/lib/prisma, @/lib/auth, a
 *      product component/page under @/components or @/app).
 *   2. No product file imports lib/delivery/* except the DEFINED seams:
 *      lib/linear.ts (the TICKETS_SOURCE switch, list read), app/api/tickets/* (the route
 *      seam), — as of CAM-281 (T-5) — the four mutation/detail routes
 *      (app/api/status/approve, app/api/status/reject, app/api/status/issue/[id],
 *      app/api/telegram-webhook) that call the delivery service directly (CAM-281 (T-5b)
 *      retired the legacy Linear branches those four routes carried during the T-5a
 *      dual-mode cutover — the delivery service is now their ONLY path), and — as of
 *      CAM-287 — app/api/status/stream/route.ts + app/api/status/pulse/route.ts, which
 *      read/bump lib/delivery/pulse.ts's DeliveryPulse (the pulse real ticket mutations
 *      actually bump) instead of the legacy lib/status-pulse.ts StatusPulse.
 *   3. The product schema (prisma/schema.prisma) carries none of the delivery-only model
 *      names — a structural drift guard against the two schemas merging back together.
 *
 * This is a static, git-independent check (safe to run forever in CI) — it does NOT
 * attempt to diff against a moving base branch ref, which would be meaningless once this
 * story is merged. The one-time "prisma/schema.prisma has zero changes in this PR's diff"
 * check is verified separately via `git diff` at review time (see the T-2 handoff report).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

function listSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "generated") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

function importSpecifiers(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  return [...src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

const DELIVERY_DIR = path.join(ROOT, "lib", "delivery");

describe("ADR-010 module boundary — lib/delivery/*", () => {
  it("never imports a product module (@/lib/prisma, @/lib/auth, @/components/*, @/app/*)", () => {
    const disallowed = [/^@\/lib\/prisma(\/|$)/, /^@\/lib\/auth(\/|$)/, /^@\/components\//, /^@\/app\//];
    const offenders: string[] = [];
    for (const file of listSourceFiles(DELIVERY_DIR)) {
      for (const spec of importSpecifiers(file)) {
        if (disallowed.some((re) => re.test(spec))) {
          offenders.push(`${path.relative(ROOT, file)} imports "${spec}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the generated delivery client + prisma/delivery/schema.prisma are the only Prisma surface it touches", () => {
    // Every lib/delivery/* file that imports a Prisma client must import the DELIVERY
    // generated client path, never the product's @prisma/client.
    const offenders: string[] = [];
    for (const file of listSourceFiles(DELIVERY_DIR)) {
      for (const spec of importSpecifiers(file)) {
        if (spec === "@prisma/client") {
          offenders.push(`${path.relative(ROOT, file)} imports the product's @prisma/client directly`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("ADR-010 module boundary — product files", () => {
  it("no product file imports lib/delivery/* except the defined seams", () => {
    const seamFile = path.join(ROOT, "lib", "linear.ts");
    const seamDir = path.join(ROOT, "app", "api", "tickets");
    // CAM-281 (T-5) widened the seam list: the /status + Telegram mutation/detail routes
    // call lib/delivery/tickets.ts's verbs / lib/delivery/status-adapter.ts directly.
    // CAM-281 (T-5b) retired the legacy lib/linear-actions calls those routes carried
    // during the dual-mode cutover — the delivery service is now their ONLY path.
    // CAM-287 adds the SSE stream + manual-bump routes, which now read/bump
    // lib/delivery/pulse.ts's DeliveryPulse instead of the legacy StatusPulse.
    const seamFiles = [
      seamFile,
      path.join(ROOT, "app", "api", "status", "approve", "route.ts"),
      path.join(ROOT, "app", "api", "status", "reject", "route.ts"),
      path.join(ROOT, "app", "api", "status", "issue", "[id]", "route.ts"),
      path.join(ROOT, "app", "api", "telegram-webhook", "route.ts"),
      path.join(ROOT, "app", "api", "status", "stream", "route.ts"),
      path.join(ROOT, "app", "api", "status", "pulse", "route.ts"),
    ];

    const scanRoots = ["app", "lib", "components"].map((d) => path.join(ROOT, d));
    const offenders: string[] = [];
    for (const dir of scanRoots) {
      for (const file of listSourceFiles(dir)) {
        if (file.startsWith(DELIVERY_DIR)) continue; // lib/delivery importing itself is fine
        if (seamFiles.includes(file)) continue;
        if (file.startsWith(seamDir)) continue;
        for (const spec of importSpecifiers(file)) {
          if (spec.startsWith("@/lib/delivery")) {
            offenders.push(`${path.relative(ROOT, file)} imports "${spec}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("prisma/schema.prisma (product) carries none of the delivery-only model names", () => {
    const schema = fs.readFileSync(path.join(ROOT, "prisma", "schema.prisma"), "utf8");
    for (const name of ["model Ticket ", "model TicketEvent ", "model TicketComment ", "model DeliveryPulse "]) {
      expect(schema).not.toContain(name);
    }
  });
});
