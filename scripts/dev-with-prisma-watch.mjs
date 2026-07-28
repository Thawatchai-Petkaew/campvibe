#!/usr/bin/env node
// CAM-588: a running `next dev` server never re-checks Prisma freshness after
// it starts -- CAM-579's verify-prisma-client-fresh.mjs only runs at process
// START (predev/pretypecheck/pretest). This is exactly the gap the owner hit:
// a migration landed, prisma generate re-ran, the ON-DISK client matched the
// ON-DISK schema again -- but the ALREADY-RUNNING dev server had loaded the
// OLD client into memory, and Next.js never hot-reloads a generated client.
// Comparing disk-vs-disk after the fact would report "fresh" the moment
// someone regenerates, which is exactly why the real incident was confusing.
//
// Fix here: compare disk-vs-a-POINT-IN-TIME SNAPSHOT instead. Hash
// prisma/schema.prisma (+ the delivery schema) once, the instant this wrapper
// starts -- the same instant predev's disk-vs-disk check just confirmed the
// generated client is fresh, so this snapshot IS the schema state the
// in-memory client was built against. Watch prisma/schema.prisma and
// prisma/migrations/ for the rest of this process's life; any divergence from
// that frozen baseline means the loaded client can no longer be trusted, no
// matter what the files on disk say by then.
//
// Dev-only. This script's only caller is the "dev" npm script. It refuses to
// run under NODE_ENV=production and is never invoked by build/vercel-build/
// start -- see docs/specs/platform-hardening/taxonomy-ui-foundation/
// CAM-588-stale-client-and-swallowed-errors/tech.md.
//
// Structure note: every side effect (fs.watch, spawning `next dev`, signal
// wiring) lives inside main(), which runs ONLY when this file is executed
// directly (`node scripts/dev-with-prisma-watch.mjs`) -- guarded the same way
// scripts/verify-prisma-client-fresh.mjs guards its CLI section. Importing
// this module (as __tests__/cam-588-*.test.ts does, for hasDrifted/
// computeBaseline/startWatching) must never also spawn a real `next dev` or
// open a real fs.watch on this repo's own files.

import { spawn } from "node:child_process";
import { readFileSync, existsSync, watch } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { hash } from "./verify-prisma-client-fresh.mjs";

/** Pure: true when `current` has diverged from `baseline` (both known/non-null). */
export function hasDrifted(baselineHash, currentHash) {
  return baselineHash !== null && currentHash !== null && baselineHash !== currentHash;
}

function currentSchemaHash(schemaPath) {
  if (!existsSync(schemaPath)) return null;
  return hash(readFileSync(schemaPath, "utf8"));
}

/** Snapshot the normalized hash of every schema path, once. */
export function computeBaseline(schemaPaths) {
  return new Map(schemaPaths.map((p) => [p, currentSchemaHash(p)]));
}

/**
 * startWatching — wires fs.watch on the given schema files + migration dirs.
 * Debounces (default 300ms) and calls `onDrift({ reason, changedPath, schemaPath })`
 * at most once per distinct (schemaPath, hash) / migration path pair.
 *
 * Fully isolated from `next dev` / process signals, so a test can point it at
 * a disposable temp directory and prove it fires on a REAL fs write.
 *
 * Returns a `stop()` function that closes every underlying watcher.
 */
export function startWatching({ schemaPaths, migrationDirs, onDrift, debounceMs = 300 }) {
  const baseline = computeBaseline(schemaPaths);
  const alreadyWarnedFor = new Set();
  let debounceTimer = null;

  function runCheck(reason, changedPath) {
    if (reason === "schema") {
      for (const p of schemaPaths) {
        const current = currentSchemaHash(p);
        const key = `schema:${p}:${current}`;
        if (hasDrifted(baseline.get(p) ?? null, current) && !alreadyWarnedFor.has(key)) {
          alreadyWarnedFor.add(key);
          onDrift({ reason, changedPath, schemaPath: p });
        }
      }
      return;
    }
    // reason === "migration": migrations are many small files -- fingerprinting
    // each is unnecessary. Any change under a migrations dir while the server
    // is already running IS the CAM-588 scenario (EC-3), so warn once per
    // distinct path, without needing a hash comparison.
    const key = `migration:${changedPath}`;
    if (!alreadyWarnedFor.has(key)) {
      alreadyWarnedFor.add(key);
      onDrift({ reason, changedPath, schemaPath: null });
    }
  }

  function scheduleCheck(reason, changedPath) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runCheck(reason, changedPath), debounceMs);
  }

  const watchers = [];
  for (const p of schemaPaths) {
    if (existsSync(p)) watchers.push(watch(p, () => scheduleCheck("schema", p)));
  }
  for (const dir of migrationDirs) {
    if (!existsSync(dir)) continue;
    try {
      watchers.push(
        watch(dir, { recursive: true }, (_event, filename) =>
          scheduleCheck("migration", path.join(dir, filename ?? ""))
        )
      );
    } catch {
      // Recursive fs.watch is unsupported on some platforms (e.g. certain
      // Linux setups). Degrade loudly, not silently -- schema.prisma changes
      // are still caught above regardless.
      console.warn(
        `dev-with-prisma-watch: recursive watch unsupported for ${dir} on this platform; ` +
          "migration-only changes (with no schema.prisma edit) may not be caught."
      );
    }
  }

  return function stop() {
    clearTimeout(debounceTimer);
    for (const w of watchers) {
      try {
        w.close();
      } catch {
        // already closed
      }
    }
  };
}

function printBanner({ changedPath, schemaPath }) {
  console.error("");
  console.error("=".repeat(70));
  console.error("STOP (CAM-588 guard): prisma/schema or prisma/migrations changed");
  console.error("while this dev server was already running.");
  console.error(`  - detected under: ${changedPath}`);
  if (schemaPath) console.error(`  - drifted schema: ${schemaPath}`);
  console.error("");
  console.error("The Prisma client THIS PROCESS already loaded is now stale --");
  console.error("even after `prisma generate` re-syncs the files on disk, Next.js");
  console.error("does not hot-reload a generated client into a running process.");
  console.error("Stop this dev server (Ctrl+C) and run `npm run dev` again.");
  console.error("=".repeat(70));
  console.error("");
}

function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "dev-with-prisma-watch: refuses to run with NODE_ENV=production (dev-only tool)."
    );
    process.exit(1);
  }

  const schemaPaths = ["prisma/schema.prisma", "prisma/delivery/schema.prisma"].filter(
    existsSync
  );
  const migrationDirs = ["prisma/migrations", "prisma/delivery/migrations"].filter(existsSync);

  const stopWatching = startWatching({ schemaPaths, migrationDirs, onDrift: printBanner });

  const require = createRequire(import.meta.url);
  const nextBin = require.resolve("next/dist/bin/next");
  const child = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], {
    stdio: "inherit",
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      try {
        child.kill(sig);
      } catch {
        // already exited
      }
    });
  }

  child.on("exit", (code, signal) => {
    stopWatching();
    // Exit directly rather than re-sending `signal` to our own process: this
    // process already has a listener for SIGINT/SIGTERM (above), and a
    // self-sent signal invokes that listener instead of the default
    // terminate-the-process disposition -- re-signaling here would just
    // forward (already-exited) `child` again and never actually exit.
    process.exit(signal ? 1 : code ?? 0);
  });
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main();
}
