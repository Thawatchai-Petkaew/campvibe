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
    (window as Window & { showView?: (v: string) => void }).showView = (v: string) => {
      document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === "view-" + v));
      ["overview", "epic"].forEach((t) => {
        const b = document.getElementById("tab-" + t);
        if (b) b.classList.toggle("active", t === v);
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

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
    const refreshId = setInterval(() => router.refresh(), refreshSeconds * 1000);
    return () => {
      clearInterval(clockId);
      clearInterval(refreshId);
    };
  }, [router, refreshSeconds]);

  return null;
}
