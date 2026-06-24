"use client";

/**
 * DeliveryGift — CAM-173 (polish: design-system modal + card list + entity decode)
 * Amber glass gift button above the campfire opens a "ส่งมอบสำเร็จ" modal.
 * Mounted inside .scout-layer; modal uses createPortal to document.body.
 *
 * CAM-173 changes:
 *   - Modal surface: app design-system tokens (bg-popover, rounded-3xl, shadow-2xl, ring-1)
 *   - Each delivery: <Card size="sm"> with CheckCircle2 + decoded title + Badge + Thai date
 *   - decodeHtmlEntities() applied to item.title before render
 *   - Removed dark-green glass CSS from DELIVERY_GIFT_CSS (gift button CSS unchanged)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { decodeHtmlEntities } from "@/lib/html-utils";
import {
  DELIVERY_SEEN_KEY,
  hasInitialized,
  markSeen,
  preSeed,
  readSeenIds,
  selectDeliveries,
  selectUnseen,
  type DeliveryItem,
} from "@/lib/map-delivery";
import type { MapEpicItem } from "./campsite-scene";

// ── i18n (scene does not use useLanguage; follow the same approach) ──────────
// Keys live in locales/translations.json; we pull the TH copy directly here
// since the map scene is always rendered in TH context for the platform owner.

const COPY = {
  indicatorLabel: (count: number) =>
    `ดูงานที่ส่งมอบสำเร็จ ${count} รายการ`,
  modalTitle: "ส่งมอบสำเร็จ",
  closeBtn: "ปิด",
  closeAriaLabel: "ปิด modal ส่งมอบสำเร็จ",
  emptyState: "ไม่มีข้อมูลงานที่ส่งมอบ",
  epicLabel: "Epic",
  dateLabel: "ส่งมอบเมื่อ",
} as const;

// ── Keyboard focus trap ──────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const getFocusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));

    // Focus the first focusable element (close button) immediately
    const focusables = getFocusables();
    (focusables[0] ?? container).focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const els = getFocusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [isOpen, onClose, containerRef, triggerRef]);
}

// ── Thai Buddhist era date formatter ─────────────────────────────────────────

function formatThaiDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// ── DeliveryModal ─────────────────────────────────────────────────────────────

interface DeliveryModalProps {
  items: DeliveryItem[];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

function DeliveryModal({ items, triggerRef, onClose }: DeliveryModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalId = "delivery-modal-title";

  useFocusTrap(
    modalRef as React.RefObject<HTMLElement | null>,
    triggerRef as React.RefObject<HTMLElement | null>,
    true,
    onClose
  );

  const hasItems = items.length > 0;

  const handleClose = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return createPortal(
    /* Overlay — app token backdrop (same as DialogOverlay) */
    <div
      ref={overlayRef}
      className="delivery-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/15 supports-[backdrop-filter]:backdrop-blur-sm"
      aria-hidden="true"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      {/* Modal box — app design-system surface */}
      <div
        ref={modalRef}
        className="delivery-modal-box flex w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5 sm:max-w-md"
        style={{ maxHeight: "min(600px, calc(100svh - 4rem))" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalId}
        data-testid="modal--map-delivery"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-6 py-4">
          <Gift
            size={20}
            aria-hidden="true"
            className="shrink-0 text-warning"
          />
          <span
            id={modalId}
            className="flex-1 text-base font-semibold text-foreground"
          >
            {COPY.modalTitle}
          </span>
          {/* Close [X] — size="icon" = h-11 w-11 = 44×44px tap target */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={COPY.closeAriaLabel}
            onClick={handleClose}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        {/* Body — scroll area */}
        <div
          className="flex-1 space-y-3 overflow-y-auto px-6 py-4"
          style={{ scrollbarWidth: "thin" }}
        >
          {!hasItems ? (
            <div
              className="py-6 text-center text-sm text-muted-foreground"
              role="status"
            >
              {COPY.emptyState}
            </div>
          ) : (
            items.map((item) => (
              <Card
                key={item.id}
                size="sm"
                className="transition-colors duration-[120ms] hover:bg-muted/50"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <CheckCircle2
                    size={20}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-success"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {decodeHtmlEntities(item.title)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="muted" aria-hidden="true" className="shrink-0">
                        {item.epic}
                      </Badge>
                      {item.completedAt && (
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatThaiDate(item.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleClose}
          >
            {COPY.closeBtn}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── DeliveryGift (main export) ─────────────────────────────────────────────

interface DeliveryGiftProps {
  epics: MapEpicItem[];
}

// Helper to compute unseen without triggering extra renders
function computeUnseenItems(epics: MapEpicItem[]): DeliveryItem[] {
  if (!hasInitialized()) {
    const allDoneIds = epics
      .flatMap((e) => e.stories)
      .filter((s) => s.statusType === "completed")
      .map((s) => s.id);
    preSeed(allDoneIds);
    return [];
  }
  const seenIds = readSeenIds();
  const deliveries = selectDeliveries(epics);
  return selectUnseen(deliveries, seenIds);
}

export default function DeliveryGift({ epics }: DeliveryGiftProps) {
  const [unseen, setUnseen] = useState<DeliveryItem[]>(() =>
    computeUnseenItems(epics)
  );
  const [modalOpen, setModalOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Re-derive unseen when epics prop changes (SSE reconcile brings new Done stories)
  useEffect(() => {
    setUnseen(computeUnseenItems(epics));
  }, [epics]);

  // Listen for cross-tab storage changes (another tab marked stories seen)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== DELIVERY_SEEN_KEY) return;
      setUnseen(computeUnseenItems(epics));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [epics]);

  const handleOpen = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    const ids = unseen.map((d) => d.id);
    markSeen(ids);
    setUnseen([]);
    setModalOpen(false);
  }, [unseen]);

  const unseenCount = unseen.length;
  const badgeLabel = unseenCount > 9 ? "9+" : String(unseenCount);

  if (unseenCount === 0) return null;

  return (
    <>
      {/* Gift indicator button — absolute positioned above campfire */}
      <div
        className="delivery-gift-wrapper"
        style={{ pointerEvents: "none" }}
        aria-hidden="false"
      >
        <button
          ref={btnRef}
          type="button"
          className="gift-indicator gift-glow"
          aria-label={COPY.indicatorLabel(unseenCount)}
          onClick={handleOpen}
          data-testid="btn--map-delivery-gift"
        >
          <Gift size={20} aria-hidden="true" />
          {/* Unseen count badge */}
          <span
            className="gift-badge"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        </button>
      </div>

      {/* Modal — rendered via createPortal inside DeliveryModal */}
      {modalOpen && (
        <DeliveryModal
          items={unseen}
          triggerRef={btnRef}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// ── Scene-scoped CSS (injected into the scene's style block) ─────────────────
// KEEP: .delivery-gift-wrapper, .gift-indicator, .gift-badge (campfire gift button — unchanged)
// KEEP: entry animations for modal overlay + box (moved to Tailwind for surface; animations kept)
// REMOVED: .delivery-modal*, .delivery-story-item (replaced by Tailwind + DS components in CAM-173)

export const DELIVERY_GIFT_CSS = `
/* ── CAM-171: Gift indicator (campfire button) — unchanged in CAM-173 ── */

/* Wrapper — pointer-events off so agent routes pass through */
.delivery-gift-wrapper {
  position: absolute;
  left: 50%;
  top: 44%;
  z-index: 25;
  pointer-events: none;
}

/* Gift button — amber glass, 44×44 tap target */
.gift-indicator {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -100%);
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(11,30,24,.50);
  border: 1.5px solid rgba(255,180,84,.55);
  backdrop-filter: saturate(195%) blur(20px);
  -webkit-backdrop-filter: saturate(195%) blur(20px);
  cursor: pointer;
  color: var(--amber);
  pointer-events: auto;
  box-shadow: 0 0 10px 2px rgba(255,180,84,.35), 0 8px 22px rgba(0,0,0,.42);
  transition: background 150ms, border-color 150ms, transform 120ms;
}
.gift-indicator:hover {
  background: rgba(255,180,84,.14);
  border-color: rgba(255,180,84,.80);
  transform: translate(-50%, -100%) scale(1.08);
}
.gift-indicator:focus-visible {
  outline: 2px solid rgba(91,233,176,.8);
  outline-offset: 2px;
}
.gift-indicator:active {
  transform: translate(-50%, -100%) scale(0.94);
}

/* Unseen count badge */
.gift-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--amber);
  color: #241402;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--mono);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  pointer-events: none;
}

/* Float + glow animations (prefers-reduced-motion: no-preference only) */
@media (prefers-reduced-motion: no-preference) {
  .gift-indicator {
    animation: giftFloat 2.4s ease-in-out infinite;
  }
  .gift-glow {
    animation: giftFloat 2.4s ease-in-out infinite, giftGlow 2.4s ease-in-out infinite;
  }
  @keyframes giftFloat {
    0%, 100% { transform: translate(-50%, -100%) translateY(0); }
    50%       { transform: translate(-50%, -100%) translateY(-5px); }
  }
  @keyframes giftGlow {
    0%, 100% { box-shadow: 0 0 10px 2px rgba(255,180,84,.35), 0 8px 22px rgba(0,0,0,.42); }
    50%       { box-shadow: 0 0 20px 6px rgba(255,180,84,.60), 0 8px 22px rgba(0,0,0,.42); }
  }
}
@media (prefers-reduced-motion: reduce) {
  .gift-indicator { animation: none; }
  .gift-glow { animation: none; }
}

/* ── CAM-173: Modal entry animations (surface now uses Tailwind DS tokens) ── */
@media (prefers-reduced-motion: no-preference) {
  .delivery-modal-overlay {
    animation: deliveryFadeIn 160ms ease both;
  }
  .delivery-modal-box {
    animation: deliveryModalIn 200ms cubic-bezier(0.23,1,0.32,1) both;
  }
  @keyframes deliveryFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes deliveryModalIn {
    from { opacity: 0; transform: scale(0.92) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
}
`;
