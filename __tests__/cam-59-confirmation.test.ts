/**
 * cam-59-confirmation.test.ts — CAM-59 หน้ายืนยันการจองและรหัสการจอง
 *
 * AC coverage matrix (every row in the AC table → test(s)):
 *   AC#1  redirect after booking → page.tsx is a Server Component (async, uses auth() + prisma)
 *         + CampgroundDetailClient uses router.push (no setTimeout/window.location.href)
 *   AC#2  booking ref format    → formatBookingRef: 'CAMP-XXXXXXXX' (first 8 chars, uppercase)
 *   AC#3  "ดูการจองทั้งหมด" nav  → i18n key th.bookings.viewAllBookings exists
 *   AC#4  "กลับไปดูลานแคมป์" nav → i18n key th.bookings.backToCampsite exists
 *   AC#5  wrong-owner → 404     → page.tsx scopes query to { id, userId: session.user.id }
 *                                 → notFound() on null (no 403, no existence leak)
 *   AC#6  unauthenticated → login redirect → page.tsx calls redirect('/login') when no session
 *   AC#7  non-existent id → 404 → same null path as AC#5 → notFound()
 *         i18n: th.bookings.notFound === 'ไม่พบข้อมูลการจอง' (verbatim)
 *
 * Layers:
 *   formatBookingRef            → unit (pure function, zero imports)
 *   page.tsx server component   → source-inspection (Server Component; jsdom cannot render it;
 *                                  precedent: CAM-79/61)
 *   CampgroundDetailClient.tsx  → source-inspection (redirect pattern change)
 *   locales/translations.json   → unit (JSON parse + verbatim string assertion)
 *
 * Prove-It: every assertion below is stated with its "fail condition" so the red-then-green
 * contract is transparent. See inline comments marked "Prove-It".
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { formatBookingRef } from '@/lib/booking-ref';

// ---------------------------------------------------------------------------
// 1. Unit — formatBookingRef (AC#2 + Rule: "CAMP-XXXXXXXX")
// ---------------------------------------------------------------------------
describe('formatBookingRef — unit (AC#2)', () => {
  /**
   * Prove-It: if the prefix were missing or the slice length changed,
   * the exact-string assertion fails.
   */
  it('[normal] typical UUID → "CAMP-" + first 8 chars uppercased (AC#2)', () => {
    const result = formatBookingRef('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(result).toBe('CAMP-A1B2C3D4');
  });

  it('[normal] first 8 chars are already uppercase → idempotent (AC#2)', () => {
    const result = formatBookingRef('DEADBEEF-1234-5678-abcd-ef0000000000');
    expect(result).toBe('CAMP-DEADBEEF');
  });

  it('[normal] all-digit start → prefix + digits uppercased (AC#2)', () => {
    const result = formatBookingRef('12345678-0000-0000-0000-000000000000');
    expect(result).toBe('CAMP-12345678');
  });

  /**
   * Prove-It: if slice(0, 8) were changed to slice(0, 6) the length check fails.
   */
  it('[normal] result length is always 13 (CAMP- = 5, 8 chars = 8) (AC#2 Rule)', () => {
    const result = formatBookingRef('a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    expect(result).toHaveLength(13);
  });

  it('[normal] result always starts with "CAMP-" (AC#2 Rule)', () => {
    const result = formatBookingRef('00000000-0000-0000-0000-000000000000');
    expect(result).toMatch(/^CAMP-/);
  });

  /**
   * Prove-It: if toUpperCase() were removed, lowercase input would fail this.
   */
  it('[normal] lowercase hex chars in id are uppercased in the ref (AC#2 Rule)', () => {
    const result = formatBookingRef('abcdef12-0000-0000-0000-000000000000');
    expect(result).toBe('CAMP-ABCDEF12');
  });

  /**
   * Prove-It: if the function returned just the first 4 chars this would fail.
   */
  it('[boundary] id exactly 8 chars (no dash) → full 8-char prefix (AC#2 edge)', () => {
    const result = formatBookingRef('abcd1234');
    expect(result).toBe('CAMP-ABCD1234');
  });

  /**
   * Prove-It: if slice(0, 8) returned all chars on a short string the length assertion fails.
   */
  it('[boundary] id shorter than 8 chars → prefix + available chars (no crash) (AC#2 null/short)', () => {
    const result = formatBookingRef('abc');
    expect(result).toBe('CAMP-ABC');
    expect(result.startsWith('CAMP-')).toBe(true);
  });

  it('[null/empty] empty string → only the prefix (no crash) (AC#2 null/empty)', () => {
    const result = formatBookingRef('');
    expect(result).toBe('CAMP-');
    expect(() => formatBookingRef('')).not.toThrow();
  });

  it('[error/validation] function does not throw on any string input (AC#2 robustness)', () => {
    expect(() => formatBookingRef('!!@@##$$')).not.toThrow();
    expect(() => formatBookingRef('   ')).not.toThrow();
  });

  /**
   * Prove-It — Broken-impl test.
   * A broken impl that ignores the slice (returns the whole id) would produce
   * something longer than 13 chars, failing the toBe assertion.
   */
  it('[prove-it] broken impl returning the whole id would fail the exact-value assertion', () => {
    // We demonstrate the inverse: the expected value is fixed; any deviation fails.
    const id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const ref = formatBookingRef(id);
    // Only the first 8 chars of the UUID segment should appear
    expect(ref).toBe('CAMP-F47AC10B');
    expect(ref).not.toBe('CAMP-' + id); // would fail if slice were skipped
    expect(ref).not.toContain('-58cc');  // rest of UUID must not appear
  });
});

