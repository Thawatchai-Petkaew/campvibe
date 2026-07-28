/**
 * cam-450-detail-drawer.test.ts — CAM-450
 *
 * Covers the decision-order IA rewrite of the AI-chat camp-detail drawer:
 * section order, the floating-glass geometry, the new
 * `weekendAvailability`/`cancellationPolicy`/`isVerified`/price(+extraFee)
 * wiring from CAM-449's enriched `GetCampDetailResult`, and the real,
 * behavioral `getFacilityIcon` lookup (`lib/facility-icon-map.ts`). This
 * repo's Vitest runs `environment: 'node'` (no jsdom) — component coverage
 * here follows the SAME source-inspection convention already established by
 * `cam-447-ai-chat-detail-card.test.ts` (real string/structural assertions
 * against the compiled source, not a rendering harness).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";
import { getFacilityIcon, FACILITY_ICON_MAP } from "../lib/facility-icon-map";
import { Wifi, ShieldCheck, Tent } from "lucide-react";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");
const src = read("components/ai-chat/AiChatDetailCard.tsx");

describe("[unit] getFacilityIcon — real lookup, not a smoke test", () => {
  it("normal: returns the mapped icon for a known code", () => {
    expect(getFacilityIcon("WIFI")).toBe(Wifi);
    expect(getFacilityIcon("TENT")).toBe(Tent);
  });

  it("error/validation: falls back to ShieldCheck for an unknown code", () => {
    expect(getFacilityIcon("NOT_A_REAL_CODE")).toBe(ShieldCheck);
  });

  it("null/empty: falls back to ShieldCheck for an empty string", () => {
    expect(getFacilityIcon("")).toBe(ShieldCheck);
  });

  it("boundary: the map has no entry that itself resolves to undefined", () => {
    expect(Object.values(FACILITY_ICON_MAP).every((icon) => typeof icon === "object")).toBe(true);
  });
});

describe("[structural] section order matches the owner-approved wireframe (decision weight)", () => {
  const order = [
    "section--ai-chat-detail-stats",
    "section--ai-chat-detail-availability",
    "section--ai-chat-detail-price",
    "section--ai-chat-detail-amenities",
    "section--ai-chat-detail-reviews",
    "section--ai-chat-detail-travel",
    "section--ai-chat-detail-about",
    "section--ai-chat-detail-cancellation",
  ];

  it("[normal] every section testid is present exactly once", () => {
    // DetailSection-based sections carry `testId="..."` (a JSX prop, spread
    // onto `data-testid={testId}` inside the shared component); the stat
    // row is a literal `data-testid="..."` — either form, quoted once each.
    for (const id of order) {
      expect(src.match(new RegExp(`"${id}"`, "g"))?.length, id).toBe(1);
    }
  });

  it("[normal] sections appear in ascending source order (availability -> price -> amenities -> reviews -> travel -> about -> cancellation, cancellation last)", () => {
    const indices = order.map((id) => src.indexOf(`"${id}"`));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i], `${order[i]} should come after ${order[i - 1]}`).toBeGreaterThan(indices[i - 1]);
    }
    // cancellation is bottom-most (owner directive)
    expect(indices[indices.length - 1]).toBe(Math.max(...indices));
  });
});

describe("[unit] verified badge — conditional on the async detail.isVerified, never on the instant card", () => {
  it("renders only when detail.isVerified is true", () => {
    expect(src).toContain("detail?.isVerified &&");
    expect(src).toContain('data-testid="badge--ai-chat-detail-verified"');
  });

  it("uses the real t.aiChat.detail.verifiedBadge copy, not a hardcoded string", () => {
    expect(src).toContain("{t.aiChat.detail.verifiedBadge}");
  });
});

describe("[unit] weekendAvailability rendering — number vs เต็มแล้ว vs no-number (remaining===null)", () => {
  it("[normal] shows the live remaining count via t.aiChat.card.remaining when remaining !== null", () => {
    expect(src).toContain("entry.remaining !== null");
    expect(src).toContain('t.aiChat.card.remaining.replace("{count}", String(entry.remaining))');
  });

  it("[boundary] treats blockedByHost OR remaining===0 as fully booked (never a fabricated number)", () => {
    expect(src).toContain("entry.blockedByHost || entry.remaining === 0");
    expect(src).toContain("t.booking.fullyBooked");
  });

  it("[null/empty] shows no number (openNoCap copy) when remaining is null and not blocked", () => {
    expect(src).toContain("t.aiChat.detail.openNoCap");
  });

  it("[structural] never shows a tent count as the remaining guest figure", () => {
    expect(src).not.toMatch(/maxTentsPerDay[^\n]*remaining/);
  });

  it("th.aiChat.detail.openNoCap is verbatim", () => {
    const th = translations.th.aiChat as { detail: Record<string, string> };
    expect(th.detail.openNoCap).toBe("มีที่ว่าง");
  });
});

describe("[unit] price + extraFee wiring — atomic real fields, never a merged string", () => {
  it("main price line reads detail.price.low / detail.price.isFree", () => {
    expect(src).toContain("detail.price.isFree");
    expect(src).toContain("detail.price.low != null");
    expect(src).toContain("THB_FORMAT.format(detail.price.low)");
  });

  it("[boundary] the whole price section hides when there is no low price and it is not free", () => {
    expect(src).toContain("{(detail.price.isFree || detail.price.low != null) && (");
  });

  it("extra fee row wires extraFeeAmount + extraFeeLabel (falls back to a generic label) + the one-time note", () => {
    expect(src).toContain("detail.price.extraFeeAmount != null && detail.price.extraFeeAmount > 0");
    expect(src).toContain("detail.price.extraFeeLabel || t.aiChat.detail.extraFeeGeneric");
    expect(src).toContain("t.aiChat.detail.extraFeeOneTime");
  });

  it("feeInfo (host free-text fee note) renders only when present", () => {
    expect(src).toContain("{detail.price.feeInfo && (");
  });
});

describe("[unit] empty-state — no reviews / empty description hide their content, not the section", () => {
  it("no reviews: reviewSummary.hasReviews gates the noReviews copy", () => {
    expect(src).toContain("detail.reviewSummary.hasReviews ?");
    expect(src).toContain("{t.aiChat.card.noReviews}");
  });

  it("th.aiChat.card.noReviews is verbatim", () => {
    expect((translations.th.aiChat as { card: { noReviews: string } }).card.noReviews).toBe("ยังไม่มีรีวิว");
  });

  it("empty description: the ENTIRE about section is absent (not just the paragraph)", () => {
    expect(src).toContain("{detail.description && detail.description.trim().length > 0 && (");
    // the guard wraps the whole <DetailSection ...> element, not just its child paragraph
    const guardIdx = src.indexOf("{detail.description && detail.description.trim().length > 0 && (");
    const afterGuard = src.slice(guardIdx, guardIdx + 200);
    expect(afterGuard).toContain("<DetailSection");
  });
});

describe("[unit] cancellation policy — bottom-most, always rendered via the shared resolver (never inferred)", () => {
  it("reuses resolveCancellationPolicyCopy + the campground.cancellationPolicy catalog (no duplicated copy)", () => {
    expect(src).toContain("resolveCancellationPolicyCopy(detail.cancellationPolicy, t.campground.cancellationPolicy)");
  });

  it("th.campground.cancellationPolicy.notSet is verbatim (null policy never fabricated)", () => {
    const th = translations.th.campground as { cancellationPolicy: { notSet: string } };
    expect(th.cancellationPolicy.notSet).toBe("ยังไม่ระบุนโยบายการยกเลิก");
  });
});

describe("[unit] CAM-451: in-flow push pane (SUPERSEDES CAM-450's floating-card + scrim geometry)", () => {
  it("no more absolute/floating inset positioning or a scrim on this component (the push track in AiChatPanel.tsx now owns on/off-screen motion)", () => {
    expect(src).not.toContain("absolute inset-0 z-20");
    expect(src).not.toContain('data-testid="scrim--ai-chat-detail"');
    expect(src).not.toContain("bg-background/70 backdrop-blur-sm");
    expect(src).not.toContain("inset-x-2 bottom-2 top-16");
  });

  it("renders as an in-flow h-full w-full column (fills whatever pane the push track gives it)", () => {
    expect(src).toContain('data-testid="dialog--ai-chat-detail"');
    expect(src).toContain("flex h-full min-h-0 w-full flex-col overflow-hidden rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl");
  });

  it("rounded-3xl on all corners unconditionally (no mobile-only rounded-t-3xl exception)", () => {
    expect(src).toContain("rounded-3xl border border-ai-tint bg-ai-surface shadow-ai-glow backdrop-blur-xl");
    expect(src).not.toContain("rounded-t-3xl");
  });

  it("token-only: no stray hex or px literal introduced", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(src).not.toMatch(/\[\d+px\]/);
  });
});

describe("[unit] amenities grouped by MasterData group (Terrain/Access type enrich the hero; Activity gets its own heading)", () => {
  it("facility grid excludes Activity/Terrain/Access type; Activity renders as its own labeled group", () => {
    expect(src).toContain(
      'detail?.amenities.filter((a) => a.group !== "Activity" && a.group !== "Terrain" && a.group !== "Access type")'
    );
    expect(src).toContain('detail?.amenities.filter((a) => a.group === "Activity")');
    expect(src).toContain("{t.aiChat.detail.activitiesHeading}");
  });

  it("each facility/activity row uses the shared getFacilityIcon lookup (icon-per-fact)", () => {
    expect(src).toContain("import { getFacilityIcon } from \"@/lib/facility-icon-map\"");
    expect(src.match(/getFacilityIcon\(a\.code\)/g)?.length).toBe(2);
  });
});

describe("i18n — new aiChat.detail.* keys are verbatim TH, non-empty EN, no em-dash", () => {
  const th = translations.th.aiChat as { detail: Record<string, string> };
  const en = translations.en.aiChat as { detail: Record<string, string> };
  const newKeys = [
    "verifiedBadge",
    "statCapacityLabel",
    "statCapacityTentsLabel",
    "openNoCap",
    "extraFeeOneTime",
    "extraFeeGeneric",
    "priceHeading",
    "activitiesHeading",
    "travelHeading",
    "distanceApprox",
  ];

  it("every new key exists in both locales with a non-empty string", () => {
    for (const key of newKeys) {
      expect(typeof th.detail[key], `th.aiChat.detail.${key}`).toBe("string");
      expect(th.detail[key].length, `th.aiChat.detail.${key}`).toBeGreaterThan(0);
      expect(typeof en.detail[key], `en.aiChat.detail.${key}`).toBe("string");
      expect(en.detail[key].length, `en.aiChat.detail.${key}`).toBeGreaterThan(0);
    }
  });

  it("no em-dash separator in any new key's TH or EN copy", () => {
    for (const key of newKeys) {
      expect(th.detail[key], `th.${key}`).not.toContain("—");
      expect(en.detail[key], `en.${key}`).not.toContain("—");
    }
  });

  it("th.aiChat.detail.travelHeading is verbatim", () => {
    expect(th.detail.travelHeading).toBe("การเดินทางและข้อควรรู้");
  });

  it("th.aiChat.detail.distanceApprox keeps the {count} placeholder verbatim", () => {
    expect(th.detail.distanceApprox).toBe("~{count} กม. จาก กทม. (โดยประมาณ)");
  });
});

describe("Zero debug/demo UI (quality bar)", () => {
  it("no console.log / JSON.stringify dump in the redesigned component", () => {
    expect(src).not.toContain("console.log");
    expect(src).not.toContain("JSON.stringify");
  });
});
