// Static visual shell for the /status/map campsite scene.
// Night-sky background reusing the same color palette as dashboard-assets.ts.
// Data is wired in page.tsx — this file is pure presentation.
//
// CAM-160: dark overlay (linear-gradient), aurora, and stars are removed so the
// forest image renders crisp. The forest background now lives on .map-stage in
// campsite-scene.tsx, which couples it to the character layer so both scale together.
// .map-scene is kept as a minimal #070d1c fallback for the token-gate / error states.

export const CSS = `
:root{
  --text:#F1F6FB;--muted:rgba(223,234,245,.66);--faint:rgba(223,234,245,.42);
  --emerald:#5BE9B0;--amber:#FFB454;--blue:#8FB8F0;--green:#76E0AE;
  --glass:rgba(16,26,42,.42);--blur:saturate(150%) blur(20px);
  --line:rgba(255,255,255,.13);--hi:rgba(255,255,255,.16);
  --r:20px;--disp:'Outfit','Anuphan',system-ui,sans-serif;--body:'Inter','Anuphan',system-ui,sans-serif;
}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:var(--body);color:var(--text);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh;background:#070d1c;overflow-x:hidden}
.map-scene{position:fixed;inset:0;z-index:0;overflow:hidden;background:#070d1c}
.map-wrap{position:relative;z-index:5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.map-placeholder{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 14px 44px rgba(0,0,0,.34),inset 0 1px 0 var(--hi);padding:40px 48px;text-align:center;max-width:480px}
.map-placeholder-text{font-family:var(--disp);font-size:18px;font-weight:600;color:var(--text);margin:0}
.gatebox{max-width:430px;margin:16vh auto;text-align:center;position:relative;z-index:5;background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 14px 44px rgba(0,0,0,.34),inset 0 1px 0 var(--hi);padding:26px}
.gatebox h2{font-family:var(--disp);margin:0 0 10px}
.gatebox code{font-family:monospace;color:var(--emerald)}
`;

export const SCENE = `<div class="map-scene" aria-hidden="true"></div>`;