// ---------------------------------------------------------------------------
// 2. Source-inspection — page.tsx (Server Component authz + 404 + auth)
//
// Server Components using auth() + Prisma cannot be rendered in a jsdom/node
// vitest environment (they import next-auth, Prisma client, and next/navigation
// which all require the Next.js runtime). Per the precedent from CAM-79/61,
// source-inspection is the correct layer for server-component contracts.
// ---------------------------------------------------------------------------
describe('source-inspection — page.tsx Server Component (AC#5, AC#6, AC#7)', () => {
  const pageSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/bookings/[id]/confirmation/page.tsx'),
    'utf-8'
  );

  /**
   * AC#6 — unauthenticated → redirect to login.
   * Prove-It: remove the redirect('/login') call → this assertion fails.
   */
  it('[source] page.tsx redirects to /login when no session (AC#6)', () => {
    // Actual source uses double-quotes: redirect("/login")
    expect(pageSrc).toContain('redirect("/login")');
  });

  it('[source] page.tsx reads session via auth() server-side (AC#6 — never from body/param)', () => {
    // auth() must be awaited; userId must come from session, not from params.
    expect(pageSrc).toContain('await auth()');
    // Confirm it guards on session.user.id before querying
    expect(pageSrc).toContain('session?.user?.id');
  });

  /**
   * AC#5 + AC#7 — owner-scoped fetch: null for wrong-owner OR non-existent id.
   * Prove-It: change the where clause to just { id } → ownership check is absent → test fails.
   */
  it('[source] page.tsx Prisma query is owner-scoped with { id, userId: session.user.id } (AC#5)', () => {
    // The query must include both id and userId so another user's booking returns null.
    expect(pageSrc).toContain('userId: session.user.id');
    expect(pageSrc).toContain('findFirst');
  });

  /**
   * Prove-It: remove notFound() → both AC#5 and AC#7 wrong-path would not return 404.
   */
  it('[source] page.tsx calls notFound() when booking is null (AC#5 + AC#7 — no 403, no existence leak)', () => {
    expect(pageSrc).toContain('notFound()');
    // Confirm no "status: 403" in code — the word '403' may appear in comments but must
    // never appear as a status return value. Assert the actionable anti-pattern is absent.
    expect(pageSrc).not.toContain("status: 403");
    expect(pageSrc).not.toContain("return NextResponse.json(");
  });

  it('[source] page.tsx does NOT return a 404 only for "wrong-owner" and a 403 for "found" (no existence leak) (AC#5)', () => {
    // The single unified null→notFound() path means both cases (wrong-owner, not-found)
    // hit the same code branch — no split that leaks existence.
    // The function call notFound() appears once as the error-path (import line also
    // contains the identifier, so we assert the call-site pattern directly).
    expect(pageSrc).toContain('if (!booking) {');
    expect(pageSrc).toContain('notFound();');
    // No separate 403-returning branch for wrong-owner — the existence check
    // is unified: both wrong-owner and not-found produce null → notFound().
    expect(pageSrc).not.toContain('status: 403');
    expect(pageSrc).not.toContain("code: 403");
  });

  /**
   * AC#1 Rule — page is a Server Component (async, uses auth + Prisma, no "use client").
   * Prove-It: add "use client" at the top → the startsWith check would detect it.
   */
  it('[source] page.tsx is a Server Component — no "use client" directive at top (AC#1 Rule)', () => {
    // "use client" must not appear as the first directive
    expect(pageSrc.trimStart()).not.toMatch(/^"use client"/);
    expect(pageSrc).not.toContain('"use client"');
  });

  it('[source] page.tsx is an async function (server-side data fetch requirement) (AC#1 Rule)', () => {
    expect(pageSrc).toContain('async function BookingConfirmationPage');
  });

  it('[source] page.tsx sets robots noindex (auth-gated page — per .claude/rules/seo.md §8)', () => {
    expect(pageSrc).toContain('robots: { index: false }');
  });

  it('[source] page.tsx serializes Dates to ISO strings before passing to client component (Rule: server-side)', () => {
    // Prevents Prisma Date object serialization mismatch across server→client boundary.
    expect(pageSrc).toContain('.toISOString()');
  });

  it('[source] page.tsx coerces Decimal totalPrice to Number() for the client (Rule: server-side)', () => {
    expect(pageSrc).toContain('Number(booking.totalPrice)');
  });

  it('[source] page.tsx includes campSite relation (nameTh, nameEn, nameThSlug) in the select (AC#2)', () => {
    expect(pageSrc).toContain('nameTh');
    expect(pageSrc).toContain('nameEn');
    expect(pageSrc).toContain('nameThSlug');
  });
});

