---
artifact: epic
feature: discovery-search
epic: camper-detail-reviews (CAM-34)
status: In Progress
version: v2
updated: 2026-06-23
---
# Camper: detail & reviews (CAM-34)

## Why
A Camper decides whether to book on the strength of the detail page — average rating, review count, and what past guests actually wrote. Today that signal is faked (hardcoded "4.8" / "12 reviews"), so the decision rests on false data and trust erodes. This epic makes the detail page show real, computed review signal. · **KPI:** the hardcoded "4.8" / "12 รีวิว" are gone from every production detail page; a campsite with ≥1 review shows an average computed from real `Review` rows.

## Scope
- In:
  - **CAM-79** — show the real average rating + review count + the latest 10 reviews on `/campgrounds/[slug]` and the booking widget; empty/error states; remove the hardcoded values from `CampgroundDetailClient.tsx`.
- Out:
  - Writing/submitting a review (POST already exists, verified-stay gated) → C-1.4.
  - Sorting search results by real rating → **CAM-76** (sibling story, Discovery & Search).
  - Star-breakdown histogram, working "ดูรีวิวทั้งหมด" modal/pagination, review photos, AI review summary → **C-2.6 / C-2.7 / C-2.8**.
  - Fake "4.8" still shown on the **listing card** (`CampgroundCard.tsx`) and **map popup** (`MapComponent.tsx`) → follow-up (listing-surface, not a detail page; fold into CAM-76 or a new ticket).

## Stories
| CAM-id | Story | Role (current) | Status |
|---|---|---|---|
| CAM-79 | แสดงรีวิวจริงและดาวเฉลี่ยบนหน้า detail (real avg + review list on detail) | ux-designer → frontend → qa → security → devops | In Progress |

## Links
`../feature.md` · Master-Plan item (`docs/project/master-plan.md`) · product-plan C-2 reviews (`docs/project/product-plan.md`) · ADRs: `docs/adr/*` · related sibling: CAM-76 (sort by rating)

## Changelog
- v2 (2026-06-23) — filled stub: Why+KPI, scope (in/out incl. card/map fake-rating follow-up), CAM-79 rollup. Epic entered In Progress with CAM-79.
- v1 (2026-06-23) — epic scoped (scaffold stub)
