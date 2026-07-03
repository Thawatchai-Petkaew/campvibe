/**
 * CAM-278 (T-2) — ADR-010 module boundary guard.
 *
 * Source-inspection (no runtime imports): walks the real file tree and asserts
 *   1. lib/delivery/* never imports a product module (@/lib/prisma, @/lib/auth, a
 *      product component/page under @/components or @/app).
 *   2. No product file imports lib/delivery/* except the two DEFINED seams:
 *      lib/linear.ts (the TICKETS_SOURCE switch) and app/api/tickets/* (the route seam).
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
  it("no product file imports lib/delivery/* except the two defined seams", () => {
    const seamFile = path.join(ROOT, "lib", "linear.ts");
    const seamDir = path.join(ROOT, "app", "api", "tickets");

    const scanRoots = ["app", "lib", "components"].map((d) => path.join(ROOT, d));
    const offenders: string[] = [];
    for (const dir of scanRoots) {
      for (const file of listSourceFiles(dir)) {
        if (file.startsWith(DELIVERY_DIR)) continue; // lib/delivery importing itself is fine
        if (file === seamFile) continue;
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
