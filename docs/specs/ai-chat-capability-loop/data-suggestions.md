# Data-gap suggestion ledger — AI Chat Capability Loop

Append-only log of **composable attribute-group** suggestions raised by the `/ai-chat-improve` MAP step, when a real concept-miss could NOT be served by mapping to existing filter data.

**Rules (owner, 2026-07-25):**
- A suggestion fires only when a concept **cannot** map cleanly to existing codes, OR the existing map is non-discriminating (returns ~everything).
- **Never a standalone concept-flag.** Suggest a **group of primitive, composable attributes** that combine at query time to serve the intent — so the same primitives serve other intents too. (e.g. suggest `hasHotWater` + `isFlatGround` + `hasOnSiteHost`, never a `beginnerFriendly` boolean.)
- **Always name the data group / entity** each attribute belongs to (which entity it hangs off + which existing registry cluster it extends, or a new named cluster) — so related attributes are captured together, not scattered, and it slots into the Capability Registry structure (Policy Pixels / Party Pixels / …). If an attribute extends an EXISTING group (e.g. a Facility code), say so instead of inventing a new field.
- Each suggestion is **optional** — the owner picks or declines. A picked suggestion becomes an L3 schema story (G1/G2). This ledger is the audit trail of what was ever suggested, and the demand rank for Phase 3.
- Status: `suggested` → `picked` (→ links to the CAM story) / `declined` (with a one-line reason).

| Date | Concept (source miss) | Why it can't map today | Suggested composable attribute-group (primitives) | Data group / entity | Serves-also | Freq (cycles) | Status |
|---|---|---|---|---|---|---|---|
| 2026-07-25 | **มือใหม่** (cycle-1, staging: "ลานกางเต้นสำหรับมือใหม่" → `keyword:มือใหม่` → 0; naive facility-map returns 475/475 = non-discriminating) | Existing facilities (SHOW/ELEC/CAFE/WIFI) are too coarse — every camp has one. The discriminating attributes (hot water, level ground, on-site host, access difficulty) are not captured. | `hasHotWater` (น้ำอุ่น) · `isFlatGround` (พื้นเรียบ/level site) · `hasOnSiteHost` (มีเจ้าหน้าที่ถามได้) · `accessDifficulty` (ขับถึง vs ต้องเดินเข้า, finer than campSiteType) | **"Comfort & Access cluster" on `CampSite`** (a new registry pixel-group, sibling of Policy Pixels). Exception: `hasHotWater` should EXTEND the existing **Facility** MasterData group (add a `HOTW` code) rather than a new CampSite bool — a facility, not a camp trait. | "สายสบาย", "พาผู้ใหญ่/เด็กเล็กไป", "ครั้งแรก", glamping intents | 1 | suggested |

> Research provenance for มือใหม่: beginner-camp guidance (Hipcamp / ReserveAmerica / Virginia DCR, 2026-07-25) — beginners prioritise hot showers, flat ground, an on-site host, a developed car-accessible campground, potable water, electric hookups.
