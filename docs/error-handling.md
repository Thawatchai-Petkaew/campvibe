---
feature: performance-and-freshness
story: CAM-218 ERR-1
updated: 2026-06-27
---

# Error Handling Standard — CampVibe Platform

## Decision matrix (which file handles which error)

| Condition | Next.js file | Component / approach |
|---|---|---|
| Route does not exist / resource is missing (404) | `app/not-found.tsx` | `<ErrorState variant="not-found"/>` (full-page, with Navbar) |
| Unhandled runtime exception (500 / unexpected) | `app/error.tsx` | `<ErrorState variant="error" onRetry={reset}/>` (full-page, with Navbar) |
| Root layout / framework-level crash | `app/global-error.tsx` | Minimal self-contained bilingual block (no providers, no Navbar) |
| Authenticated user has no permission (403) | `notFound()` (server) or `<ErrorState variant="forbidden"/>` (client) | Use `notFound()` to avoid existence leaks on server; use `forbidden` variant only when showing the page is intentional |
| Section / partial area failed to load | Inline via `<ErrorState compact>` | Dashboard segment: `app/dashboard/error.tsx` renders compact inline; no Navbar override |
| Auth required, not logged in (401) | Middleware redirect to `/login` | Unchanged — handled by Next.js middleware + NextAuth |

## Next.js error file semantics

| File | Who renders it | Must be client? | Owns html/body? |
|---|---|---|---|
| `app/not-found.tsx` | Next.js when `notFound()` is called or route is missing | No (but must be "use client" if it uses hooks like `useLanguage`) | No — inherits root layout |
| `app/error.tsx` | Next.js when a segment throws | Yes — always "use client" | No — inherits root layout |
| `app/global-error.tsx` | Next.js when the root layout itself throws | Yes — always "use client" | Yes — must render `<html><body>` |
| `app/dashboard/error.tsx` | Next.js when the dashboard segment throws | Yes — always "use client" | No — inherits dashboard layout (sidebar stays) |

`global-error.tsx` replaces the entire layout tree. No `LanguageProvider`, no `Navbar`, no `Toaster` — the component must be fully self-contained.

## i18n pattern

Error pages that render inside the root layout (not-found, error, dashboard/error) have access to `LanguageProvider` and can use `useLanguage()`. This is why they are marked `"use client"`.

`global-error.tsx` does NOT have access to any provider — it renders its own `<html><body>`. That component hard-codes a minimal bilingual fallback (TH + EN inline) rather than pulling from `locales/`.

All other copy flows through `locales/translations.json` under the `"errors"` key (see below).

## ErrorState API

```ts
interface ErrorStateProps {
  variant: 'not-found' | 'error' | 'forbidden' | 'generic';
  title?: string;       // overrides the i18n default title for this variant
  message?: string;     // overrides the i18n default message
  actionLabel?: string; // overrides the primary CTA label
  actionHref?: string;  // primary CTA href (defaults to '/')
  onRetry?: () => void; // if provided on 'error' variant, shows the retry button
  compact?: boolean;    // renders inline at reduced size (no full-screen min-height)
}
```

### Variant to mascot map

| Variant | Mascot pose | Asset path |
|---|---|---|
| `not-found` | Thinking / scratching head | `/mascot/thinking.png` |
| `error` | Sitting with laptop | `/mascot/coding.png` |
| `forbidden` | Waving | `/mascot/waving.png` |
| `generic` | Walking with laptop | `/mascot/walking.png` |

Mascot assets are transparent PNGs placed in `public/mascot/` by the owner. They render correctly on both light and dark backgrounds — no `-dark` variant needed. If a PNG is missing, `ImageWithFallback` shows the `ImageOff` lucide icon in a `bg-muted rounded-full` container — never a broken-image browser icon.

See `public/mascot/README.md` for asset placement instructions.

## Copy tone rules (citing DESIGN.md §4)

- Thai: friendly, polite, action-oriented. No em-dash as separator. No technical jargon ("404", "500", "API", "server error") in user-facing text.
- English: concise imperative.
- Errors never leak stack traces, server error messages, or error.digest to the user — only generic copy from `locales/`.
- Every string lives in `locales/translations.json` under `errors.notFound / errors.unexpected / errors.forbidden / errors.generic`.

## Add error handling to a new route segment (checklist)

1. If a server action or data-fetch can throw, wrap in try/catch and return a typed error shape (see `.claude/rules/api.md` — `apiError` helpers).
2. For segment-level errors, add an `error.tsx` next to the segment `page.tsx` — mark `"use client"`, receive `{ error, reset }`, call `console.error(error)` in a `useEffect`, render `<ErrorState variant="error" onRetry={reset} compact />` (compact if sidebar/layout should stay).
3. For 404 / missing resources, call `notFound()` in the server component — Next.js triggers the nearest `not-found.tsx`.
4. For 403 / ownership checks: prefer `notFound()` to avoid existence leaks. Use `<ErrorState variant="forbidden"/>` only when deliberately showing that a resource exists but is off-limits.
5. Never render `error.message` or any stack trace to the user — only generic copy from `locales/`.
6. `global-error.tsx` is the last resort; it owns its own `<html><body>` — keep it self-contained and minimal.

## Cross-references

- `DESIGN.md` §4 — copy tone, no em-dash, no technical jargon
- `DESIGN.md` §3 — Button primitives used by ErrorState
- `.claude/rules/api.md` — `apiError` helpers; API-layer JSON errors are a separate layer from these page-level error files
- `components/ErrorState.tsx` — the component implementation
- `components/ui/image-with-fallback.tsx` — mascot image with graceful fallback
- `public/mascot/README.md` — asset placement guide for the owner
