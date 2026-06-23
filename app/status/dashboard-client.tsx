"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Client-side behaviour for /status. A raw <script> tag inside a React tree is NOT executed
 * on the client, so the interactivity lives here in an effect instead:
 *  - window.showView  → instant client-side tab toggle (called by inline onclick in the injected HTML)
 *  - starfield        → populated once (lives in the constant SCENE div, survives router.refresh)
 *  - clock            → re-queries #clock each tick so it keeps working after a refresh
 *  - live refresh     → router.refresh() every N seconds (no full-page reload / white flash) */
export default function StatusClient({ refreshSeconds = 60 }: { refreshSeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    type StatusWindow = Window & {
      showView?: (v: string) => void;
      setGroup?: (g: string) => void;
      openSwitcher?: () => void;
      closeSwitcher?: () => void;
      filterSwitcher?: (p: string) => void;
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
    const refreshId = setInterval(() => {
      const y = window.scrollY;        // router.refresh() re-injects the HTML — re-pin scroll a few frames so it doesn't jump
      router.refresh();
      let n = 0;
      const restore = () => { window.scrollTo(0, y); if (++n < 8) requestAnimationFrame(restore); };
      requestAnimationFrame(restore);
    }, refreshSeconds * 1000);
    return () => {
      clearInterval(clockId);
      clearInterval(refreshId);
      document.removeEventListener("keydown", onKey);
    };
  }, [router, refreshSeconds]);

  return null;
}
