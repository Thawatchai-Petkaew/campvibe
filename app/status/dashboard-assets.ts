// Static visual shell for the /status live-delivery dashboard.
// Look & feel target: design/campvibe-delivery.html (night-camping scene + glass UI).
// Data is wired in page.tsx from lib/linear.ts — this file is pure presentation.

export const CSS = `
:root{
  --text:#F1F6FB;--muted:rgba(223,234,245,.66);--faint:rgba(223,234,245,.42);
  --emerald:#5BE9B0;--emerald-glow:rgba(91,233,176,.55);--amber:#FFB454;--amber-2:#FF9D3C;--amber-glow:rgba(255,150,52,.6);
  --blue:#8FB8F0;--violet:#B7A6FF;--green:#76E0AE;
  --glass:rgba(16,26,42,.42);--glass-2:rgba(26,38,60,.5);--glass-amber:rgba(58,38,18,.42);
  --line:rgba(255,255,255,.13);--line-2:rgba(255,255,255,.2);--hi:rgba(255,255,255,.16);--blur:saturate(150%) blur(20px);
  --r:20px;--r-sm:14px;
  --disp:'Outfit','Anuphan',system-ui,sans-serif;--body:'Inter','Anuphan',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;
}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:var(--body);color:var(--text);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh;background:#070d1c;overflow-x:hidden}
.scene{position:fixed;inset:0;z-index:0;overflow:hidden;background:linear-gradient(180deg,#060b1a 0%,#0a142b 26%,#0e2742 56%,#123a40 84%,#163f3a 100%)}
.aurora{position:absolute;inset:-10% -10% auto;height:70%;filter:blur(60px);opacity:.45;mix-blend-mode:screen;background:radial-gradient(40% 60% at 25% 30%,rgba(91,233,176,.7),transparent 70%),radial-gradient(46% 64% at 60% 18%,rgba(80,180,255,.5),transparent 72%),radial-gradient(38% 56% at 82% 36%,rgba(120,230,180,.55),transparent 70%);animation:drift 22s ease-in-out infinite alternate}
@keyframes drift{0%{transform:translateX(-3%) translateY(0)}100%{transform:translateX(4%) translateY(2%)}}
.moon{position:absolute;top:7%;right:10%;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#fff 0%,#eaf4ff 45%,#cfe0f5 70%,#aec6e6 100%);box-shadow:0 0 50px 14px rgba(206,224,245,.32),0 0 120px 30px rgba(150,190,235,.18)}
.stars span{position:absolute;border-radius:50%;background:#fff;animation:tw 4s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:var(--o,.7)}50%{opacity:.12}}
.land{position:absolute;left:0;right:0;bottom:0;width:100%;height:auto;display:block}
.camp{position:absolute;bottom:3.5%;left:50%;transform:translateX(-50%);width:330px;max-width:58vw;z-index:3}
.fireglow{position:absolute;left:50%;bottom:2%;width:520px;height:300px;transform:translateX(-50%);z-index:2;background:radial-gradient(ellipse at center,rgba(255,150,52,.5) 0%,rgba(255,110,40,.22) 35%,transparent 70%);filter:blur(8px);animation:flicker 3.6s ease-in-out infinite}
@keyframes flicker{0%,100%{opacity:.85;transform:translateX(-50%) scale(1)}45%{opacity:1;transform:translateX(-50%) scale(1.04)}70%{opacity:.78;transform:translateX(-50%) scale(.985)}}
.ember{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffb454;box-shadow:0 0 6px 1px rgba(255,150,52,.8);opacity:0;animation:ember 4.2s ease-in infinite}
@keyframes ember{0%{transform:translate(0,0) scale(1);opacity:0}12%{opacity:.95}100%{transform:translate(var(--dx,8px),-120px) scale(.2);opacity:0}}
.vign{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 30%,transparent 55%,rgba(4,8,18,.55) 100%)}
@media (prefers-reduced-motion:reduce){.aurora,.fireglow,.ember,.stars span{animation:none}.ember{display:none}}
.wrap{position:relative;z-index:5;max-width:1060px;margin:0 auto;padding:26px 22px 70px;display:flex;flex-direction:column;gap:16px}
.glass{background:var(--glass);backdrop-filter:var(--blur);-webkit-backdrop-filter:var(--blur);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 14px 44px rgba(0,0,0,.34),inset 0 1px 0 var(--hi)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
@keyframes pr{0%{box-shadow:0 0 0 0 var(--c,var(--emerald-glow))}70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}
.dot.live{background:var(--emerald);animation:pr 2s infinite}
@keyframes flow{to{background-position:20px 0}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.bar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:13px}
.cv-logo{height:34px;width:auto;display:block;flex:none;filter:drop-shadow(0 1px 7px rgba(0,0,0,.4))}
.cv-sub{font-size:11.5px;color:var(--muted);padding-left:13px;border-left:1px solid var(--line)}
.live{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--emerald);background:rgba(91,233,176,.1);border:1px solid rgba(91,233,176,.32);padding:7px 13px;border-radius:999px}
.hero{padding:20px}
.orbs{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.orb{border-radius:var(--r-sm);border:1px solid var(--line);background:var(--glass-2);padding:16px 16px 14px;text-align:left;text-decoration:none;color:inherit;position:relative;overflow:hidden}
.orb .n{font-family:var(--disp);font-weight:600;font-size:34px;line-height:1;letter-spacing:-.02em}
.orb .l{font-size:11.5px;color:var(--muted);margin-top:6px}
.orb.run .n{color:var(--emerald)}.orb.q .n{color:var(--blue)}.orb.s .n{color:var(--faint)}
.orb.you{background:linear-gradient(165deg,rgba(255,150,52,.2),rgba(255,150,52,.05));border-color:rgba(255,150,52,.42);cursor:pointer}
.orb.you .n{color:var(--amber)}.orb.you .l{color:#f4d3aa}
.orb.you::after{content:"→";position:absolute;top:14px;right:15px;color:var(--amber);opacity:.75}
.orb.you:hover{transform:translateY(-2px);transition:transform .16s;box-shadow:0 0 24px -6px var(--amber-glow)}
.pips{display:flex;gap:7px;margin-top:16px}
.pip{height:7px;flex:1;border-radius:4px;background:rgba(255,255,255,.1)}
.pip.run{background:var(--emerald);box-shadow:0 0 12px -1px var(--emerald-glow)}
.pip.you{background:var(--amber);box-shadow:0 0 12px -1px var(--amber-glow)}
.pip.q{background:rgba(143,184,240,.4)}.pip.done{background:var(--green)}
.trail{padding:24px 22px 20px}
.trail-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.trail-h .t{font-family:var(--disp);font-weight:600;font-size:15px;display:flex;align-items:center;gap:9px}
.trail-h .t svg{width:17px;height:17px;color:var(--emerald);opacity:.85}
.trail-h .h{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.rail{display:flex;align-items:flex-start}
.stage{display:flex;flex-direction:column;align-items:center;text-align:center;flex:0 0 auto;width:118px}
.node{width:62px;height:62px;border-radius:20px;display:grid;place-items:center;position:relative;background:var(--glass-2);border:1px solid var(--line-2);color:var(--muted);box-shadow:inset 0 1px 0 var(--hi);transition:.2s}
.node svg{width:25px;height:25px}
.stage .nm{font-family:var(--disp);font-weight:600;font-size:14px;margin-top:13px;color:var(--text)}
.stage .sub{font-size:11px;color:var(--faint);margin-top:4px;min-height:14px}
.conn{flex:1 1 auto;height:2px;margin-top:30px;min-width:20px;border-radius:2px;position:relative;background:repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 5px,transparent 5px 11px)}
.conn.flowing{background:linear-gradient(90deg,rgba(91,233,176,.5),var(--emerald));box-shadow:0 0 12px -1px var(--emerald-glow)}
.conn.flowing::after{content:"";position:absolute;inset:0;border-radius:2px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.65) 0 3px,transparent 3px 10px);animation:flow .7s linear infinite}
@media (prefers-reduced-motion:reduce){.conn.flowing::after{animation:none}}
.stage.run .node{border-color:rgba(91,233,176,.5);color:var(--emerald);background:linear-gradient(160deg,rgba(91,233,176,.18),rgba(91,233,176,.04));--c:var(--emerald-glow);animation:pr 2.4s infinite}
.stage.run .sub{color:var(--emerald)}
@media (prefers-reduced-motion:reduce){.stage.run .node{animation:none}}
.stage.done .node{border-color:rgba(118,224,174,.45);color:var(--green);background:linear-gradient(160deg,rgba(118,224,174,.14),transparent)}
.stage.done .sub{color:var(--green)}
.stage.gate{width:132px}
@keyframes fire{0%,100%{box-shadow:inset 0 1px 0 var(--hi),0 0 24px -4px var(--amber-glow);transform:scale(1)}50%{box-shadow:inset 0 1px 0 var(--hi),0 0 34px -2px var(--amber-glow);transform:scale(1.05)}}
.stage.gate .node{width:66px;height:66px;border-color:rgba(255,150,52,.55);color:var(--amber);background:radial-gradient(circle at 50% 70%,rgba(255,150,52,.32),rgba(255,150,52,.06));animation:fire 2.8s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.stage.gate .node{animation:none}}
.stage.gate .nm{color:#fff}
.stage.gate .sub{color:var(--amber);font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.stage.q .node{border-style:dashed;color:var(--faint)}.stage.q .nm{color:var(--muted)}
.stage.idle{opacity:.55}.stage.idle .node{border-style:dashed}
.action{padding:18px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--glass-amber);border:1px solid rgba(255,150,52,.42);box-shadow:0 14px 44px rgba(0,0,0,.34),inset 0 1px 0 var(--hi),0 0 40px -14px var(--amber-glow)}
.action .fi{width:48px;height:48px;border-radius:14px;flex:none;display:grid;place-items:center;color:var(--amber);background:radial-gradient(circle at 50% 70%,rgba(255,150,52,.4),rgba(255,150,52,.08));border:1px solid rgba(255,150,52,.5)}
.action .c{flex:1;min-width:200px}
.action .k{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);display:flex;align-items:center;gap:7px;margin-bottom:4px}
.action .k .dot{background:var(--amber);animation:pr 1.6s infinite;--c:var(--amber-glow)}
.action h3{font-family:var(--disp);font-weight:600;font-size:17px;margin:0;color:#fff}
.action .tk{font-family:var(--mono);font-size:11.5px;color:#e9c8a0;margin-top:3px}
.approve{flex:none;border:none;cursor:pointer;font-family:var(--disp);font-weight:600;font-size:14px;color:#241402;background:linear-gradient(180deg,#ffc06a,#ff9d3c);padding:13px 22px;border-radius:13px;box-shadow:0 8px 22px -6px var(--amber-glow);transition:transform .14s,box-shadow .14s;display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.approve:hover{transform:translateY(-1px);box-shadow:0 11px 26px -6px var(--amber-glow)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.pane{padding:18px 20px}
.pane-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.pane-h .t{font-family:var(--disp);font-weight:600;font-size:14.5px;display:flex;align-items:center;gap:8px}
.pane-h .x{font-family:var(--mono);font-size:11px;color:var(--faint)}
.agent{display:flex;align-items:center;gap:13px;padding:13px;border-radius:14px;margin-bottom:10px;border:1px solid rgba(91,233,176,.32);background:linear-gradient(160deg,rgba(91,233,176,.08),transparent)}
.agent:last-child{margin-bottom:0}
.agent .av{width:42px;height:42px;border-radius:12px;flex:none;display:grid;place-items:center;color:var(--emerald);background:rgba(91,233,176,.12);border:1px solid rgba(91,233,176,.34);overflow:hidden}
.agent .av svg{width:21px;height:21px}.agent .av img{width:100%;height:100%;object-fit:cover}
.agent .m{flex:1;min-width:0}
.agent .r{display:flex;align-items:center;gap:8px}
.agent .r b{font-family:var(--disp);font-weight:600;font-size:14px}
.agent .r .tk{font-family:var(--mono);font-size:10.5px;color:var(--faint);margin-left:auto}
.agent .ti{font-size:12.5px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dur{font-family:var(--mono);font-size:11px;color:var(--emerald);flex:none;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.dur .dd{width:6px;height:6px;border-radius:50%;background:var(--emerald);animation:blink 1.4s infinite}
.qrow{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:13px;margin-bottom:9px;border:1px solid var(--line);background:var(--glass-2);text-decoration:none;color:inherit}
.qrow:last-child{margin-bottom:0}
.qrow .qa{width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;color:var(--muted);background:rgba(255,255,255,.05);border:1px solid var(--line)}
.qrow .qa svg{width:19px;height:19px}
.qrow .qm{flex:1;min-width:0}
.qrow .qm b{font-family:var(--disp);font-weight:600;font-size:13.5px}
.qrow .qm .tk{font-family:var(--mono);font-size:10.5px;color:var(--faint);display:block;margin-top:2px}
.qs{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;border-radius:999px;flex:none}
.qs.blk{color:var(--amber);background:rgba(255,150,52,.12);border:1px solid rgba(255,150,52,.4)}
.qs.bl{color:var(--faint);background:rgba(255,255,255,.05);border:1px solid var(--line)}
.qs.td{color:var(--blue);background:rgba(143,184,240,.12);border:1px solid rgba(143,184,240,.3)}
.qd{text-align:center;font-family:var(--mono);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin:14px 0 11px;position:relative}
.qd::before,.qd::after{content:"";position:absolute;top:50%;width:26%;height:1px;background:var(--line)}
.qd::before{left:0}.qd::after{right:0}
.board-wrap{padding:18px 20px}
.board{display:grid;grid-template-columns:repeat(5,1fr);gap:11px}
.col-h{display:flex;align-items:center;gap:7px;margin-bottom:10px;font-family:var(--disp);font-weight:500;font-size:12px}
.col-h .c{font-family:var(--mono);color:var(--faint);margin-left:auto;font-size:10.5px}
.col[data-k=backlog] .col-h{color:#aebcc9}.col[data-k=backlog] .cd{background:#8a9aa8}
.col[data-k=todo] .col-h{color:var(--blue)}.col[data-k=todo] .cd{background:var(--blue)}
.col[data-k=prog] .col-h{color:var(--emerald)}.col[data-k=prog] .cd{background:var(--emerald)}
.col[data-k=review] .col-h{color:var(--violet)}.col[data-k=review] .cd{background:var(--violet)}
.col[data-k=done] .col-h{color:var(--green)}.col[data-k=done] .cd{background:var(--green)}
.kc{border-radius:12px;padding:11px;margin-bottom:9px;border:1px solid var(--line);background:var(--glass-2);text-decoration:none;color:inherit;display:block}
.kc:last-child{margin-bottom:0}
.kc .kt{font-size:12.5px;color:var(--text);line-height:1.35;display:flex;gap:7px;align-items:flex-start}
.kc .kt svg{width:15px;height:15px;flex:none;margin-top:1px;color:var(--faint)}
.kc .kb{display:flex;align-items:center;justify-content:space-between;margin-top:9px}
.kc .kr{font-size:11px;color:var(--muted)}
.kc .tk{font-family:var(--mono);font-size:10px;color:var(--faint)}
.kc.prog{border-color:rgba(91,233,176,.34)}.kc.prog .kr{color:var(--emerald)}
.kc.gate{border-color:rgba(255,150,52,.42);background:linear-gradient(160deg,rgba(255,150,52,.1),transparent)}
.yb{font-family:var(--mono);font-size:8.5px;font-weight:600;color:#241402;background:var(--amber);padding:2px 6px;border-radius:5px;margin-right:5px}
.empty{border:1px dashed var(--line);border-radius:12px;padding:20px 8px;text-align:center;color:var(--faint);font-size:11px}
.legend{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:16px}
.legend span{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:var(--muted)}
.tabs{display:inline-flex;gap:4px;background:var(--glass-2);border:1px solid var(--line);border-radius:12px;padding:4px}
.tab{border:none;background:transparent;color:var(--muted);font-family:var(--disp);font-weight:500;font-size:13px;padding:8px 15px;border-radius:9px;cursor:pointer;white-space:nowrap;text-decoration:none}
.tab:hover{color:var(--text)}
.tab.active{background:rgba(91,233,176,.16);color:var(--emerald);box-shadow:inset 0 0 0 1px rgba(91,233,176,.32)}
.view{display:none}
.view.active{display:flex;flex-direction:column;gap:16px}
.crumb{display:flex;align-items:center;gap:10px;padding:11px 18px;font-family:var(--disp);font-size:13px}
.crumb a{color:var(--muted);cursor:pointer;text-decoration:none}.crumb a:hover{color:var(--emerald)}
.crumb .sep{color:var(--faint)}.crumb .cur{color:var(--text);font-weight:500}
.crumb .cstage{margin-left:auto;font-family:var(--mono);font-size:11.5px;color:var(--muted);background:var(--glass-2);border:1px solid var(--line);padding:5px 11px;border-radius:999px}
.ovh-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:18px}
.ovh-eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.ovh-title{font-family:var(--disp);font-weight:600;font-size:19px;margin-top:5px}
.ovh-gate{display:inline-flex;align-items:center;gap:8px;font-family:var(--disp);font-weight:600;font-size:13px;color:var(--amber);background:rgba(255,150,52,.12);border:1px solid rgba(255,150,52,.4);padding:8px 14px;border-radius:999px;text-decoration:none}
.ovh-gate:hover{background:rgba(255,150,52,.18)}.ovh-gate svg{width:16px;height:16px}
.ovbar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);margin-top:16px;overflow:hidden}
.ovbar>i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,rgba(91,233,176,.6),var(--emerald));box-shadow:0 0 12px -1px var(--emerald-glow)}
.loads{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.load{padding:13px;border-radius:12px;border:1px solid var(--line);background:var(--glass-2)}
.load.you{border-color:rgba(255,150,52,.4);background:linear-gradient(160deg,rgba(255,150,52,.08),transparent)}
.load-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.load-name{font-family:var(--disp);font-weight:600;font-size:13.5px}
.load-n{font-family:var(--disp);font-weight:600;font-size:20px;color:var(--text)}
.load.you .load-n{color:var(--amber)}
.seg{display:flex;height:6px;border-radius:3px;overflow:hidden;margin:10px 0 9px;background:rgba(255,255,255,.07);gap:1.5px}
.seg>span{display:block;height:100%}
.load-sub{font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:6px}
.load.you .load-sub{color:#f0cb9f}
.epics{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.epic{padding:15px;border-radius:14px;border:1px solid var(--line);background:var(--glass-2);display:flex;flex-direction:column;gap:12px;cursor:pointer;transition:transform .15s,border-color .15s;text-decoration:none;color:inherit}
.epic:hover{border-color:var(--line-2);transform:translateY(-1px)}
.epic.live{border-color:rgba(255,150,52,.4);background:linear-gradient(160deg,rgba(255,150,52,.07),transparent)}
.epic-head{display:flex;align-items:center;gap:11px}
.epic-ic{width:36px;height:36px;border-radius:10px;flex:none;display:grid;place-items:center;background:rgba(91,233,176,.12);border:1px solid rgba(91,233,176,.3);color:var(--emerald)}
.epic.live .epic-ic{background:rgba(255,150,52,.14);border-color:rgba(255,150,52,.4);color:var(--amber)}
.epic-ic svg{width:19px;height:19px}
.epic-id{flex:1;min-width:0}
.epic-name{font-family:var(--disp);font-weight:600;font-size:14.5px}
.epic-st{font-size:11.5px;color:var(--muted);margin-top:2px}
.epic-act{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;padding:5px 9px;border-radius:999px;flex:none}
.epic-act.gate{color:var(--amber);background:rgba(255,150,52,.12);border:1px solid rgba(255,150,52,.4)}
.epic-act.ph{color:var(--muted);background:rgba(255,255,255,.05);border:1px solid var(--line)}
.epic-act.done{color:var(--green);background:rgba(118,224,174,.12);border:1px solid rgba(118,224,174,.3)}
.epic-prog{display:flex;align-items:center;gap:10px}
.epic-bar{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}
.epic-bar>i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,rgba(91,233,176,.6),var(--emerald))}
.epic-pct{font-family:var(--mono);font-size:12px;color:var(--text);min-width:34px;text-align:right}
.epic-mix{display:flex;height:5px;border-radius:3px;overflow:hidden;gap:1.5px;background:rgba(255,255,255,.06)}
.epic-mix>span{display:block;height:100%}
.bk-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:13px}
.bk-label{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.bk-chip{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);background:var(--glass-2);border:1px solid var(--line);padding:6px 12px;border-radius:999px}
.bk-chip svg{width:15px;height:15px;color:var(--muted)}
.bk-chip b{font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:500}
.bk-div{height:1px;background:var(--line);margin:3px 0 13px}
.gaterow{display:flex;align-items:center;gap:13px;padding:14px;border-radius:13px;border:1px solid var(--line);background:var(--glass-2);margin-bottom:10px}
.gaterow:last-child{margin-bottom:0}
.gaterow.urgent{border-color:rgba(255,150,52,.45);background:linear-gradient(160deg,rgba(255,150,52,.1),transparent)}
.gr-ic{width:42px;height:42px;border-radius:12px;flex:none;display:grid;place-items:center;color:var(--amber);background:radial-gradient(circle at 50% 70%,rgba(255,150,52,.3),rgba(255,150,52,.06));border:1px solid rgba(255,150,52,.4)}
.gr-ic svg{width:21px;height:21px}
.gr-m{flex:1;min-width:0}
.gr-title{font-family:var(--disp);font-weight:600;font-size:14px}
.gr-sub{font-size:12px;color:var(--muted);margin-top:2px}
.gr-btn{flex:none;cursor:pointer;font-family:var(--disp);font-weight:600;font-size:13px;color:#241402;background:linear-gradient(180deg,#ffc06a,#ff9d3c);padding:10px 16px;border-radius:11px;text-decoration:none}
.none-row{padding:10px 4px;color:var(--green);font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px}
.toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:rgba(16,26,42,.94);backdrop-filter:blur(12px);border:1px solid var(--line-2);color:var(--text);font-size:13px;padding:11px 18px;border-radius:12px;opacity:0;pointer-events:none;transition:.25s;z-index:50;max-width:88vw;text-align:center}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.err{background:rgba(58,20,20,.6);border:1px solid rgba(255,120,120,.5);color:#ffcaca;border-radius:14px;padding:16px}
.gatebox{max-width:430px;margin:16vh auto;text-align:center;position:relative;z-index:5}
.gatebox h2{font-family:var(--disp)}.gatebox code{font-family:var(--mono);color:var(--emerald)}
@media (max-width:860px){.cols{grid-template-columns:1fr}.board{grid-template-columns:1fr 1fr}}
@media (max-width:760px){.rail{flex-direction:column;align-items:flex-start;gap:0}.stage{flex-direction:row;align-items:center;text-align:left;width:100%;gap:14px}.stage .node,.stage.gate .node{width:56px;height:56px}.stage .nminfo{display:flex;flex-direction:column;gap:2px}.stage .nm{margin-top:0}.stage .sub{margin:0;min-height:0}.stage.gate{width:100%}.conn{flex:none;width:2px;height:16px;min-width:2px;margin:0 0 0 27px;background:repeating-linear-gradient(180deg,rgba(255,255,255,.22) 0 4px,transparent 4px 9px)}.conn.flowing{box-shadow:0 0 7px -2px var(--emerald-glow);background:linear-gradient(180deg,rgba(91,233,176,.5),var(--emerald))}.conn.flowing::after{background:repeating-linear-gradient(180deg,rgba(255,255,255,.6) 0 3px,transparent 3px 9px)}.epics{grid-template-columns:1fr}}
@media (max-width:560px){.wrap{padding:20px 13px 56px}.orbs{grid-template-columns:1fr 1fr}.board{grid-template-columns:1fr}.approve{width:100%;justify-content:center}.camp,.fireglow{max-width:78vw}.cv-sub{display:none}}
`;

