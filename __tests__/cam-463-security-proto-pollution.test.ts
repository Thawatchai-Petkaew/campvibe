/**
 * CAM-463 security hardening — Important robustness bug (security-found):
 * a prototype-chain lookup key defeated `resolveRegionForSearch`'s "never
 * throws" contract (BR-4/AC-6).
 *
 * Repro (pre-fix): `REGION_ALIASES` was a plain object literal, so it
 * inherited `Object.prototype`. A lookup key of `'__proto__'` /
 * `'constructor'` / `'toString'` / `'valueOf'` / `'hasOwnProperty'` returned
 * an INHERITED truthy value (an object/function from `Object.prototype`,
 * e.g. `REGION_ALIASES['__proto__']` === `Object.prototype`), which the
 * function then treated as a resolved `region`. `REGION_TO_PROVINCES[that
 * BogusRegion]` returned `undefined` (the bogus "region" stringifies to a
 * key that doesn't exist on `REGION_TO_PROVINCES`), and
 * `[...undefined]` threw a `TypeError`. A prompt-injected `region:
 * '__proto__'` argument from the AI tool boundary (`lib/ai/tools/
 * search-campsites.ts`) would crash the tool call instead of falling
 * through to AC-6's honest "no region filter / 0 rows" behavior.
 *
 * Fix: `REGION_ALIASES` is built on `Object.create(null)` (no prototype
 * chain), so every adversarial key correctly misses and returns `undefined`
 * — the function falls through to its raw-passthrough branch, same as any
 * other unrecognized word (BR-4/AC-6), and never throws.
 *
 * Prove-It: each case asserts (1) it does not throw and (2) it returns the
 * raw value unchanged (no region filter applied) — matching the existing
 * "unrecognized word" contract, not a special case.
 */
import { describe, it, expect } from 'vitest';
import { resolveRegionForSearch, REGION_TO_PROVINCES } from '@/lib/thai-regions';

describe('resolveRegionForSearch — prototype-chain key hardening (CAM-463 security fix)', () => {
  const adversarialKeys = ['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

  it.each(adversarialKeys)(
    '[unit][error][security] "%s" does not throw and returns the raw value unchanged (no region filter, BR-4/AC-6)',
    (key) => {
      expect(() => resolveRegionForSearch(key)).not.toThrow();
      const result = resolveRegionForSearch(key);
      expect(result).toBe(key); // raw passthrough — same contract as any unrecognized word
      expect(Array.isArray(result)).toBe(false); // never expanded into a bogus province filter
    },
  );

  it('[unit][concurrent] every adversarial key resolves independently — no shared-state leakage across calls', () => {
    for (const key of adversarialKeys) {
      expect(resolveRegionForSearch(key)).toBe(key);
    }
    // a real alias resolved afterward is unaffected by the adversarial lookups above
    expect(resolveRegionForSearch('ภาคเหนือ')).toEqual([...REGION_TO_PROVINCES.NORTH]);
  });

  it('[unit][normal] happy path is unaffected by the hardening — real regions/aliases still resolve identically', () => {
    expect(resolveRegionForSearch('ภาคเหนือ')).toEqual([...REGION_TO_PROVINCES.NORTH]);
    expect(resolveRegionForSearch('อีสาน')).toEqual([...REGION_TO_PROVINCES.NORTHEAST]);
    expect(resolveRegionForSearch('ภาคใต้')).toEqual([...REGION_TO_PROVINCES.SOUTH]);
  });
});
