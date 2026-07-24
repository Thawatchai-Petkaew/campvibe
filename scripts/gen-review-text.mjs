#!/usr/bin/env node
// gen-review-text.mjs — ONE-TIME OpenRouter Thai review-text generator for the
// ~30-40 "hero" (curated, named/real-destination) camps — Hybrid text plan
// (docs/specs/.../research-user-jolly-mochi.md): free aspect-bank template by
// default, LLM-generated Thai for named/demo camps, cached to committed JSON.
//
// COST ITEM — this script calls a paid model (~$0.05-0.09 one-time per the plan).
// It NEVER calls the API without OPENROUTER_API_KEY: with no key it prints a clear
// message and exits 0 (never blocks the free path — scripts/seed-demand.mjs runs
// fully without this cache, falling back to prisma/data/aspect-bank.json). Do not
// run this against a real key without the owner's go-ahead.
//
// ONE request PER CAMP (not per review), temperature 0, asking for a small JSON
// array of that camp's review texts. Writes/merges into the committed cache
// prisma/data/reviews-generated.json, keyed by campSiteSlug -> { contentHash, texts }
// so a partial re-run only touches the camps it actually (re-)generated and never
// clobbers cache entries for camps outside this run.
//
// Run: OPENROUTER_API_KEY=sk-... node scripts/gen-review-text.mjs
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// Mirrors lib/ai/openrouter-client.ts's DEFAULT_MODEL/env-override convention —
// this is a plain Node .mjs script (no TS import across that boundary), so the
// constant is duplicated here deliberately, not re-derived at runtime.
const MODEL = (process.env.OPENROUTER_MODEL || '').trim() || 'openai/gpt-4o-mini';
const TEMPERATURE = 0;
const MAX_TOKENS = 700;
const REQUEST_TIMEOUT_MS = 20_000;

/** "~30-40" per the plan — the first N curated (named/real-destination) camps, sorted for a stable, reproducible pick. */
const HERO_CAMP_COUNT = 35;
/** A small, fixed number of review-like texts requested per camp (kept low: cost + variety are both bounded per-camp, not per-review). */
const TEXTS_PER_CAMP = 6;

const MOCK_DATA_PATH = path.join(ROOT, 'prisma/data/mock-staging-all.json');
const CACHE_PATH = path.join(ROOT, 'prisma/data/reviews-generated.json');

function loadHeroCamps() {
  const data = JSON.parse(fs.readFileSync(MOCK_DATA_PATH, 'utf8'));
  const camps = [];
  for (const h of data.hosts ?? []) for (const c of h.campsites ?? []) camps.push(c);
  // `curated:true` = a real named Thai destination from the 48 curated concepts
  // (scripts/gen-mock-data.mjs); province-fill camps are `curated:false`/absent.
  return camps
    .filter((c) => c.curated === true)
    .sort((a, b) => a.nameThSlug.localeCompare(b.nameThSlug))
    .slice(0, HERO_CAMP_COUNT);
}

/** Content-hash of the camp's own real fields — used to skip regenerating a camp whose source data hasn't changed since the cache was last written. */
function campContentHash(camp) {
  const material = JSON.stringify({
    nameTh: camp.nameTh,
    nameEn: camp.nameEn,
    description: camp.description,
    facilities: camp.facilities,
    terrain: camp.terrain,
    tags: camp.tags,
    petFriendly: camp.petFriendly,
    toiletInfo: camp.toiletInfo,
    minimumAge: camp.minimumAge,
  });
  return createHash('sha256').update(material).digest('hex').slice(0, 16);
}

function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    return raw && typeof raw === 'object' && raw.camps ? raw : { _comment: raw?._comment, camps: {} };
  } catch {
    return { camps: {} };
  }
}

function buildPrompt(camp) {
  const facts = [
    `ชื่อ: ${camp.nameTh} (${camp.nameEn ?? ''})`,
    `จังหวัด: ${camp.province ?? ''}`,
    `สิ่งอำนวยความสะดวก (โค้ด): ${camp.facilities ?? '-'}`,
    `ภูมิประเทศ (โค้ด): ${camp.terrain ?? '-'}`,
    `แท็ก: ${camp.tags ?? '-'}`,
    `พาสัตว์เลี้ยงได้: ${camp.petFriendly ? 'ได้' : 'ไม่ได้'}`,
    `ข้อมูลห้องน้ำ: ${camp.toiletInfo ?? '-'}`,
    `อายุขั้นต่ำ: ${camp.minimumAge ?? 0}`,
  ].join('\n');
  return [
    'You write short, natural Thai campsite reviews for a mock/demo dataset (never a real user review).',
    `Given these REAL facts about one campsite, write exactly ${TEXTS_PER_CAMP} short Thai review texts (1-3 sentences each, 15-220 Thai characters), each praising or honestly noting ONLY things consistent with the facts below — never invent a fact not implied by them. Vary the sentiment across the set (mostly positive, at least one mixed/critical note). Return ONLY a JSON array of ${TEXTS_PER_CAMP} strings, no markdown, no extra keys, no commentary.`,
    facts,
  ].join('\n\n');
}

async function callOpenRouter(apiKey, prompt) {
  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('no content in completion');
  // Model may wrap the array in a code fence despite the instruction — strip defensively.
  const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || !parsed.every((t) => typeof t === 'string')) {
    throw new Error('completion was not a JSON string array');
  }
  return parsed.slice(0, TEXTS_PER_CAMP);
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log(
      '[gen-review-text] OPENROUTER_API_KEY is not set — no-op (this is expected on every free/CI run). ' +
      'scripts/seed-demand.mjs works fully without this cache via prisma/data/aspect-bank.json. ' +
      'To generate: OPENROUTER_API_KEY=sk-... node scripts/gen-review-text.mjs (owner-authorized cost item, ~$0.05-0.09 one-time).'
    );
    process.exit(0);
  }

  const heroCamps = loadHeroCamps();
  if (heroCamps.length === 0) {
    console.error('[gen-review-text] no curated hero camps found in prisma/data/mock-staging-all.json — run gen-mock-data.mjs + merge-mock-data.mjs first.');
    process.exit(1);
  }

  const cache = loadCache();
  let generated = 0, skipped = 0, failed = 0;

  for (const camp of heroCamps) {
    const hash = campContentHash(camp);
    const existing = cache.camps[camp.nameThSlug];
    if (existing && existing.contentHash === hash) { skipped++; continue; }

    try {
      const texts = await callOpenRouter(apiKey, buildPrompt(camp));
      cache.camps[camp.nameThSlug] = { contentHash: hash, nameTh: camp.nameTh, texts, generatedAt: new Date().toISOString() };
      generated++;
      console.log(`[gen-review-text] generated ${texts.length} texts for ${camp.nameThSlug}`);
    } catch (err) {
      failed++;
      console.error(`[gen-review-text] FAILED for ${camp.nameThSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  cache._comment =
    'CAM demand-seeding toolkit — committed LLM review-text cache, written ONLY by scripts/gen-review-text.mjs (OpenRouter, owner-gated: requires OPENROUTER_API_KEY, never called automatically). Keyed by campSiteSlug -> { contentHash, texts }. scripts/seed-demand.mjs prefers a cache hit here and falls back to prisma/data/aspect-bank.json for every camp not present.';
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
  console.log(`[gen-review-text] done — generated=${generated} skipped(unchanged)=${skipped} failed=${failed} — wrote ${path.relative(ROOT, CACHE_PATH)}`);
  if (failed > 0 && generated === 0) process.exit(1);
}

main().catch((err) => {
  console.error('[gen-review-text] fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
