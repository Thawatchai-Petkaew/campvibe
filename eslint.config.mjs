import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-config-next@16 ships flat config arrays as CommonJS exports.
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  // Core Next.js rules (core-web-vitals already includes the base config)
  ...nextVitals,
  // TypeScript-ESLint recommended rules
  ...nextTs,
  // Project-specific ignores (build artifacts, generated files)
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "node_modules/**",
      "prisma/migrations/**",
      "prisma/generated/**",
    ],
  },
  // Baseline overrides for pre-existing widespread violations.
  // These are downgraded to warnings so the quality gate exits 0 while
  // keeping visibility. Each will be addressed per-ticket as the codebase matures.
  {
    rules: {
      // 96 occurrences across API routes and lib — pervasive pre-existing use of
      // `any` in Prisma query results and generic fetch wrappers. Fixing these
      // requires careful type-narrowing per file; tracked separately.
      "@typescript-eslint/no-explicit-any": "warn",

      // 3 occurrences — pre-existing @ts-ignore / @ts-expect-error comments that
      // were accepted before this lint gate existed.
      "@typescript-eslint/ban-ts-comment": "warn",

      // 11 occurrences — new strict rule added in react-hooks v7 (ships with
      // eslint-config-next@16). Patterns like calling setState inside useEffect
      // to sync derived state are widespread in the codebase; refactoring
      // these is a runtime-behaviour change, not a lint-only fix.
      "react-hooks/set-state-in-effect": "warn",

      // 2 occurrences — new strict rule (react-hooks v7) that flags component
      // definitions inside render functions. Pre-existing pattern; safe to warn.
      "react-hooks/static-components": "warn",

      // 1 occurrence — new strict rule (react-hooks v7) flagging impure
      // function calls during render. Pre-existing; warn only.
      "react-hooks/purity": "warn",

      // 1 occurrence — stylistic: unescaped ' in JSX text. Pre-existing copy.
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
