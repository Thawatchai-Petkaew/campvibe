"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, X } from "lucide-react";

/* Client-side behaviour for /status. A raw <script> tag inside a React tree is NOT executed
 * on the client, so the interactivity lives here in an effect instead:
 *  - window.showView  → instant client-side tab toggle (called by inline onclick in the injected HTML)
 *  - starfield        → populated once (lives in the constant SCENE div, survives router.refresh)
 *  - clock            → re-queries #clock each tick so it keeps working after a refresh
 *  - live refresh     → router.refresh() every N seconds (no full-page reload / white flash) */
// CAM-286: ticket detail (fetched from the same read-only endpoint the map uses).
interface TicketDetail {
  id: string;
  title: string;
  status: string;
  role?: string;
  description?: string;
  url?: string;
}
type TicketFetchState = "loading" | "loaded" | "error";

const ROLE_LABEL_TD: Record<string, string> = {
  architect: "Architect", "ux-designer": "Designer", "frontend-engineer": "Frontend", "backend-engineer": "Backend",
  "qa-engineer": "QA", "security-reviewer": "Security", "devops-release": "DevOps", "product-owner": "Product Owner",
  analyst: "Analyst", orchestrator: "Orchestrator", human: "You",
};

async function fetchTicketDetail(id: string, token: string): Promise<TicketDetail> {
  const qs = token ? `?token=${encodeURIComponent(token)}` : "";
  const res = await fetch(`/api/status/issue/${encodeURIComponent(id)}${qs}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<TicketDetail>;
}

export default function StatusClient({ refreshSeconds = 60, token = "" }: { refreshSeconds?: number; token?: string }) {
  const router = useRouter();

  // CAM-286: read-only ticket detail modal — replaces the dashboard cards' old direct
  // linear.app links. Delegated open via data-act="open-ticket" (see onDelegatedClick).
  const [ticketId, setTicketId] = useState<string>("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [ticketFetchState, setTicketFetchState] = useState<TicketFetchState>("loading");
  const ticketTriggerRef = useRef<HTMLElement | null>(null);
  const ticketPanelRef = useRef<HTMLDivElement | null>(null);

  const loadTicket = (id: string) => {
    setTicketFetchState("loading");
    fetchTicketDetail(id, token)
      .then((d) => { setTicketDetail(d); setTicketFetchState("loaded"); })
      .catch(() => setTicketFetchState("error"));
  };

  // Fetch on open (and refetch if the id changes while open).
  useEffect(() => {
    if (!ticketOpen || !ticketId) return;
    setTicketDetail(null);
    loadTicket(ticketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketOpen, ticketId]);

  // Focus-trap + Esc + return-focus while the ticket modal is open.
  useEffect(() => {
    if (!ticketOpen) return;
    const panel = ticketPanelRef.current;
    const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
    (focusables[0] ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setTicketOpen(false);
        ticketTriggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [ticketOpen]);

  useEffect(() => {
    type StatusWindow = Window & {
      showView?: (v: string) => void;
      setGroup?: (g: string) => void;
      openSwitcher?: () => void;
      closeSwitcher?: () => void;
      filterSwitcher?: (p: string) => void;
      toggleEnv?: () => void;
      filterEpics?: (f: string) => void;
      "open-ticket"?: (id: string) => void;
    };
    const w = window as StatusWindow;
    // Persist a view param into the URL (no navigation) so router.refresh() re-renders the SAME view.
    const syncUrl = (k: string, v: string) => {
      try { const u = new URL(location.href); u.searchParams.set(k, v); history.replaceState(null, "", u); } catch { /* no-op */ }
    };

    w.showView = (v: string) => {
      document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === "view-" + v));
      ["overview", "epic"].forEach((t) => {
        const b = document.getElementById("tab-" + t);
        if (b) b.classList.toggle("active", t === v);
      });
      syncUrl("tab", v);                       // ← without this, a 60s refresh bounced back to the URL's stale tab
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Group toggle (Feature | Persona) — flips both Epics + Project backlog at once, keeps every segmented copy in sync.
    w.setGroup = (g: string) => {
      ["epics", "backlog"].forEach((sec) => {
        const f = document.getElementById(sec + "-by-feature");
        const p = document.getElementById(sec + "-by-persona");
        if (f) f.classList.toggle("active", g !== "persona");
        if (p) p.classList.toggle("active", g === "persona");
      });
      document.querySelectorAll(".segbtn").forEach((b) => {
        const on = b.getAttribute("data-g") === g;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
      syncUrl("group", g);
    };

    // Epic switcher modal
    w.openSwitcher = () => document.getElementById("switcher")?.classList.add("open");
    w.closeSwitcher = () => document.getElementById("switcher")?.classList.remove("open");
    w.filterSwitcher = (p: string) => {
      document.querySelectorAll<HTMLElement>("#switcher .sw-item").forEach((el) => {
        el.style.display = p === "all" || el.getAttribute("data-persona") === p ? "" : "none";
      });
      document.querySelectorAll("#switcher .sw-fbtn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-p") === p));
    };
    // Environments pane collapse — the count summary stays visible in the header.
    w.toggleEnv = () => {
      const b = document.getElementById("env-board");
      if (!b) return;
      const collapsed = b.classList.toggle("collapsed");
      const btn = document.getElementById("env-toggle");
      if (btn) { btn.textContent = collapsed ? "รายละเอียด ▾" : "ย่อ ▴"; btn.setAttribute("aria-expanded", String(!collapsed)); }
      syncUrl("env", collapsed ? "closed" : "open");
    };
    // Epics filter — show/hide cards (and any group left empty) by lifecycle status, persisted in the URL.
    w.filterEpics = (f: string) => {
      document.querySelectorAll<HTMLElement>("#epics-pane .epic").forEach((el) => {
        el.style.display = f === "all" || el.getAttribute("data-estatus") === f ? "" : "none";
      });
      document.querySelectorAll<HTMLElement>("#epics-pane .grp").forEach((g) => {
        const anyVisible = Array.from(g.querySelectorAll<HTMLElement>(".epic")).some((e) => e.style.display !== "none");
        g.style.display = anyVisible ? "" : "none";
      });
      document.querySelectorAll(".efbtn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-f") === f));
      syncUrl("efilter", f);
    };
    // CAM-286: card/"Review →"-style link → read-only ticket detail modal (React-rendered
    // below, not string HTML — needs live fetch state, so it lives in component state).
    w["open-ticket"] = (id: string) => { setTicketId(id); setTicketOpen(true); };

    const onDelegatedClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
      if (!el) return;
      const act = el.getAttribute("data-act") || "";
      const arg = el.getAttribute("data-arg") ?? "";
      if (act === "open-ticket") ticketTriggerRef.current = el;
      const fn = (w as unknown as Record<string, unknown>)[act];
      if (typeof fn === "function") (fn as (a: string) => void)(arg);
    };
    document.addEventListener("click", onDelegatedClick);

    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") w.closeSwitcher?.(); };
    document.addEventListener("keydown", onKey);

    const stars = document.querySelector(".stars");
    if (stars && stars.childElementCount === 0) {
      let h = "";
      for (let i = 0; i < 68; i++) {
        const x = (Math.random() * 100).toFixed(2), y = (Math.random() * 72).toFixed(2),
          sz = (Math.random() * 1.6 + 0.5).toFixed(2), o = (Math.random() * 0.6 + 0.35).toFixed(2), d = (Math.random() * 4).toFixed(2);
        h += `<span style="left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;--o:${o};opacity:${o};animation-delay:${d}s"></span>`;
      }
      stars.innerHTML = h;
    }

    const tick = () => {
      const el = document.getElementById("clock");
      if (!el) return;
      const dt = new Date();
      let hh = dt.getHours();
      const mm = dt.getMinutes();
      const ap = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;
      el.textContent = `${hh}:${mm < 10 ? "0" + mm : mm} ${ap}`;
    };
    tick();
    const clockId = setInterval(tick, 1000);
    // Refresh (re-fetch + re-inject HTML) while pinning scroll so it doesn't jump, and flash the
    // live dot so a real-time update is visible. Shared by the 60s fallback + the SSE push.
    const refreshKeepScroll = () => {
      const y = window.scrollY;
      router.refresh();
      let n = 0;
      const restore = () => { window.scrollTo(0, y); if (++n < 8) requestAnimationFrame(restore); };
      requestAnimationFrame(restore);
      const dot = document.querySelector(".live .dot");
      if (dot) { dot.classList.add("bump"); setTimeout(() => dot.classList.remove("bump"), 1100); }
    };
    const refreshId = setInterval(refreshKeepScroll, refreshSeconds * 1000);

    // Real-time push: subscribe to the pulse stream; on an event, refresh immediately. The 60s
    // interval above stays as a fallback if EventSource is unavailable or the stream fails hard.
    let es: EventSource | null = null;
    let guard = 0;
    const openStream = () => {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : "";
        es = new EventSource(`/api/status/stream${qs}`);
        es.onmessage = () => { guard = 0; refreshKeepScroll(); };
        es.onerror = () => {
          if (es && es.readyState === EventSource.CLOSED) { // hard fail (e.g. 401), not the routine self-close
            es.close(); es = null;
            if (guard++ < 5) setTimeout(openStream, 5000 * guard);
          }
        };
      } catch { /* SSE unsupported → the 60s interval still refreshes */ }
    };
    openStream();

    return () => {
      clearInterval(clockId);
      clearInterval(refreshId);
      es?.close();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onDelegatedClick);
    };
  }, [router, refreshSeconds, token]);

  if (!ticketOpen || !ticketId) return null;

  const displayTitle = ticketDetail?.title ?? ticketId;
  const roleLabel = ticketDetail?.role ? (ROLE_LABEL_TD[ticketDetail.role] ?? ticketDetail.role) : "";

  return (
    <div className="td-overlay" data-testid="modal--dashboard-ticket-detail">
      <div className="td-backdrop" aria-hidden="true" onClick={() => setTicketOpen(false)} />
      <div
        ref={ticketPanelRef}
        className="td-panel"
        role="dialog"
        aria-modal="true"
        aria-label="รายละเอียดงาน"
        tabIndex={-1}
        data-testid="panel--dashboard-ticket-detail"
      >
        <div className="td-head">
          <div className="td-titles">
            <span className="td-key">{ticketId}</span>
            <div className="td-title">{displayTitle}</div>
          </div>
          <button
            type="button"
            className="td-close"
            aria-label="ปิด"
            onClick={() => { setTicketOpen(false); ticketTriggerRef.current?.focus(); }}
            data-testid="btn--dashboard-ticket-close"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {ticketDetail && (
          <div className="td-meta">
            <span>สถานะ:<b> {ticketDetail.status}</b></span>
            <span aria-hidden="true">·</span>
            <span>บทบาท:<b> {roleLabel || "—"}</b></span>
          </div>
        )}

        <div className="td-sep" aria-hidden="true" />

        <div className="td-body">
          {ticketFetchState === "loading" && (
            <div aria-busy="true" role="status" aria-live="polite">
              <span className="sr-only">กำลังโหลด…</span>
              <div className="td-skel" style={{ width: "90%" }} aria-hidden="true" />
              <div className="td-skel" style={{ width: "70%" }} aria-hidden="true" />
            </div>
          )}
          {ticketFetchState === "error" && (
            <div className="td-desc-error" role="alert" data-testid="error--dashboard-ticket-fetch">
              ดึงข้อมูลไม่ได้ กรุณาลองใหม่
              <button type="button" className="td-retry" onClick={() => loadTicket(ticketId)}>ลองใหม่</button>
            </div>
          )}
          {ticketFetchState === "loaded" && (
            ticketDetail?.description ? (
              <div className="td-desc" data-testid="desc--dashboard-ticket">{ticketDetail.description}</div>
            ) : (
              <div className="td-desc-empty" data-testid="empty--dashboard-ticket-desc">ไม่มีคำอธิบาย</div>
            )
          )}
        </div>

        {/* Legacy-only "opened in Linear" history link — never shown for new self-hosted tickets */}
        {ticketDetail?.url && (
          <a
            href={ticketDetail.url}
            target="_blank"
            rel="noopener noreferrer"
            className="td-link"
            aria-label="เปิด Linear ประวัติ (เปิดแท็บใหม่)"
            data-testid="link--dashboard-ticket-legacy"
          >
            <ExternalLink size={13} aria-hidden="true" />
            เปิด Linear (ประวัติ)
          </a>
        )}
      </div>
    </div>
  );
}
