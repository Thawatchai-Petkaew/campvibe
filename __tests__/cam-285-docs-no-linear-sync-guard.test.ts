/**
 * CAM-285 docs guard — self-hosted cutover left `node scripts/linear-sync.mjs` instructions
 * behind in the standing rules + story template (linear-sync.mjs is deprecated/retired per
 * CAM-281 T-5b; scripts/ticket-sync.mjs is the live tool — see scripts/linear-sync.mjs's own
 * deprecation banner).
 *
 * Static source-inspection test (mirrors __tests__/freshness-guard.test.ts): for every file
 * under `.claude/rules/*.md` + `.claude/templates/story.md`, assert the text contains no
 * `linear-sync.mjs` instruction. This fails fast if a future PR reintroduces a stale
 * linear-sync.mjs reference into a live-instruction doc.
 *
 * Intentionally excluded: `.claude/SYNC-ARCHITECTURE.md` — that document explicitly narrates
 * the Linear -> self-hosted migration history (CAM-282 T-6 rewrite) and documents
 * linear-sync.mjs's deprecated/rollback-lever status on purpose; it is historical narrative,
 * not a live instruction telling an agent to run the retired script.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const rulesDir = path.join(root, ".claude/rules");

const ruleFiles = readdirSync(rulesDir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => path.join(".claude/rules", f));

const storyTemplate = path.join(".claude/templates", "story.md");

const FILES_TO_CHECK = [...ruleFiles, storyTemplate];

describe("CAM-285 docs guard — no live linear-sync.mjs instruction remains", () => {
  it("checks at least the known rule files + the story template (guard against an empty glob)", () => {
    expect(ruleFiles.length).toBeGreaterThanOrEqual(10);
    expect(FILES_TO_CHECK).toContain(storyTemplate);
  });

  it.each(FILES_TO_CHECK)("%s contains no `linear-sync.mjs` instruction", (relFile) => {
    const src = readFileSync(path.join(root, relFile), "utf8");
    expect(src.includes("linear-sync.mjs")).toBe(false);
  });
});
