/**
 * CAM-457 (BR-1/EC-1) — reads + zod-validates the golden-case fixture. A
 * malformed/unparseable entry is recorded as a NAMED load error and the
 * batch continues — this module never throws on bad fixture data (a real
 * network/model error is a different bucket, handled by the runner + score.ts).
 * Pure aside from the file read in `loadCasesFromFile`; zero network I/O.
 */
import { readFileSync } from 'node:fs';
import { goldenCaseSchema, type GoldenCase } from './case-schema';

export interface LoadError {
  /** Index in the fixture array; -1 when the failure is at the whole-file level (unreadable/unparseable/not-an-array). */
  index: number;
  id?: string;
  message: string;
}

export interface LoadCasesResult {
  cases: GoldenCase[];
  loadErrors: LoadError[];
}

function isRecordWithStringId(value: unknown): value is { id: string } {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

/** BR-1/EC-1 — validates each array entry independently; one bad entry never aborts the rest of the batch. */
export function loadCases(raw: unknown): LoadCasesResult {
  if (!Array.isArray(raw)) {
    return { cases: [], loadErrors: [{ index: -1, message: 'fixture root is not an array' }] };
  }

  const cases: GoldenCase[] = [];
  const loadErrors: LoadError[] = [];

  raw.forEach((entry, index) => {
    const parsed = goldenCaseSchema.safeParse(entry);
    if (parsed.success) {
      cases.push(parsed.data);
      return;
    }
    loadErrors.push({
      index,
      id: isRecordWithStringId(entry) ? entry.id : undefined,
      message: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; '),
    });
  });

  return { cases, loadErrors };
}

/** Reads + JSON-parses the fixture file, then delegates to `loadCases`. A read/parse failure is itself a load error, never a throw (EC-1 applies at the file level too). */
export function loadCasesFromFile(filePath: string): LoadCasesResult {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return {
      cases: [],
      loadErrors: [
        { index: -1, message: `failed to read/parse fixture: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
  return loadCases(raw);
}