// ---------------------------------------------------------------------------
// 3. Source-inspection — CampgroundDetailClient.tsx redirect change (AC#1)
//
// The old setTimeout/window.location.href pattern must be gone; the new
// router.push('/bookings/${data.id}/confirmation') must be present.
// Per the same precedent (CAM-79/61), source-inspection is appropriate for
// verifying a wiring/redirect change in a "use client" component.
// ---------------------------------------------------------------------------
describe('source-inspection — CampgroundDetailClient.tsx redirect change (AC#1)', () => {
  const clientSrc = fs.readFileSync(
    path.join(process.cwd(), 'components/CampgroundDetailClient.tsx'),
    'utf-8'
  );

  /**
   * Prove-It: if the old setTimeout were still present, the toContain check fails.
   */
  it('[source] CampgroundDetailClient no longer uses setTimeout for redirect (AC#1 Rule)', () => {
    // The old anti-pattern: setTimeout(() => window.location.href = "/bookings", 1500)
    expect(clientSrc).not.toContain("setTimeout");
  });

  it('[source] CampgroundDetailClient does not use window.location.href for post-booking redirect (AC#1 Rule)', () => {
    // Rule: "ไม่มีการ auto-redirect จาก toast อีกต่อไป"
    expect(clientSrc).not.toContain('window.location.href = "/bookings"');
    expect(clientSrc).not.toContain("window.location.href = '/bookings'");
  });

  /**
   * Prove-It: remove the router.push call → this assertion fails.
   */
  it('[source] CampgroundDetailClient uses router.push to /bookings/${data.id}/confirmation (AC#1)', () => {
    expect(clientSrc).toContain('router.push(`/bookings/${');
    expect(clientSrc).toContain('/confirmation`');
  });

  it('[source] CampgroundDetailClient imports useRouter from next/navigation (AC#1)', () => {
    expect(clientSrc).toContain('useRouter');
    expect(clientSrc).toContain('next/navigation');
  });

  it('[source] CampgroundDetailClient instantiates const router = useRouter() (AC#1)', () => {
    expect(clientSrc).toContain('const router = useRouter()');
  });
});

