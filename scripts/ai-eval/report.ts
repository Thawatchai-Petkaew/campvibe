/**
 * CAM-457 (tech.md §3) — renders both the JSON (durable, diffable baseline
 * — the source of truth) and the Markdown (human-facing view) report from
 * ONE results object, so they can never disagree. `writeReports` is the
 * only function here that touches the filesystem; `renderJson`/`renderMarkdown`
 * are pure.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CaseResult, GroupRollup, Rollup } from './score';
import type { LoadError } from './load-cases';

export interface EvalReportHeader {
  model: string;
  generatedAt: string;
  gitSha: string;
  caseCount: number;
  thresholds: { toolCallCorrectness: number; guardrail: number };
}

export interface EvalReport {
  header: EvalReportHeader;
  rollups: {
    overall: Rollup;
    byGroup: Record<string, GroupRollup>;
    byZone: Record<string, GroupRollup>;
  };
  cases: CaseResult[];
  loadErrors: LoadError[];
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function groupTable(title: string, rows: Record<string, GroupRollup>): string[] {
  const lines = [`## ${title}`, '', '| Key | Pass | Fail | Error | Pct |', '|---|---|---|---|---|'];
  for (const [key, r] of Object.entries(rows)) {
    lines.push(`| ${key} | ${r.pass} | ${r.fail} | ${r.error} | ${pct(r.pct)} |`);
  }
  return lines;
}

/** tech.md §3 — the markdown is a RENDERING of the JSON (single source of truth); the two can never disagree because both come from the same `EvalReport` object. */
export function renderMarkdown(report: EvalReport): string {
  const { header, rollups, cases, loadErrors } = report;
  const lines: string[] = [
    '# AI eval baseline report (CAM-457)',
    '',
    `- Model: \`${header.model}\``,
    `- Generated: ${header.generatedAt}`,
    `- Git SHA: \`${header.gitSha}\``,
    `- Case count: ${header.caseCount}`,
    `- Verdict: **${rollups.overall.verdict}**`,
    '',
    '## Overall',
    '',
    '| Metric | Value | Threshold |',
    '|---|---|---|',
    `| Tool-call correctness | ${pct(rollups.overall.toolCallCorrectnessPct)} | >= ${pct(header.thresholds.toolCallCorrectness)} |`,
    `| Guardrail pass | ${pct(rollups.overall.guardrailPassPct)} | = ${pct(header.thresholds.guardrail)} |`,
    `| pass / fail / error / load_error / total | ${rollups.overall.counts.pass} / ${rollups.overall.counts.fail} / ${rollups.overall.counts.error} / ${loadErrors.length} / ${rollups.overall.counts.total} |`,
    '',
    ...groupTable('By group', rollups.byGroup),
    '',
    ...groupTable('By zone', rollups.byZone),
  ];

  if (loadErrors.length > 0) {
    lines.push('', '## Load errors', '');
    for (const e of loadErrors) {
      lines.push(`- index ${e.index}${e.id ? ` (id: ${e.id})` : ''}: ${e.message}`);
    }
  }

  lines.push('', '## Cases', '', '| id | group | zone | guardrail | result | reason |', '|---|---|---|---|---|---|');
  for (const c of cases) {
    lines.push(`| ${c.id} | ${c.group} | ${c.zone} | ${c.guardrail} | ${c.result} | ${c.reason.replace(/\|/g, '\\|')} |`);
  }

  return `${lines.join('\n')}\n`;
}

export function renderJson(report: EvalReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function writeReports(dir: string, report: EvalReport): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'baseline-report.json'), renderJson(report), 'utf-8');
  writeFileSync(path.join(dir, 'baseline-report.md'), renderMarkdown(report), 'utf-8');
}
