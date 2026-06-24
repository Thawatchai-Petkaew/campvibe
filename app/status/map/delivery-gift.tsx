"use client";

/**
 * DeliveryGift — CAM-174 (revert DS → scene glass)
 * Amber glass gift button above the campfire opens a "ส่งมอบสำเร็จ" modal.
 * Mounted inside .scout-layer; modal uses createPortal to document.body.
 *
 * CAM-174 changes (reverts CAM-173 DS approach):
 *   - Modal surface: scene-glass CSS (.delivery-modal-box / .delivery-modal-overlay)
 *     mirrors hud-modal-box / hud-modal-backdrop exact rgba values
 *   - Each delivery: .delivery-card (mirrors hud-kc / hud-card glass surface)
 *     CheckCircle2 (#5BE9B0) + decoded title + epic chip (.delivery-epic-chip mirrors
 *     hud-card-role) + Thai date (mono, faint)
 *   - Removed: Card/CardContent/Badge/Button DS imports (CAM-173)
 *   - Kept: decodeHtmlEntities(item.title), createPortal, useFocusTrap/Esc/return-focus,
 *     markSeen on close, gift button + .gift-indicator CSS, all testids
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, X } from "lucide-react";

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
    <>
      {/* Overlay / backdrop — mirrors .hud-modal-backdrop */}
      <div
        className="delivery-modal-overlay"
        aria-hidden="true"
        onClick={handleClose}
      />

      {/* Modal positioner — mirrors .hud-modal */}
      <div className="delivery-modal-positioner">
        {/* Modal box — mirrors .hud-modal-box glass surface */}
        <div
          ref={modalRef}
          className="delivery-modal-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalId}
          data-testid="modal--map-delivery"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — Gift icon (amber) + title + close button */}
          <div className="delivery-modal-head">
            <Gift
              size={20}
              aria-hidden="true"
              style={{ color: "var(--amber)", flexShrink: 0 }}
            />
            <span
              id={modalId}
              className="delivery-modal-title"
            >
              {COPY.modalTitle}
            </span>
            <button
              type="button"
              className="delivery-modal-close"
              aria-label={COPY.closeAriaLabel}
              onClick={handleClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Scroll body */}
          <div className="delivery-modal-body">
            {!hasItems ? (
              <div className="delivery-empty" role="status">
                {COPY.emptyState}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="delivery-card">
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                    style={{ color: "#5BE9B0", flexShrink: 0, marginTop: 1 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="delivery-card-title">
                      {decodeHtmlEntities(item.title)}
                    </p>
                    <div className="delivery-card-meta">
                      <span className="delivery-epic-chip">{item.epic}</span>
                      {item.completedAt && (
                        <span className="delivery-card-date">
                          {formatThaiDate(item.completedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="delivery-modal-footer">
            <button
              type="button"
              className="delivery-close-btn"
              onClick={handleClose}
            >
              {COPY.closeBtn}
            </button>
          </div>
        </div>
      </div>
    </>,
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
// CAM-174: .delivery-modal* and .delivery-card* now use scene-glass (hud-modal-box / hud-kc values)

export const DELIVERY_GIFT_CSS = `
/* ── CAM-171: Gift indicator (campfire button) — unchanged in CAM-174 ── */

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

/* ── CAM-174: Delivery modal — scene glass (mirrors hud-modal-backdrop + hud-modal-box) ── */

/* Overlay — mirrors .hud-modal-backdrop */
.delivery-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(4,8,22,.72);
}

/* Modal positioner — mirrors .hud-modal */
.delivery-modal-positioner {
  position: fixed;
  inset: 0;
  z-index: 61;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 16px;
}

/* Modal box — mirrors .hud-modal-box exact values */
.delivery-modal-box {
  width: min(520px, 96vw);
  max-height: min(600px, calc(100svh - 4rem));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: rgba(11,30,24,.68);
  backdrop-filter: saturate(195%) blur(34px);
  -webkit-backdrop-filter: saturate(195%) blur(34px);
  border: 1px solid rgba(150,240,195,.13);
  border-radius: 22px;
  box-shadow: 0 32px 72px rgba(0,0,0,.64), inset 0 1px 0 rgba(200,255,232,.14);
  padding: 24px 26px 28px;
  color: rgba(223,234,245,.9);
}

/* Modal header */
.delivery-modal-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  flex-shrink: 0;
}

/* Modal title — mirrors .hud-modal-title */
.delivery-modal-title {
  flex: 1;
  font-family: 'Outfit','Anuphan',system-ui,sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: #F1F6FB;
  line-height: 1.25;
}

/* Close button — mirrors .hud-modal-close */
.delivery-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 50%;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.14);
  color: rgba(223,234,245,.7);
  font-size: 18px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms;
}
.delivery-modal-close:hover { background: rgba(255,255,255,.14); }
.delivery-modal-close:focus-visible {
  outline: 2px solid rgba(91,233,176,.8);
  outline-offset: 2px;
}

/* Scroll body */
.delivery-modal-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 0 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(91,233,176,.18) transparent;
}
.delivery-modal-body::-webkit-scrollbar { width: 4px; }
.delivery-modal-body::-webkit-scrollbar-thumb {
  background: rgba(91,233,176,.2);
  border-radius: 4px;
}

/* Delivery card — mirrors .hud-kc / .hud-card surface */
.delivery-card {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  background: rgba(91,233,176,.05);
  border: 1px solid rgba(150,240,195,.13);
  border-radius: 12px;
  padding: 10px 11px;
  transition: background 120ms, border-color 120ms;
}
.delivery-card:hover {
  background: rgba(91,233,176,.09);
  border-color: rgba(150,240,195,.22);
}

/* Card title — mirrors .hud-card-title / .hud-kt */
.delivery-card-title {
  font-size: 12.5px;
  color: rgba(223,234,245,.88);
  line-height: 1.35;
  margin: 0 0 5px;
}

/* Card meta row */
.delivery-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* Epic chip — mirrors .hud-card-role */
.delivery-epic-chip {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(91,233,176,.08);
  border: 1px solid rgba(150,240,195,.15);
  color: rgba(223,234,245,.55);
}

/* Date — mirrors .hud-card-id / .hud-bl-id */
.delivery-card-date {
  font-family: var(--mono);
  font-size: 9.5px;
  color: rgba(223,234,245,.45);
}

/* Empty state — mirrors .hud-empty */
.delivery-empty {
  font-size: 11.5px;
  color: rgba(223,234,245,.38);
  text-align: center;
  padding: 20px 0;
}

/* Footer */
.delivery-modal-footer {
  margin-top: 14px;
  border-top: 1px solid rgba(150,240,195,.09);
  padding-top: 14px;
  flex-shrink: 0;
}

/* Footer close button — mirrors .hud-sb-seeall */
.delivery-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 12px;
  width: 100%;
  min-height: 44px;
  background: rgba(91,233,176,.08);
  border: 1px solid rgba(91,233,176,.15);
  font-size: 12px;
  font-weight: 700;
  color: rgba(91,233,176,.75);
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
}
.delivery-close-btn:hover {
  background: rgba(91,233,176,.15);
  border-color: rgba(91,233,176,.30);
}
.delivery-close-btn:focus-visible {
  outline: 2px solid rgba(91,233,176,.8);
  outline-offset: 2px;
}

/* Entry animations */
@media (prefers-reduced-motion: no-preference) {
  .delivery-modal-overlay {
    animation: deliveryFadeIn 200ms ease both;
  }
  .delivery-modal-box {
    animation: deliveryModalIn 200ms cubic-bezier(0.23,1,0.32,1) both;
  }
  @keyframes deliveryFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes deliveryModalIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
}
`;