// ---------------------------------------------------------------------------
// 4. i18n verbatim — locales/translations.json (AC#1, AC#2, AC#3, AC#4, AC#7)
//
// All user-visible strings from the spec/AC table must be present verbatim
// in translations.json. A single character change is a defect.
// ---------------------------------------------------------------------------
describe('i18n verbatim — locales/translations.json bookings namespace (CAM-59)', () => {
  const translationsPath = path.join(process.cwd(), 'locales/translations.json');
  const raw = fs.readFileSync(translationsPath, 'utf-8');
  const translations = JSON.parse(raw) as Record<string, Record<string, Record<string, string>>>;

  const th = translations['th']['bookings'];
  const en = translations['en']['bookings'];

  /**
   * AC#1 — visible result: หัวข้อ "การจองสำเร็จแล้ว"
   * Prove-It: change the Thai string by 1 char → toBe assertion fails immediately.
   */
  it('[copy] th.bookings.confirmationTitle === "การจองสำเร็จแล้ว" (AC#1 verbatim)', () => {
    expect(th.confirmationTitle).toBe('การจองสำเร็จแล้ว');
  });

  /**
   * AC#7 / not-found.tsx — "ไม่พบข้อมูลการจอง"
   * Prove-It: change the copy → fails.
   */
  it('[copy] th.bookings.notFound === "ไม่พบข้อมูลการจอง" (AC#5 + AC#7 verbatim)', () => {
    expect(th.notFound).toBe('ไม่พบข้อมูลการจอง');
  });

  /**
   * AC#3 — button "ดูการจองทั้งหมด"
   * Prove-It: key missing → toHaveProperty fails; wrong value → toBe fails.
   */
  it('[copy] th.bookings.viewAllBookings is present and non-empty (AC#3)', () => {
    expect(th).toHaveProperty('viewAllBookings');
    expect(th.viewAllBookings).toBeTruthy();
    expect(typeof th.viewAllBookings).toBe('string');
  });

  /**
   * AC#4 — button "กลับไปดูลานแคมป์"
   */
  it('[copy] th.bookings.backToCampsite is present and non-empty (AC#4)', () => {
    expect(th).toHaveProperty('backToCampsite');
    expect(th.backToCampsite).toBeTruthy();
    expect(typeof th.backToCampsite).toBe('string');
  });

  it('[copy] th.bookings.backToCampsite === "กลับไปดูลานแคมป์" (AC#4 verbatim)', () => {
    expect(th.backToCampsite).toBe('กลับไปดูลานแคมป์');
  });

  it('[copy] th.bookings.viewAllBookings === "ดูการจองทั้งหมด" (AC#3 verbatim)', () => {
    expect(th.viewAllBookings).toBe('ดูการจองทั้งหมด');
  });

  /**
   * AC#2 — booking ref label "รหัสการจอง"
   */
  it('[copy] th.bookings.bookingRefLabel === "รหัสการจอง" (AC#2 visible label verbatim)', () => {
    expect(th.bookingRefLabel).toBe('รหัสการจอง');
  });

  /**
   * English counterparts — ensure EN locale has the same keys.
   */
  it('[copy] en.bookings.confirmationTitle is present (AC#1 EN)', () => {
    expect(en).toHaveProperty('confirmationTitle');
    expect(en.confirmationTitle).toBeTruthy();
  });

  it('[copy] en.bookings.notFound is present (AC#7 EN)', () => {
    expect(en).toHaveProperty('notFound');
    expect(en.notFound).toBe('Booking not found');
  });

  it('[copy] en.bookings.viewAllBookings is present (AC#3 EN)', () => {
    expect(en).toHaveProperty('viewAllBookings');
    expect(en.viewAllBookings).toBe('View all bookings');
  });

  it('[copy] en.bookings.backToCampsite is present (AC#4 EN)', () => {
    expect(en).toHaveProperty('backToCampsite');
    expect(en.backToCampsite).toBe('Back to campsite');
  });

  /**
   * Structural completeness — all 5 CAM-59 keys exist in both locales.
   * Prove-It: delete any key from translations.json → the toHaveProperty assertion fails.
   */
  it('[normal] all 5 CAM-59 keys exist in th.bookings namespace', () => {
    const required = [
      'confirmationTitle',
      'bookingRefLabel',
      'viewAllBookings',
      'backToCampsite',
      'notFound',
    ];
    for (const key of required) {
      expect(th).toHaveProperty(key);
    }
  });

  it('[normal] all 5 CAM-59 keys exist in en.bookings namespace', () => {
    const required = [
      'confirmationTitle',
      'bookingRefLabel',
      'viewAllBookings',
      'backToCampsite',
      'notFound',
    ];
    for (const key of required) {
      expect(en).toHaveProperty(key);
    }
  });

  /**
   * No em-dash in Thai copy — per .claude/rules/code.md §4 (Thai copy: no em-dash separator).
   */
  it('[copy] th.bookings.confirmationTitle contains no em-dash (copy rule)', () => {
    expect(th.confirmationTitle).not.toContain('—');
  });

  it('[copy] th.bookings.notFound contains no em-dash (copy rule)', () => {
    expect(th.notFound).not.toContain('—');
  });
});

// ---------------------------------------------------------------------------
// 5. Source-inspection — not-found.tsx (AC#5, AC#7)
//
// The not-found.tsx must use the Thai "ไม่พบข้อมูลการจอง" string from
// the translation layer, not a hardcoded string.
// ---------------------------------------------------------------------------
describe('source-inspection — not-found.tsx (AC#5, AC#7)', () => {
  const notFoundSrc = fs.readFileSync(
    path.join(process.cwd(), 'app/bookings/[id]/confirmation/not-found.tsx'),
    'utf-8'
  );

  it('[source] not-found.tsx reads from translations via getTranslations (AC#5, AC#7)', () => {
    // Must not hardcode the Thai string; must use i18n helper.
    expect(notFoundSrc).toContain('getTranslations');
  });

  it('[source] not-found.tsx uses t.bookings.notFound key (AC#7 copy wired)', () => {
    expect(notFoundSrc).toContain('t.bookings.notFound');
  });

  it('[source] not-found.tsx does NOT hardcode "ไม่พบข้อมูลการจอง" as a literal string (i18n Rule)', () => {
    // Strings must live in locales/, not in components.
    expect(notFoundSrc).not.toContain('"ไม่พบข้อมูลการจอง"');
  });

  it('[source] not-found.tsx renders h1 heading for accessibility (a11y)', () => {
    // AC#5/AC#7: the 404 page must have a heading
    expect(notFoundSrc).toContain('<h1');
  });
});
