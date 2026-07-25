#!/usr/bin/env node
/**
 * pull-turns.mjs — SORT step of the AI Chat Capability Loop (CAM-508).
 *
 * Pulls recent `AssistantTurnLog` rows and writes a deterministic triage export
 * for the `/ai-chat-improve` skill to read. NO LLM, NO paid API — just a DB
 * read + plain aggregation. The smart analysis happens in the IDE afterwards on
 * the Claude subscription (flat-rate), reading the file this script produces.
 *
 * Usage:
 *   node scripts/ai-triage/pull-turns.mjs [days] [outFile]
 *   AI_TRIAGE_DAYS=7 AI_TRIAGE_OUT=scratch/ai-triage-export.json node scripts/ai-triage/pull-turns.mjs
 *
 * DB source: AI_TRIAGE_DATABASE_URL if set, else DATABASE_URL (local dev by
 * default). Refuses a prod-looking host unless AI_TRIAGE_ALLOW_PROD=1 — mining
 * prod chat logs (real user PII) is an explicit, owner-gated action.
 *
 * Diagnostics print scheme+host ONLY (describeUrlShape) — never credentials or
 * query string (the CAM-359/CAM-369 secret-in-URL lesson).
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DAYS = Number(process.env.AI_TRIAGE_DAYS ?? process.argv[2] ?? 7);
const OUT = process.env.AI_TRIAGE_OUT ?? process.argv[3] ?? 'scratch/ai-triage-export.json';
const MAX_ROWS = Number(process.env.AI_TRIAGE_MAX_ROWS ?? 5000);
const url = process.env.AI_TRIAGE_DATABASE_URL ?? process.env.DATABASE_URL;

function describeUrlShape(u) {
  try {
    const p = new URL(u);
    return `${p.protocol}//${p.hostname}`;
  } catch {
    return '(unparseable)';
  }
}

if (!url) {
  console.error('No AI_TRIAGE_DATABASE_URL / DATABASE_URL set — nothing to pull.');
  process.exit(1);
}
const shape = describeUrlShape(url);
if (/prod/i.test(shape) && process.env.AI_TRIAGE_ALLOW_PROD !== '1') {
  console.error(`Refusing a prod-looking DB (${shape}). Mining prod chat logs is owner-gated — set AI_TRIAGE_ALLOW_PROD=1 only with explicit approval.`);
  process.exit(2);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const since = new Date(Date.now() - DAYS * 86400000);
  const rows = await prisma.assistantTurnLog.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: MAX_ROWS,
  });

  const byPath = {};
  const missCounts = {};
  let turnsWithMiss = 0;
  for (const r of rows) {
    byPath[r.path] = (byPath[r.path] ?? 0) + 1;
    if (r.missFlags?.length) turnsWithMiss += 1;
    for (const f of r.missFlags ?? []) missCounts[f] = (missCounts[f] ?? 0) + 1;
  }

  const summary = {
    generatedForDays: DAYS,
    dbShape: shape,
    totalTurns: rows.length,
    capped: rows.length >= MAX_ROWS,
    byPath,
    missCounts,
    turnsWithMiss,
    missRatePct: rows.length ? Number(((turnsWithMiss / rows.length) * 100).toFixed(1)) : 0,
  };

  const project = (r) => ({
    createdAt: r.createdAt,
    path: r.path,
    userText: r.userText,
    toolCalls: r.toolCalls,
    assistantText: r.assistantText,
    missFlags: r.missFlags,
    roundCount: r.roundCount,
  });

  const missTurns = rows.filter((r) => r.missFlags?.length).map(project);
  const sampleCleanTurns = rows.filter((r) => !r.missFlags?.length).slice(0, 50).map(project);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ summary, missTurns, sampleCleanTurns }, null, 2));

  console.log(`Pulled ${rows.length} turns (${DAYS}d) from ${shape} → ${OUT}`);
  console.log(`  paths=${JSON.stringify(byPath)} misses=${JSON.stringify(missCounts)} missRate=${summary.missRatePct}%`);
  if (rows.length === 0) {
    console.log('  (no turns yet — the log is empty for this window; nothing to analyze this cycle.)');
  }
} finally {
  await prisma.$disconnect();
}
