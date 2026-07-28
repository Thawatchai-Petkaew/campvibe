// @vitest-environment jsdom
/**
 * cam-616-filter-modal-error-states.test.ts — CAM-616 (Part 4 of 4)
 *
 * FilterModal.tsx was scoped OUT of this story at first pass, then brought
 * IN by the orchestrator: getCampSiteCount/getFilterOptions now throw at
 * the source (this story's Part 3), but FilterModal — their SOLE consumer —
 * had no `.catch()` on either call. That is not a fix, it is a different
 * lie: a spinner that never resolves ("Calculating..." forever) is exactly
 * as indistinguishable from a working system as the false "0" it replaced,
 * and getFilterOptions's silent `[]` is the ORIGINAL "we don't support
 * filtering" defect, just moved one level down (confirmed by inspection
 * before this fix: no catch anywhere in the chain, so a rejection just
 * never reaches setFilterSections — the modal renders zero filter groups
 * with NO error indication, indistinguishable from "this catalog genuinely
 * has none").
 *
 * Matches the SAME pattern already used on the other seven surfaces this
 * story touched (an inline `role="alert"` banner + a retry `<Button>`
 * using `RotateCcw` + `t.common.retry`) — no ninth idiom invented.
 *
 * Render harness: `render(React.createElement(LanguageProvider, null,
 * React.createElement(FilterModal)))` — the cam-496-filter-modal-hydration
 * precedent for this exact component; `next/navigation` and both server
 * actions mocked at their module boundary (mock-only-the-boundary, qa.md §6).
 *
 * Coverage matrix per .claude/rules/qa.md:
 *   normal (both actions succeed) · error/teeth (each action rejects,
 *   modal shows a distinguishable state, never a stuck spinner or a
 *   silent empty) · concurrent/ordering (retry re-issues the SAME request
 *   and can recover) · null/empty (a genuine empty options set — the
 *   correct twin — shows no error banner)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/contexts/LanguageContext";

const pushMock = vi.fn();
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentParams,
}));

const getFilterOptionsMock = vi.fn();
vi.mock("@/app/actions/getFilterOptions", () => ({
  getFilterOptions: (...args: unknown[]) => getFilterOptionsMock(...args),
}));

const getCampSiteCountMock = vi.fn();
vi.mock("@/app/actions/getCampSiteCount", () => ({
  getCampSiteCount: (...args: unknown[]) => getCampSiteCountMock(...args),
}));

import { FilterModal } from "@/components/FilterModal";

const SAMPLE_OPTIONS = {
  Terrain: [{ code: "RIVE", group: "Terrain", icon: "Waves", nameEn: "River", nameTh: "แม่น้ำ" }],
};

function renderModal() {
  return render(React.createElement(LanguageProvider, null, React.createElement(FilterModal)));
}

async function openModal() {
  fireEvent.click(screen.getByRole("button", { name: /filter/i }));
}

beforeEach(() => {
  currentParams = new URLSearchParams();
  pushMock.mockReset();
  getFilterOptionsMock.mockReset();
  getCampSiteCountMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("FilterModal — getFilterOptions failure must not silently render zero filter groups (CAM-616)", () => {
  it("[normal] a successful load renders the real sections (sanity)", async () => {
    getFilterOptionsMock.mockResolvedValue(SAMPLE_OPTIONS);
    getCampSiteCountMock.mockResolvedValue(5);
    renderModal();
    await openModal();
    await screen.findByText("Terrain");
    expect(screen.queryByTestId("banner--filter-options-error")).toBeNull();
  });

  it("[error/teeth] a rejection renders a distinguishable error+retry — confirmed: WITHOUT this fix the modal instead shows ZERO sections with no indication anything failed (the original defect, one level down)", async () => {
    getFilterOptionsMock.mockRejectedValue(new Error("db down"));
    getCampSiteCountMock.mockResolvedValue(0);
    renderModal();
    await openModal();
    await screen.findByTestId("banner--filter-options-error");
    // Confirms the failure state is NOT the silent empty this story flagged:
    // a real error message + retry action is present, not nothing.
    expect(screen.getByTestId("btn--filter-options-retry")).toBeTruthy();
  });

  it("[concurrent/ordering] retry re-issues the request and can recover to the real sections", async () => {
    getFilterOptionsMock.mockRejectedValueOnce(new Error("db down"));
    getCampSiteCountMock.mockResolvedValue(5);
    renderModal();
    await openModal();
    await screen.findByTestId("banner--filter-options-error");

    getFilterOptionsMock.mockResolvedValueOnce(SAMPLE_OPTIONS);
    fireEvent.click(screen.getByTestId("btn--filter-options-retry"));

    await screen.findByText("Terrain");
    expect(screen.queryByTestId("banner--filter-options-error")).toBeNull();
    expect(getFilterOptionsMock).toHaveBeenCalledTimes(2);
  });

  it("[null/empty] a genuinely empty options set (no error) renders no banner and no sections — the correct twin, untouched", async () => {
    getFilterOptionsMock.mockResolvedValue({});
    getCampSiteCountMock.mockResolvedValue(0);
    renderModal();
    await openModal();
    // Give the effect a tick to resolve.
    await waitFor(() => expect(getFilterOptionsMock).toHaveBeenCalled());
    expect(screen.queryByTestId("banner--filter-options-error")).toBeNull();
  });
});

describe("FilterModal — getCampSiteCount failure must not leave the button stuck on 'Calculating...' forever (CAM-616)", () => {
  it("[normal] a successful count renders the real number (sanity)", async () => {
    getFilterOptionsMock.mockResolvedValue(SAMPLE_OPTIONS);
    getCampSiteCountMock.mockResolvedValue(12);
    renderModal();
    await openModal();
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /12/i })).toBeTruthy();
      },
      { timeout: 3000 }
    );
    expect(screen.queryByTestId("banner--filter-count-error")).toBeNull();
  });

  it("[error/teeth] a rejection renders a distinguishable error+retry — confirmed: WITHOUT this fix the button reads 'Calculating...' forever (a spinner as indistinguishable from working as the false '0' it replaced)", async () => {
    getFilterOptionsMock.mockResolvedValue(SAMPLE_OPTIONS);
    getCampSiteCountMock.mockRejectedValue(new Error("connection refused"));
    renderModal();
    await openModal();

    await waitFor(
      () => {
        expect(screen.getByTestId("banner--filter-count-error")).toBeTruthy();
      },
      { timeout: 3000 }
    );
    // The primary button must NOT be stuck on "Calculating..." — it names
    // the failure instead, and is no longer disabled by isCountLoading.
    expect(screen.queryByText(/calculating/i)).toBeNull();
    expect(screen.getByTestId("btn--filter-count-retry")).toBeTruthy();
  });

  it("[concurrent/ordering] retry re-issues the count request and can recover", async () => {
    getFilterOptionsMock.mockResolvedValue(SAMPLE_OPTIONS);
    getCampSiteCountMock.mockRejectedValueOnce(new Error("connection refused"));
    renderModal();
    await openModal();

    await waitFor(
      () => {
        expect(screen.getByTestId("banner--filter-count-error")).toBeTruthy();
      },
      { timeout: 3000 }
    );

    getCampSiteCountMock.mockResolvedValueOnce(7);
    fireEvent.click(screen.getByTestId("btn--filter-count-retry"));

    await waitFor(
      () => {
        expect(screen.queryByTestId("banner--filter-count-error")).toBeNull();
      },
      { timeout: 3000 }
    );
    expect(screen.getByRole("button", { name: /7/i })).toBeTruthy();
  });
});
