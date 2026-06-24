"use client";

/**
 * DeliveryGift — CAM-171
 * Amber glass gift button above the campfire that opens a "ส่งมอบสำเร็จ" modal.
 * Mounted inside .scout-layer; uses createPortal for the modal.
 * Follows the scene's self-contained dark palette (CSS vars, not Tailwind tokens).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Gift, X } from "lucide-react";

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

  return createPortal(
    <div
      ref={overlayRef}
      className="delivery-modal-overlay"
      aria-hidden="true"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="delivery-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalId}
        data-testid="modal--map-delivery"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="delivery-modal-header">
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
          {/* Close [X] — must be 44×44px per design Critical fix */}
          <button
            type="button"
            className="delivery-modal-close"
            aria-label={COPY.closeAriaLabel}
            onClick={() => { onClose(); triggerRef.current?.focus(); }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body — scroll area */}
        <div className="delivery-modal-body">
          {!hasItems ? (
            <div
              className="delivery-modal-empty"
              role="status"
            >
              {COPY.emptyState}
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="delivery-story-item">
                <CheckCircle2
                  size={16}
                  aria-hidden="true"
                  className="delivery-story-icon"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="delivery-story-title">{item.title}</div>
                  <div className="delivery-story-meta">
                    <span>{COPY.epicLabel}: {item.epic}</span>
                    {item.completedAt && (
                      <>
                        {" · "}
                        <span className="tabular-nums">
                          {COPY.dateLabel} {formatThaiDate(item.completedAt)}
                        </span>
                      </>
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
            className="delivery-modal-footer-btn"
            onClick={() => { onClose(); triggerRef.current?.focus(); }}
          >
            {COPY.closeBtn}
          </button>
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
// These rules MUST be appended to SCENE_CSS in campsite-scene.tsx.
// They use only scene CSS vars (--amber, --text, --muted, --line, --mono, etc.)
// and do NOT introduce any token not already in the scene palette.

export const DELIVERY_GIFT_CSS = `
/* ── CAM-171: Gift indicator + DeliveryModal ── */

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

/* ── DeliveryModal overlay + box ── */
.delivery-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(7,13,28,.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (prefers-reduced-motion: no-preference) {
  .delivery-modal-overlay {
    animation: deliveryFadeIn 160ms ease both;
  }
  .delivery-modal {
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
.delivery-modal {
  width: min(440px, calc(100vw - 2rem));
  max-height: min(600px, calc(100svh - 4rem));
  background: rgba(10,28,20,.88);
  backdrop-filter: saturate(195%) blur(30px);
  -webkit-backdrop-filter: saturate(195%) blur(30px);
  border: 1px solid rgba(255,180,84,.22);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0,0,0,.70), 0 0 32px rgba(255,180,84,.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.delivery-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(150,240,195,.12);
  flex-shrink: 0;
}
.delivery-modal-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
/* Close button — 44×44px (Critical a11y fix per design.md) */
.delivery-modal-close {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.10);
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 120ms, color 120ms;
}
.delivery-modal-close:hover { background: rgba(255,255,255,.12); color: var(--text); }
.delivery-modal-close:focus-visible { outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px; }
.delivery-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(150,240,195,.2) transparent;
}
.delivery-modal-body::-webkit-scrollbar { width: 4px; }
.delivery-modal-body::-webkit-scrollbar-thumb { background: rgba(150,240,195,.2); border-radius: 4px; }
.delivery-modal-empty {
  font-size: 13px;
  color: var(--faint);
  text-align: center;
  padding: 24px 0;
}
.delivery-story-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(150,240,195,.08);
}
.delivery-story-item:last-child { border-bottom: none; }
.delivery-story-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: #5BE9B0;
}
.delivery-story-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.4;
}
.delivery-story-meta {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
  font-family: var(--mono);
}
.delivery-modal-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid rgba(150,240,195,.12);
  flex-shrink: 0;
}
.delivery-modal-footer-btn {
  width: 100%;
  min-height: 44px;
  border-radius: 999px;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(150,240,195,.20);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms;
}
.delivery-modal-footer-btn:hover { background: rgba(255,255,255,.12); }
.delivery-modal-footer-btn:focus-visible { outline: 2px solid rgba(91,233,176,.8); outline-offset: 2px; }
`;
