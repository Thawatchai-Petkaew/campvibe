# CAM-688 — tech

Measured 2026-08-06 against the owner's running dev server. Two agents worked this independently; the second could not refute the root cause but broke one supporting claim and found a test the plan turns red. Both results are folded in below.

## Root cause (proven)

`contexts/LanguageContext.tsx:19` — `useState<Language>('en')`. The persisted preference lives **only in localStorage** (`campvibe_lang`, written at `:32`), which the server cannot read, and `app/layout.tsx:74` mounts `<LanguageProvider>` with no server-resolved value.

So the server renders — and the client hydrates — in English/USD for every `useLanguage()` consumer. The `useEffect` at `:22-27` is the first moment the persisted `th` is visible, and it commits **after** the first paint. `formatCurrency` at `:35-50` also converts THB→USD (rate 35) for that frame, which is why ฿750 paints as $21.

Server and client **agree** on English at hydration — that is why no hydration warning ever fired. They are simply both wrong.

Measured on real SSR HTML (RSC flight payload stripped, so no `$41`-style false positives): home `/` renders **24 `$NN` amounts and ZERO `฿`**.

## Approach — cookie-first

localStorage is client-only, so no client-side cleverness can make SSR agree with it. That is the whole defect.

1. `contexts/LanguageContext.tsx` — add optional `initialLanguage?: Language` (default `'en'`, so the 9 test files that mount the provider bare stay green); `useState(initialLanguage)`. `handleSetLanguage` writes `document.cookie` (`campvibe_lang=<lang>; path=/; max-age=31536000; samesite=lax`, `secure` off localhost) **in addition to** the existing `localStorage.setItem` — keep it, e2e and back-compat depend on it.
2. Demote the mount `useEffect` to a **one-time migration**: only when no cookie is present AND localStorage carries a value, set state and write the cookie. Without this every existing camper loses their preference; with it they eat the flash exactly once after deploy.
3. `app/layout.tsx` — `const lang = (await cookies()).get('campvibe_lang')?.value === 'th' ? 'th' : 'en'`; pass `initialLanguage={lang}` and set `<html lang={lang}>` (currently hardcoded `"en"` at `:71` — an a11y/SEO defect in its own right). The layout already awaits `auth()` and `headers()`, so `cookies()` costs nothing new.
4. `e2e/regression/global.setup.ts` step 4 — also `addCookies([{name:'campvibe_lang', value:'th', …}])` before `storageState()`. Without this the suite keeps first-painting English and keeps passing via the migration effect, proving nothing. Same for the guest context at `cam-664-spot-viewer.spec.ts:165` — use `addCookies`, not only `addInitScript`.

## Rejected, with reasons — do not substitute these

- **The ticket's own proposed fix** (lazy `useState` initializer reading localStorage). Under App Router the provider is SSR'd; the server has no `localStorage` and initializes `'en'` while the client initializer returns `'th'` — a genuine React 19 hydration mismatch that errors and re-renders the whole root client-side. It trades a one-frame flash for a hydration error.
  **Correction to the first agent's reasoning:** it claimed `__tests__/cam-604-availability-calendar-hydration.test.ts` would catch this. It would not — that file is `@vitest-environment jsdom`, so `renderToString` and `hydrateRoot` share one jsdom global with the same `localStorage`, and it never seeds the key. **No existing test guards this.** Add the guard rather than pointing at one that does not exist.
- **Hide-until-hydrated** (render null / opacity-0 until mounted). Trades the flash for a BLANK first paint on the SEO surface — a crawler running no JS sees an empty page, LCP is destroyed, and `.claude/rules/loading.md` names a full-page blank for a non-async concern the most damaging loader failure.
- **A next-themes-style inline blocking script.** Works for theme because theme is one class on `<html>`; language changes text nodes React owns, which a pre-hydration script cannot rewrite without being clobbered at hydration.

CSP: the fix adds no inline script, so it never touches the nonce surface CAM-607/CAM-610 manage. The cookie is a non-sensitive UI preference — deliberately **not** httpOnly (the client must write it), sameSite=lax, secure in prod, no PII, and it reaches no authz or pricing decision.

## Decisions (orchestrator, 2026-08-06)

1. **Cookie-first ships.** The three rejected options above stay rejected.
2. **Add the guard test the rejection needs** — a node-environment test proving the provider does not read `localStorage` during SSR. Otherwise the rejection is remembered, not enforced.
3. **Fix `__tests__/cam-434-global-launcher.test.ts:31-36` in this PR.** It does `layoutSrc.indexOf("<LanguageProvider>")` against the source text, so adding a prop makes it `-1` and the two ordering assertions collapse with it. Widen the pin (e.g. `/<LanguageProvider[\s>]/`). It was miscategorised as safe; it is the one that breaks.
4. **State the precedence rule and give a working English-override recipe.** `e2e/README.md:35` and `e2e/regression/README.md:63` sanction `localStorage.setItem("campvibe_lang","en")` as THE way to force English. Under cookie-first with a `th` cookie in storageState, that override becomes a silent no-op — the locator finds 0 elements and does not throw, exactly the failure shape those READMEs exist to prevent (CAM-570, 6 specs). Cookie wins; document `addCookies` as the override.
5. **`router.refresh()` after an in-session switch**, so the server-rendered `<html lang>` does not go stale. Note in the artifact that `app/global-error.tsx:24` renders its own `<html lang="th">` as a client component with no provider — the two roots now disagree by design; record the decision, do not silently leave it.
6. **Deleting the dead `getTranslations('th')` at `app/campgrounds/[slug]/page.tsx:69` is OUT OF SCOPE.** Eight test files source-inspect that path and two `vi.mock` it; it is separate cleanup.

## Risk to verify at G4, not a known break

This is the **first time the Thai branch ever renders on the server** — 63 files / 71 `useLanguage()` call sites, now including `th-TH` locale formatting in `availability-calendar.tsx:165,174`, `host-holds-section.tsx:98,106`, `bookings/page.tsx:196,207`, `dashboard/page.tsx:288`, `AiChatDetailCard.tsx:298`, `booking-view.ts:72`, and `date-fns/locale` `th` at `CampgroundDetailClient.tsx:42`. Buddhist-era dates and Thai month names now come from Node's ICU as well as the browser's.

Spot-checked on Node v22 (full ICU): `฿750`, `กรกฎาคม 2569`, `อังคาร`, `28/7/2569` — all match browser output. So: a surface to **verify**, not a known break. But it is verbatim React's documented "date formatting in a user's locale which doesn't match the server" mismatch class, and CAM-604 exists because this repo already got bitten by it.

Counts corrected for the builder: **9** test files mount the provider (not 14) — cam-496 ×2, cam-616 ×3, cam-604, cam-638, cam-639, cam-684. **63 files / 71 call sites** use `useLanguage()` (not 82).