export const SCENE = `<div class="scene" aria-hidden="true"><div class="aurora"></div><div class="moon"></div><div class="stars"></div><svg class="land" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice"><polygon points="0,360 120,300 230,344 340,262 470,330 590,250 700,322 820,272 960,330 1080,282 1200,342 1320,300 1440,350 1440,560 0,560" fill="#16304a" opacity=".72"/><polygon points="0,428 150,376 270,420 390,348 530,420 650,368 790,430 920,358 1060,420 1200,378 1340,430 1440,400 1440,560 0,560" fill="#0f2438" opacity=".92"/><polygon points="0,500 200,470 380,502 560,462 760,502 980,470 1180,502 1380,476 1440,496 1440,560 0,560" fill="#0a1a2a"/><g fill="#07131f"><path d="M90,500 l11,-26 11,26z M104,500 l9,-20 9,20z"/><path d="M250,498 l12,-28 12,28z M268,498 l9,-21 9,21z"/><path d="M1160,498 l11,-26 11,26z M1176,498 l9,-20 9,20z"/><path d="M1300,500 l12,-28 12,28z M1318,500 l9,-21 9,21z"/><path d="M980,500 l10,-23 10,23z"/><path d="M430,500 l10,-23 10,23z"/></g></svg><div class="fireglow"></div><div class="camp"><svg viewBox="0 0 330 200" preserveAspectRatio="xMidYMax meet"><defs><linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a23"/><stop offset=".5" stop-color="#ffab3c"/><stop offset="1" stop-color="#ffe07a"/></linearGradient></defs><ellipse cx="165" cy="184" rx="150" ry="12" fill="#06111c" opacity=".6"/><polygon points="118,72 64,178 172,178" fill="#0c1c2c"/><polygon points="118,178 118,116 138,178" fill="#060f18"/><line x1="118" y1="72" x2="172" y2="178" stroke="#ffb454" stroke-width="1.4" opacity=".35"/><line x1="118" y1="72" x2="118" y2="178" stroke="#1c3a52" stroke-width="1.5"/><g stroke="#3a2415" stroke-width="7" stroke-linecap="round"><line x1="226" y1="176" x2="262" y2="170"/><line x1="228" y1="170" x2="262" y2="178"/></g><path d="M244,172 C228,156 236,134 245,118 C254,135 260,156 250,170 Z" fill="url(#flame)"/><path d="M245,172 C236,160 240,144 246,132 C252,146 254,160 248,170 Z" fill="#ffd066" opacity=".9"/><path d="M245,170 C240,162 242,151 246,143 C250,153 250,162 247,168 Z" fill="#fff1b8"/></svg><span class="ember" style="left:70%;bottom:18%;--dx:10px;animation-delay:0s"></span><span class="ember" style="left:75%;bottom:16%;--dx:-6px;animation-delay:.9s"></span><span class="ember" style="left:73%;bottom:20%;--dx:14px;animation-delay:1.8s"></span><span class="ember" style="left:78%;bottom:15%;--dx:4px;animation-delay:2.6s"></span><span class="ember" style="left:68%;bottom:19%;--dx:-10px;animation-delay:3.3s"></span></div><div class="vign"></div></div>`;

