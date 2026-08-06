# CAM-688 — The first paint speaks the camper's language, not English

version 2 · 2026-08-06

## Story

As a **camper** who has chosen Thai, I want the page to be in Thai and baht the moment it appears, so that I never see a flash of a foreign language and a converted price on a site I already told which language I read.

Why: the preference lives only in localStorage, which the server cannot read, so every visit renders English/USD first and corrects after paint. Measured: the home page's SSR HTML carries 24 dollar amounts and zero baht signs.

Scope: `contexts/LanguageContext.tsx` · `app/layout.tsx` · the e2e session setup · docs · tests. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | A camper whose language preference is Thai, returning to the site | They load any page | หน้าเว็บเป็นภาษาไทยและราคาเป็นบาทตั้งแต่วินาทีแรกที่เห็น ไม่มีจังหวะที่เป็นภาษาอังกฤษหรือดอลลาร์ | The server resolves the preference from the cookie before the first byte and renders Thai; no client correction is needed | EC-1 |
| AC-2 | A camper who has never set a preference | They load any page | หน้าเว็บเป็นภาษาอังกฤษตามค่าเริ่มต้น | Default `en`; nothing changes for them | — |
| AC-3 | An existing camper whose Thai preference is in browser storage but has no cookie yet | They load any page for the first time after this ships | ครั้งแรกยังเห็นภาษาอังกฤษวูบหนึ่งแล้วเปลี่ยนเป็นไทย ครั้งต่อ ๆ ไปเป็นไทยตั้งแต่แรก | A one-time migration copies the stored value into the cookie | EC-2 |
| AC-4 | A camper reading the page in Thai | They switch the language | ทั้งหน้าเปลี่ยนภาษาทันที และยังเป็นภาษานั้นเมื่อกลับมาใหม่ | The cookie and browser storage are both written, and the page is refreshed so the document's language attribute matches | EC-3 |

## Rules

- BR-1 Cookie wins over browser storage. The migration runs only when no cookie is present AND storage carries a value.
- BR-2 The cookie is `campvibe_lang`, path `/`, max-age one year, sameSite lax, secure off localhost. Deliberately not httpOnly — the client must write it. It carries no personal data and reaches no permission or pricing decision.
- BR-3 Only `th` and `en` are honoured. Any other cookie value falls back to `en`.
- BR-4 The document's language attribute reflects the resolved language, and is refreshed after an in-session switch.

## Edge cases

- EC-1 IF the cookie holds an unrecognised value THEN render `en` and do not throw.
- EC-2 IF neither a cookie nor stored value exists THEN render `en` with no migration write.
- EC-3 IF the camper has disabled cookies THEN the language still switches for the session via browser storage, and the first paint stays `en` — degraded, not broken.

## Data

None. No schema change.

## Seams & refs

`contexts/LanguageContext.tsx:19` (the `'en'` default), `:22-27` (the mount effect), `:32` (the storage write), `:35-50` (`formatCurrency`) · `app/layout.tsx:71,74` · `e2e/regression/global.setup.ts` step 4 · `__tests__/cam-434-global-launcher.test.ts:31-36` (source-text pin that this diff breaks) · full analysis in `tech.md`.

## Out of scope

- Deleting the dead `getTranslations('th')` at `app/campgrounds/[slug]/page.tsx:69` — eight test files source-inspect that path; separate cleanup.
- `app/global-error.tsx:24`'s own hardcoded language attribute — record the decision in `tech.md`, do not change it here.

## Self-verify

- Fetch the real SSR HTML from localhost with a `campvibe_lang=th` cookie and prove baht signs are present and dollar amounts are absent. Repeat without the cookie and prove the English default still renders. **Assert on the rendered markup, not on a substring that host-authored content could also contain** (`ops.md`, CAM-666).
- Run the full suite as the LAST act after the final edit, and grep `__tests__/` for every source string this diff changes.
- `npm run lint` · `npm run typecheck` · `npm test` · design gate.
