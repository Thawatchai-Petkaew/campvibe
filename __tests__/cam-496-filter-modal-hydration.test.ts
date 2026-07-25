// @vitest-environment jsdom
/**
 * cam-496-filter-modal-hydration.test.ts — CAM-496
 *
 * Scoped to jsdom via the top-of-file pragma ONLY for this file (repo default
 * vitest environment stays `node`, see vitest.config.ts) — same pattern as
 * __tests__/status-map-shell-renderer-swap.test.ts.
 *
 * Bug (CAM-491 deferred / diagnosed in CAM-496): FilterModal's "initialize
 * from URL" effect was entirely commented out, so `selectedFilters` /
 * `priceRange` always started EMPTY when the modal opened. Because
 * handleShowCampgrounds DELETES any URL param whose section is empty
 * (setArrayParam), reopening the modal (with existing terrain=/activities=
 * params already in the URL from a prior apply) and pressing "Show
 * Campgrounds" WIPED those pre-existing filters.
 *
 * Fix: a hydration effect (gated on `isOpen`, never on selectedFilters/
 * priceRange — no infinite loop) that parses the CURRENT URL on open using
 * the exact same param<->section mapping handleShowCampgrounds writes:
 * terrain/activities/access/facilities (CSV -> arrays), type, min/max (->
 * priceRange).
 *
 * Coverage:
 *   AC-1  opening the modal with terrain=/activities= in the URL marks the
 *         matching chips selected (aria-pressed) and hydrates price range
 *   AC-2  [regression, the exact CAM-496 bug] opening the modal with
 *         pre-existing terrain=/activities= params, then pressing
 *         "Show Campgrounds" with NO edits, preserves those params in the
 *         pushed URL instead of deleting them
 *   AC-3  a `facilities` CSV spanning two different facility sub-sections
 *         (Internal facility / External facility) hydrates each checkbox
 *         into its own owning section (codes are globally unique)
 *   EC-1  no relevant params in the URL -> selectedFilters stays empty, no
 *         crash, "Clear all" style start state
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FilterModal } from "@/components/FilterModal";

// ── next/navigation mock — a mutable `currentParams` the test controls ──────
const pushMock = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentParams,
}));

// ── server actions mock (both are "use server" + hit prisma directly) ──────
vi.mock("@/app/actions/getFilterOptions", () => ({
  getFilterOptions: vi.fn(async () => ({
    Terrain: [
      { code: "RIVE", group: "Terrain", icon: "Waves", nameEn: "River", nameTh: "แม่น้ำ" },
      { code: "MTNS", group: "Terrain", icon: "Mountain", nameEn: "Mountain", nameTh: "ภูเขา" },
    ],
    Activity: [
      { code: "SWIM", group: "Activity", icon: "Waves", nameEn: "Swim", nameTh: "ว่ายน้ำ" },
    ],
    "Internal facility": [
      { code: "IFCA", group: "Internal facility", icon: "Wifi", nameEn: "Wifi", nameTh: "ไวไฟ" },
    ],
    "External facility": [
      { code: "EFCA", group: "External facility", icon: "Car", nameEn: "Parking", nameTh: "ที่จอดรถ" },
    ],
    // CAM-515 (S3) — the FIRST new MasterData group (renders via the SAME
    // default checkbox-grid branch as Internal/External facility above).
    "Annotated features": [
      { code: "ALCO", group: "Annotated features", icon: "Wine", nameEn: "Alcohol allowed", nameTh: "ดื่มแอลกอฮอล์ได้" },
    ],
    // CAM-516 (S4) — the SECOND new MasterData group (same default branch).
    "Camper style": [
      { code: "CHIC", group: "Camper style", icon: "Sparkles", nameEn: "Chic", nameTh: "สบาย (สายคุณหนู)" },
    ],
  })),
}));

const countMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 5);
vi.mock("@/app/actions/getCampSiteCount", () => ({
  getCampSiteCount: (...args: unknown[]) => countMock(...args),
}));

const renderModal = () =>
  render(React.createElement(LanguageProvider, null, React.createElement(FilterModal)));

const openModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: /filter/i }));
  // wait for filter option sections to hydrate into the DOM
  await screen.findByText(/Terrain/i);
};

const waitForApplyEnabled = async () => {
  await waitFor(() => {
    const btn = screen.getByRole("button", { name: /show|calculating/i }) as HTMLButtonElement;
    expect(btn.textContent).not.toMatch(/calculating/i);
    expect(btn.disabled).toBe(false);
  });
};

beforeEach(() => {
  pushMock.mockClear();
  countMock.mockClear();
});

afterEach(() => {
  cleanup();
  currentParams = new URLSearchParams();
});

describe("CAM-496 AC-1 — hydrates selectedFilters + priceRange from the URL on open", () => {
  it("marks the matching Terrain / Activity chips selected and fills price range", async () => {
    currentParams = new URLSearchParams("terrain=RIVE&activities=SWIM&min=500&max=2000");
    renderModal();
    await openModal();

    const riverChip = await screen.findByTestId("filter-chip--card-RIVE");
    expect(riverChip.getAttribute("aria-pressed")).toBe("true");

    const mtnsChip = screen.getByTestId("filter-chip--card-MTNS");
    expect(mtnsChip.getAttribute("aria-pressed")).toBe("false");

    const swimChip = screen.getByTestId("filter-chip--pill-SWIM");
    expect(swimChip.getAttribute("aria-pressed")).toBe("true");

    expect((screen.getByLabelText(/min price/i) as HTMLInputElement).value).toBe("500");
    expect((screen.getByLabelText(/max price/i) as HTMLInputElement).value).toBe("2000");
  });
});

describe("CAM-496 AC-2 — regression: reopen + apply no longer wipes pre-existing filters", () => {
  it("pressing 'Show Campgrounds' with no edits preserves terrain/activities already in the URL", async () => {
    currentParams = new URLSearchParams("terrain=RIVE&activities=SWIM");
    renderModal();
    await openModal();

    // sanity: hydration actually happened before we apply
    (await screen.findByTestId("filter-chip--card-RIVE"));
    expect(screen.getByTestId("filter-chip--card-RIVE").getAttribute("aria-pressed")).toBe("true");

    await waitForApplyEnabled();
    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0][0] as string;
    const pushedParams = new URLSearchParams(pushedUrl.split("?")[1] ?? "");

    expect(pushedParams.get("terrain")).toBe("RIVE");
    expect(pushedParams.get("activities")).toBe("SWIM");
  });
});

describe("CAM-496 AC-3 — facilities CSV hydrates into its owning sub-section", () => {
  it("distributes facilities=IFCA,EFCA into Internal facility and External facility respectively", async () => {
    currentParams = new URLSearchParams("facilities=IFCA,EFCA");
    renderModal();
    await openModal();

    const internalCheckbox = await screen.findByRole("checkbox", { name: /wifi/i });
    const externalCheckbox = screen.getByRole("checkbox", { name: /parking/i });

    expect(internalCheckbox.getAttribute("aria-checked")).toBe("true");
    expect(externalCheckbox.getAttribute("aria-checked")).toBe("true");
  });
});

describe("CAM-515 (S3) — Annotated features: hydrates from the URL + apply preserves it (same CAM-496 AC-1/AC-2 wiring, new group)", () => {
  it("opening the modal with annotatedFeatures=ALCO in the URL marks the matching checkbox checked", async () => {
    currentParams = new URLSearchParams("annotatedFeatures=ALCO");
    renderModal();
    await openModal();

    const alcoCheckbox = await screen.findByRole("checkbox", { name: /alcohol allowed/i });
    expect(alcoCheckbox.getAttribute("aria-checked")).toBe("true");
  });

  it("pressing 'Show Campgrounds' with no edits preserves annotatedFeatures already in the URL (the exact CAM-496 regression class, proven for the new group)", async () => {
    currentParams = new URLSearchParams("annotatedFeatures=ALCO");
    renderModal();
    await openModal();

    // sanity: hydration actually happened before we apply
    await screen.findByRole("checkbox", { name: /alcohol allowed/i });
    expect(screen.getByRole("checkbox", { name: /alcohol allowed/i }).getAttribute("aria-checked")).toBe("true");

    await waitForApplyEnabled();
    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0][0] as string;
    const pushedParams = new URLSearchParams(pushedUrl.split("?")[1] ?? "");
    expect(pushedParams.get("annotatedFeatures")).toBe("ALCO");
  });
});

describe("CAM-516 (S4) — Camper style: hydrates from the URL + apply preserves it (same CAM-496 AC-1/AC-2 wiring, new group)", () => {
  it("opening the modal with camperStyle=CHIC in the URL marks the matching checkbox checked", async () => {
    currentParams = new URLSearchParams("camperStyle=CHIC");
    renderModal();
    await openModal();

    const chicCheckbox = await screen.findByRole("checkbox", { name: /chic/i });
    expect(chicCheckbox.getAttribute("aria-checked")).toBe("true");
  });

  it("pressing 'Show Campgrounds' with no edits preserves camperStyle already in the URL (the exact CAM-496 regression class, proven for the new group)", async () => {
    currentParams = new URLSearchParams("camperStyle=CHIC");
    renderModal();
    await openModal();

    // sanity: hydration actually happened before we apply
    await screen.findByRole("checkbox", { name: /chic/i });
    expect(screen.getByRole("checkbox", { name: /chic/i }).getAttribute("aria-checked")).toBe("true");

    await waitForApplyEnabled();
    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0][0] as string;
    const pushedParams = new URLSearchParams(pushedUrl.split("?")[1] ?? "");
    expect(pushedParams.get("camperStyle")).toBe("CHIC");
  });
});

describe("CAM-496 EC-1 — no relevant URL params: modal opens with a clean slate", () => {
  it("no chip is selected and price fields are empty when the URL carries no filter params", async () => {
    currentParams = new URLSearchParams();
    renderModal();
    await openModal();

    const riverChip = await screen.findByTestId("filter-chip--card-RIVE");
    expect(riverChip.getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByLabelText(/min price/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/max price/i) as HTMLInputElement).value).toBe("");
  });
});