export const LOGO = `<svg class="cv-logo" viewBox="0 0 244 62" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="CampVibe"><g fill="#F1F6FB" stroke="#F1F6FB" stroke-width="0.5"><path d="M221.331 28.5942C223.778 28.5943 225.731 29.4223 227.159 31.0923L227.402 31.3882C228.58 32.8912 229.164 34.7314 229.164 36.894C229.164 37.3482 228.995 37.7442 228.67 38.0728L228.671 38.0737C228.36 38.4149 227.954 38.5824 227.476 38.5825H216.915C217.123 39.8274 217.631 40.8188 218.431 41.5728C219.306 42.3479 220.509 42.7495 222.07 42.7495C223.678 42.7495 225.027 42.4935 226.127 41.9937C226.46 41.8281 226.777 41.7275 227.075 41.7046L227.203 41.6997C227.56 41.6739 227.878 41.8098 228.147 42.0747H228.148C228.448 42.344 228.62 42.6671 228.62 43.0386C228.62 43.3577 228.554 43.6463 228.411 43.8931C228.268 44.1396 228.055 44.3278 227.786 44.4634L227.787 44.4644C227.345 44.6983 226.941 44.9069 226.576 45.0894C226.2 45.2772 225.799 45.4375 225.372 45.5708L225.363 45.5737L225.298 45.3325L225.362 45.5737C224.377 45.84 223.24 45.9712 221.953 45.9712C219.288 45.9712 217.182 45.2309 215.671 43.7202L215.668 43.7173C214.184 42.1798 213.459 40.0227 213.459 37.2827C213.459 34.9041 214.081 32.9025 215.34 31.2954L215.341 31.2944C216.769 29.4897 218.777 28.5942 221.331 28.5942ZM221.331 31.5444C220.423 31.5444 219.653 31.7459 219.012 32.1392C218.37 32.5324 217.842 33.1265 217.432 33.9351L217.431 33.938C217.172 34.4347 216.995 35.024 216.905 35.7104H225.768C225.645 34.393 225.121 33.3543 224.202 32.5737L224.199 32.5708C223.419 31.8884 222.468 31.5444 221.331 31.5444Z"/><path d="M203.743 31.8164C201.932 31.8164 200.333 32.5487 198.938 34.0381V40.5283C200.333 42.0427 201.93 42.7735 203.739 42.749H203.743C204.925 42.749 205.888 42.4889 206.648 41.9844C207.406 41.4806 207.982 40.7201 208.369 39.6846C208.615 38.994 208.729 38.1973 208.704 37.29L208.703 37.2832H208.704C208.704 35.5128 208.237 34.1536 207.331 33.1748H207.33C206.453 32.2762 205.267 31.8165 203.743 31.8164ZM212.12 37.2832C212.12 39.9329 211.283 42.1001 209.596 43.7607L209.594 43.7627C208.045 45.2583 206.207 45.9967 204.093 45.9707V45.9717L204.092 45.9707L204.09 45.9717V45.9707C202.175 45.97 200.457 45.2707 198.938 43.8936V44.127C198.938 44.5848 198.767 44.9853 198.437 45.3154L198.436 45.3145C198.126 45.6501 197.723 45.8164 197.248 45.8164C196.769 45.8163 196.355 45.6488 196.022 45.3154L196.014 45.3066C195.712 44.975 195.56 44.5774 195.56 44.127V23.4385C195.56 22.9671 195.709 22.5633 196.022 22.251C196.355 21.9175 196.769 21.7501 197.248 21.75C197.719 21.75 198.119 21.9132 198.428 22.2432L198.548 22.3633C198.809 22.6556 198.938 23.0193 198.938 23.4385V30.6709C200.46 29.2928 202.194 28.5947 204.132 28.5947C206.271 28.5948 208.098 29.3459 209.597 30.8447C211.257 32.5044 212.094 34.6575 212.12 37.2803V37.2832Z"/><path d="M190.432 28.7498C190.911 28.7498 191.318 28.9179 191.628 29.2595H191.628C191.937 29.5739 192.083 29.9889 192.083 30.4773V44.1267C192.083 44.5772 191.93 44.9747 191.628 45.3064C191.318 45.648 190.911 45.8162 190.432 45.8162C189.953 45.8161 189.539 45.6486 189.206 45.3152C188.876 44.9851 188.705 44.5846 188.705 44.1267V30.4773C188.705 29.9816 188.867 29.5635 189.206 29.2507L189.335 29.1335C189.644 28.8781 190.013 28.7498 190.432 28.7498ZM190.51 22.2166C191.039 22.2166 191.492 22.3957 191.853 22.7566C192.214 23.1175 192.393 23.5711 192.393 24.0994V24.2166C192.393 24.745 192.214 25.1993 191.853 25.5603C191.492 25.921 191.039 26.0993 190.51 26.0994H190.316C189.788 26.0994 189.333 25.9212 188.972 25.5603L188.964 25.5525C188.632 25.1903 188.471 24.7386 188.471 24.2166V24.0994C188.471 23.5711 188.65 23.1175 189.011 22.7566C189.369 22.3985 189.809 22.2166 190.316 22.2166H190.51Z"/><path d="M185.172 22.761C185.77 22.761 186.259 22.9092 186.561 23.2708H186.562C186.853 23.5904 187.016 23.9461 187.016 24.3333C187.016 24.6483 186.978 24.9213 186.88 25.1272L186.881 25.1282L179.025 44.1838L179.02 44.1956H179.02C178.527 45.2352 177.807 45.8157 176.85 45.8157H176.11C175.62 45.8156 175.184 45.6777 174.812 45.3958C174.444 45.1159 174.155 44.7055 173.936 44.1848V44.1838L166.041 25.1292L166.038 25.1204L166.035 25.1125C165.97 24.9179 165.944 24.6516 165.944 24.3333C165.944 23.9543 166.088 23.6017 166.351 23.2805L166.359 23.2708C166.666 22.9329 167.058 22.761 167.517 22.761C167.908 22.761 168.257 22.8563 168.552 23.0579C168.809 23.2338 169.01 23.4815 169.162 23.7893L169.225 23.925L169.227 23.929L176.461 42.0159L183.732 23.9319C183.872 23.5698 184.058 23.2765 184.301 23.0725C184.549 22.8647 184.843 22.761 185.172 22.761Z"/><path d="M156.385 31.8159C154.574 31.8159 152.975 32.549 151.579 34.0386V40.5278C152.975 42.0424 154.572 42.774 156.381 42.7495H156.385C157.567 42.7494 158.53 42.4884 159.289 41.9839C160.048 41.4801 160.624 40.7197 161.011 39.6841C161.257 38.9936 161.371 38.1967 161.346 37.2896L161.345 37.2827H161.346C161.346 35.5125 160.878 34.1541 159.973 33.1753V33.1743C159.096 32.2756 157.909 31.816 156.385 31.8159ZM164.762 37.2827C164.762 39.9326 163.925 42.1005 162.238 43.7612L162.236 43.7622C160.687 45.258 158.849 45.9962 156.735 45.9702V45.9712L156.734 45.9702L156.732 45.9712V45.9702C154.817 45.9695 153.099 45.271 151.579 43.894V51.438C151.579 51.9169 151.412 52.3311 151.078 52.6646L151.078 52.6636C150.768 52.9995 150.365 53.1655 149.89 53.1655C149.411 53.1654 148.997 52.998 148.663 52.6646L148.656 52.6567V52.6558C148.351 52.3209 148.202 51.9098 148.202 51.438V30.439C148.202 29.9885 148.354 29.5909 148.656 29.2593L148.663 29.2505L148.792 29.1333C149.102 28.8779 149.471 28.7496 149.89 28.7495C150.361 28.7495 150.761 28.9128 151.07 29.2427L151.19 29.3638C151.451 29.6561 151.579 30.0198 151.579 30.439V30.6714C153.102 29.2932 154.835 28.5942 156.774 28.5942C158.913 28.5943 160.74 29.3462 162.239 30.8452C163.898 32.505 164.736 34.6579 164.762 37.2808V37.2827Z"/><path d="M128.686 28.5942C129.879 28.5943 130.98 28.9481 131.98 29.6509H131.979C132.681 30.1424 133.229 30.7934 133.627 31.5972C134.144 30.8525 134.662 30.303 135.187 29.9653C136.424 29.051 137.838 28.5942 139.419 28.5942C141.204 28.5944 142.627 29.2891 143.661 30.6753L143.823 30.897C144.609 32.0204 144.996 33.3756 144.996 34.9497V44.1274C144.996 44.5852 144.825 44.9849 144.495 45.3149L144.494 45.314C144.185 45.6496 143.783 45.8158 143.308 45.8159C142.85 45.8159 142.449 45.6451 142.119 45.3149C141.789 44.9849 141.618 44.5851 141.618 44.1274V35.5327C141.618 34.2067 141.375 33.2742 140.931 32.6899L140.924 32.6812C140.523 32.1017 139.791 31.7778 138.641 31.7778C136.904 31.7779 135.445 32.7131 134.263 34.6704V44.1274C134.263 44.5812 134.094 44.9768 133.77 45.3052L133.771 45.3062C133.46 45.6477 133.054 45.8159 132.574 45.8159C132.117 45.8159 131.717 45.645 131.387 45.3149C131.057 44.9849 130.886 44.5852 130.886 44.1274V35.5327C130.886 34.2066 130.641 33.2742 130.197 32.6899L130.191 32.6812V32.6802C129.789 32.1011 129.057 31.7778 127.907 31.7778C126.171 31.778 124.712 32.7134 123.53 34.6704V44.1274C123.53 44.5851 123.359 44.9849 123.029 45.3149C122.699 45.6451 122.299 45.8159 121.841 45.8159C121.383 45.8158 120.984 45.645 120.653 45.3149C120.323 44.9849 120.153 44.5852 120.153 44.1274V30.4771L120.159 30.311C120.193 29.9287 120.343 29.5885 120.607 29.2983V29.2974C120.938 28.9357 121.355 28.7496 121.841 28.7495C122.299 28.7495 122.699 28.9204 123.029 29.2505C123.363 29.5839 123.53 29.9983 123.53 30.4771V31.0415C124.83 29.439 126.551 28.6182 128.683 28.5942H128.686Z"/><path d="M110.358 38.3889C108.872 38.3889 107.733 38.5817 106.924 38.9495L106.918 38.9524C106.525 39.119 106.246 39.3401 106.064 39.6096C105.883 39.8788 105.787 40.2139 105.787 40.6272C105.787 41.4229 106.045 41.9783 106.532 42.342C107.032 42.7159 107.813 42.9172 108.917 42.9045H108.92C109.863 42.9045 110.741 42.6821 111.558 42.2366C112.387 41.7733 113.042 41.2668 113.531 40.7229V38.3889H110.358ZM116.986 44.1272C116.986 44.5926 116.796 44.9945 116.438 45.3225L116.437 45.3215C116.105 45.6499 115.695 45.8157 115.22 45.8157C114.762 45.8157 114.362 45.6448 114.032 45.3147C113.702 44.9846 113.531 44.5851 113.531 44.1272V43.8928C113.004 44.3569 112.361 44.7937 111.605 45.2024L111.6 45.2053C110.595 45.7214 109.334 45.9719 107.831 45.9719C106.397 45.9719 105.172 45.581 104.17 44.7903L103.972 44.6272C102.903 43.695 102.37 42.4698 102.37 40.9768C102.37 39.3225 102.999 38.0027 104.258 37.0452C105.614 36.0144 107.516 35.5291 109.93 35.5549H113.531V35.5334C113.531 34.1405 113.188 33.2174 112.568 32.6897L112.565 32.6868C111.958 32.1494 110.968 31.8557 109.542 31.8557C108.356 31.8557 106.968 32.0955 105.377 32.5833L105.376 32.5823C105.188 32.644 104.967 32.6721 104.72 32.6721C104.427 32.672 104.149 32.5261 103.892 32.2981L103.882 32.2874C103.59 31.9954 103.449 31.5769 103.421 31.0745L103.42 31.0608L103.424 30.9504C103.443 30.6959 103.53 30.4649 103.687 30.2649C103.863 30.0411 104.116 29.87 104.426 29.7424C106.246 28.9508 108.135 28.5676 110.09 28.594L110.089 28.595C112.293 28.5954 114.037 29.2742 115.286 30.6575L115.487 30.884C116.463 32.0349 116.961 33.4457 116.986 35.1018V44.1272Z"/><path d="M84.167 34.2882C84.167 36.7793 84.8509 38.7629 86.1992 40.2628H86.2002C87.6995 41.887 89.7662 42.711 92.4326 42.7111C93.6589 42.7111 94.6956 42.5829 95.5469 42.3331L95.8799 42.2238C96.6545 41.9591 97.4101 41.6264 98.1465 41.2247L98.1543 41.2198C98.362 41.116 98.6422 41.0773 98.9658 41.0773C99.3524 41.0773 99.6863 41.2408 99.959 41.5392C100.236 41.8161 100.383 42.1508 100.383 42.5323C100.383 42.8542 100.313 43.147 100.163 43.3995C100.015 43.6497 99.795 43.8451 99.5186 43.9923L99.5195 43.9933C98.5181 44.573 97.4381 45.0461 96.2812 45.4142L96.2822 45.4152C95.1352 45.7886 93.7465 45.9718 92.1221 45.9718C90.5129 45.9718 89.0049 45.7078 87.6006 45.1779L87.5986 45.1769C86.2193 44.6463 85.0224 43.8761 84.0117 42.8654V42.8644C81.8305 40.7349 80.75 37.8663 80.75 34.2882C80.7501 30.7342 81.8314 27.8659 84.0127 25.7111C86.114 23.6363 88.8384 22.6056 92.1611 22.6056C93.7605 22.6056 95.1372 22.8022 96.2852 23.2023C97.4312 23.593 98.3174 23.9614 98.9336 24.3097H98.9326C99.2335 24.4669 99.4828 24.6142 99.6758 24.7521C99.8517 24.8778 99.996 25.0084 100.089 25.1427C100.294 25.3816 100.383 25.6918 100.383 26.0441C100.383 26.4245 100.238 26.7683 99.9688 27.0675L99.96 27.0773L99.959 27.0763C99.6819 27.3533 99.3475 27.5001 98.9658 27.5001C98.6609 27.5001 98.391 27.4589 98.168 27.3634L98.1572 27.3585L98.1465 27.3527C97.3066 26.8946 96.4418 26.5383 95.5527 26.2843L95.5449 26.2823C94.6965 26.0078 93.6226 25.8663 92.3164 25.8663C91.0241 25.8663 89.8522 26.0942 88.7979 26.546L88.7959 26.548C87.764 26.9758 86.8995 27.5638 86.2002 28.3126C84.8256 29.8122 84.1416 31.7953 84.167 34.2863V34.2882Z"/></g><g fill="#FFB454"><path d="M17.7961 2.69584C18.3853 1.76805 19.7393 1.76805 20.3285 2.69584L31.8884 20.8979C32.5226 21.8965 31.8052 23.2021 30.6221 23.2021H7.50243C6.31941 23.2021 5.60198 21.8965 6.23621 20.8979L17.7961 2.69584Z"/><path d="M60.7918 13.7266C61.3797 12.7897 62.7449 12.7897 63.3328 13.7266L71.4459 26.6547C72.0728 27.6537 71.3548 28.952 70.1754 28.952H53.9492C52.7698 28.952 52.0518 27.6537 52.6787 26.6547L60.7918 13.7266Z"/><path d="M17.7961 12.6958C18.3853 11.7681 19.7393 11.7681 20.3285 12.6958L31.8884 30.8979C32.5226 31.8965 31.8052 33.2021 30.6221 33.2021H7.50243C6.31941 33.2021 5.60198 31.8965 6.23621 30.8979L17.7961 12.6958Z"/><path d="M60.8081 23.6137C61.4005 22.7108 62.7241 22.7108 63.3164 23.6137L71.3636 35.8792C72.0181 36.8768 71.3025 38.2021 70.1095 38.2021H54.0151C52.8221 38.2021 52.1065 36.8768 52.7609 35.8792L60.8081 23.6137Z"/><path d="M17.7961 23.6958C18.3853 22.7681 19.7393 22.7681 20.3285 23.6958L31.8884 41.8979C32.5226 42.8965 31.8052 44.2021 30.6221 44.2021H7.50243C6.31941 44.2021 5.60198 42.8965 6.23621 41.8979L17.7961 23.6958Z"/></g><path d="M43.1846 58.6564V13.5039C43.1846 12.0334 41.2883 11.441 40.4513 12.6501L9.19185 57.8026C8.50311 58.7975 9.21514 60.1564 10.4251 60.1564H41.6846C42.513 60.1564 43.1846 59.4849 43.1846 58.6564Z" fill="#5BE9B0"/><path d="M47.8969 12.6501L79.1563 57.8026C79.845 58.7975 79.133 60.1564 77.923 60.1564H64.7055C64.2092 60.1564 63.745 59.9109 63.4656 59.5007L46.0308 33.8973C45.4658 33.0676 45.1636 32.0869 45.1636 31.0831V13.5039C45.1636 12.0334 47.0598 11.441 47.8969 12.6501Z" fill="#2BC9A3"/><path fill-rule="evenodd" clip-rule="evenodd" d="M59.9592 58.6018C60.4023 59.2663 59.9259 60.1565 59.1272 60.1565H46.1636C45.6113 60.1565 45.1636 59.7088 45.1636 59.1565V48.2824V39.7111C45.1636 38.7217 46.4468 38.3331 46.9956 39.1564L59.9592 58.6018Z" fill="#2BC9A3"/></svg>`;
