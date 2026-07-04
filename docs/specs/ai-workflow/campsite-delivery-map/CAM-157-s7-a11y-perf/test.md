# CAM-157 (S7) — Test Plan

## Suite results (source-inspection, Vitest)

```
Test Files  42 passed (42)
Tests       2309 passed (2309)
  (2282 pre-S7 tests unchanged + 27 new S7 tests)
```

## S7 test coverage (27 new tests in `__tests__/status-map.test.ts`)

### AC1 — Reduced-motion labels (5 tests)
| Test | Assertion |
|---|---|
| CSS block contains @media (prefers-reduced-motion: reduce) for rm-labels | `.rm-label` in CSS + media query present |
| rm-label-name renders the displayName | `.rm-label-name` class present |
| rm-label-status renders กำลังทำ/พัก tag | `.rm-label-status` + copy strings present |
| You character has reduced-motion label | `รอคุณ` + `ปกติ` copy present |
| (CSS structure) display:none override under reduce | Source contains `display:block` inside reduce media query |

### AC2 — Keyboard + screen-reader access (6 tests)
| Test | Assertion |
|---|---|
| map-stage has role="img" | `role="img"` present in source |
| map-stage aria-label contains summary | `sceneAriaLabel` var + Thai summary copy |
| AgentScout renders as button | `type="button"` + `btn--map-agent-${agent.role}` testid |
| You has btn--map-agent-you testid | Testid present |
| AgentScout has meaningful aria-label | `ariaLabel` + `cfg.displayName` + `cfg.roleLabel` |
| You aria-label describes gates | `gate รอตรวจสอบ` copy |

### AC3 — Error state (3 tests)
| Test | Assertion |
|---|---|
| Error copy matches /status verbatim | `โหลดข้อมูลจาก Linear ไม่ได้:` |
| SCENE renders before error (night background always) | Both `dangerouslySetInnerHTML={{ __html: SCENE }}` and error testid present |
| Error testid | `error-text--status-map` |

### AC4 — Loading state (3 tests)
| Test | Assertion |
|---|---|
| Loading has role="status" aria-live="polite" | Both ARIA attributes present |
| Loading text | `กำลังโหลดแผนที่แคมป์` |
| Loading testid | `loading--status-map` |

### AC5 — Empty states (8 tests)
| Test | Assertion |
|---|---|
| DeliveryPanel empty | `ยังไม่มีสตอรีในโปรเจกต์` |
| BacklogPanel empty | `ไม่มี story ใน backlog` |
| GatesPanel empty | `ไม่มีงานรออนุมัติจากคุณตอนนี้` |
| EpicProgressPanel empty | `ยังไม่มีสตอรีใน epic นี้` |
| EpicUpNextPanel empty | `คิวว่าง` |
| EpicBoardPanel empty | `ยังไม่มีสตอรีใน epic นี้` |
| ScopeSwitcherPanel no epics | `ยังไม่มี epic ในโปรเจกต์` |
| ScopeSwitcherPanel filtered empty | `ไม่มี epic ที่ตรงกับตัวกรอง` |

### AC7 — Deep-link scope fix (3 tests - note: AC6 is browser/perf measurement, no unit test)
| Test | Assertion |
|---|---|
| engineReady state declared | `engineReady` + `setEngineReady` |
| setEngineReady(true) called on engine start | `setEngineReady(true)` in source |
| engineReady in scope-effect deps + S7 fix comment | `engineReady` + `S7 fix` |

## Browser-only verification required (not in automated suite)

The following require a real browser session on the Staging URL:

### AC1 (reduced-motion)
- Enable OS reduced-motion setting; verify rm-labels appear below each agent character
- Confirm no animation plays

### AC2 (keyboard)
- Tab through the map; confirm You gets focus first → agents → overlay chips
- Activate an agent with Enter/Space; confirm Crew panel opens
- Verify focus ring is visible (green 2px outline)
- Use VoiceOver/NVDA; confirm `role="img"` scene summary is announced

### AC2 (contrast)
- Status pill text (teal/amber on dark background): axe/Lighthouse AA check
- rm-label text: `#F1F6FB` on `rgba(16,26,42,.9)` — visually passes; measurement not performed

### AC6 (CWV)
- LCP, CLS, INP: not measured (requires Lighthouse on Staging URL); label "not measured"
- Bundle sizes: measured from `.next/static/chunks/` (see delivery.md for numbers)
