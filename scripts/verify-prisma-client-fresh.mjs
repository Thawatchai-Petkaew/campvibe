#!/usr/bin/env node
// CAM-579: fail loud and immediately when the generated Prisma client(s) in THIS
// checkout do not match THIS checkout's own schema file(s) -- instead of a
// confusing runtime "Unknown field" 500 or a wall of typecheck errors in code
// that was never touched.
//
// Wired as an automatic npm pre-hook (predev/pretypecheck/pretest in
// package.json) so it runs every time without anyone having to remember it —
// see docs/specs/platform-hardening/taxonomy-ui-foundation/CAM-579-worktree-isolation/story.md.
//
// This is a defense-in-depth safety net, not the primary fix. The primary fix
// (scripts/worktree-setup.sh) makes node_modules/.prisma isolated per worktree,
// so a client can no longer be clobbered by ANOTHER worktree's `prisma
// generate`. This check catches the remaining, narrower case: a client that has
// simply gone stale relative to THIS worktree's own schema (edited the schema,
// forgot to regenerate; or a worktree that never ran the isolation setup at all).

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

// `prisma generate` re-formats the schema it embeds into the client output
// (re-aligns columns, re-wraps comments) -- a byte-for-byte hash of the raw
// source against the embedded copy produces a FALSE POSITIVE on a client that
// is actually fresh. Normalize both sides the same way before hashing: drop
// line comments, trim, collapse whitespace. This still catches a real
// drift (an added/removed/renamed field), just not cosmetic reformatting.
function normalize(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ");
}

function hash(text) {
  return createHash("sha256").update(normalize(text)).digest("hex");
}

function checkPair(label, schemaPath, embeddedSchemaPath, regenerateHint) {
  if (!existsSync(schemaPath)) {
    // This schema doesn't exist in this checkout (e.g. an older branch) -- nothing to check.
    return { label, status: "skip" };
  }
  if (!existsSync(embeddedSchemaPath)) {
    return {
      label,
      status: "fail",
      reason: `${embeddedSchemaPath} is missing -- the client has never been generated in this worktree.`,
      regenerateHint,
    };
  }
  const real = hash(readFileSync(schemaPath, "utf8"));
  const embedded = hash(readFileSync(embeddedSchemaPath, "utf8"));
  if (real !== embedded) {
    return {
      label,
      status: "fail",
      reason: `${embeddedSchemaPath} does not match ${schemaPath} (schema hash mismatch).`,
      regenerateHint,
    };
  }
  return { label, status: "ok" };
}

const checks = [
  checkPair(
    "product client",
    "prisma/schema.prisma",
    "node_modules/.prisma/client/schema.prisma",
    "npx prisma generate"
  ),
  checkPair(
    "delivery client",
    "prisma/delivery/schema.prisma",
    "prisma/delivery/generated/delivery-client/schema.prisma",
    "npm run delivery:generate"
  ),
];

const failed = checks.filter((c) => c.status === "fail");

if (failed.length > 0) {
  console.error("");
  console.error("============================================================");
  console.error("STOP (CAM-579 guard): generated Prisma client does not match");
  console.error("this worktree's own schema.");
  console.error("============================================================");
  for (const f of failed) {
    console.error(`  - ${f.label}: ${f.reason}`);
    console.error(`    fix: ${f.regenerateHint}`);
  }
  console.error("");
  console.error("This is exactly the CAM-579 hazard: a stale/foreign client makes");
  console.error("typecheck and the dev server fail with confusing errors in code");
  console.error("you never touched. If you are in a fresh agent worktree, run");
  console.error("`bash scripts/worktree-setup.sh` once, then retry.");
  console.error("============================================================");
  console.error("");
  process.exit(1);
}

console.log("verify-prisma-client-fresh: OK (client matches this worktree's schema).");
