// @vitest-environment jsdom
/**
 * cam-496-filter-modal-type-hydration.test.ts — CAM-496 (QA gap-fill)
 *
 * cam-496-filter-modal-hydration.test.ts (delivered with the fix) covers
 * terrain/activities/access/facilities/min/max hydration but never exercises
 * the `type` -> 'Campground type' branch of the same hydration effect
 * (components/FilterModal.tsx lines ~159-162), even though that branch is
 * part of the identical mapping handleShowCampgrounds writes (line ~205-206)
 * and is therefore just as capable of silently regressing (e.g. reopening
 * the modal with type=CAGD already in the URL and pressing "Show
 * Campgrounds" with no edits would wipe it, the same CAM-496 bug class).
 *
 * This file closes that coverage bucket only — same mock shape as the
 * sibling file, with "Campground type" added to the mocked filter options
 * so the chip actually renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FilterModal } from "@/components/FilterModal";

const pushMock = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentParams,
}));

vi.mock("@/app/actions/getFilterOptions", () => ({
  getFilterOptions: vi.fn(async () => ({
    "Campground type": [
      { code: "CAGD", group: "Campground type", icon: "Tent", nameEn: "Campground", nameTh: "ลานกางกับพื้น" },
      { code: "CACP", group: "Campground type", icon: "Car", nameEn: "Car camp", nameTh: "รถเต็นท์" },
    ],
    Terrain: [
      { code: "RIVE", group: "Terrain", icon: "Waves", nameEn: "River", nameTh: "แม่น้ำ" },
    ],
  })),
}));

const countMock = vi.fn<(...args: unknown[]) => Promise<number>>(async () => 3);
vi.mock("@/app/actions/getCampSiteCount", () => ({
  getCampSiteCount: (...args: unknown[]) => countMock(...args),
}));

const renderModal = () =>
  render(React.createElement(LanguageProvider, null, React.createElement(FilterModal)));

const openModal = async () => {
  fireEvent.click(screen.getByRole("button", { name: /filter/i }));
  await screen.findByText(/Campground type/i);
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

describe("CAM-496 gap-fill — hydrates `type` param into 'Campground type' selection", () => {
  it("marks the matching Campground-type chip selected when type= is in the URL", async () => {
    currentParams = new URLSearchParams("type=CAGD");
    renderModal();
    await openModal();

    const cagdChip = await screen.findByTestId("filter-chip--card-CAGD");
    expect(cagdChip.getAttribute("aria-pressed")).toBe("true");

    const cacpChip = screen.getByTestId("filter-chip--card-CACP");
    expect(cacpChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("does NOT hydrate a selection when type=ALL (matches the writer's ALL sentinel)", async () => {
    currentParams = new URLSearchParams("type=ALL");
    renderModal();
    await openModal();

    const cagdChip = await screen.findByTestId("filter-chip--card-CAGD");
    expect(cagdChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("regression: reopen + apply with no edits preserves a pre-existing type= param", async () => {
    currentParams = new URLSearchParams("type=CAGD");
    renderModal();
    await openModal();

    expect(
      (await screen.findByTestId("filter-chip--card-CAGD")).getAttribute("aria-pressed")
    ).toBe("true");

    await waitForApplyEnabled();
    fireEvent.click(screen.getByRole("button", { name: /show/i }));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0][0] as string;
    const pushedParams = new URLSearchParams(pushedUrl.split("?")[1] ?? "");
    expect(pushedParams.get("type")).toBe("CAGD");
  });
});
