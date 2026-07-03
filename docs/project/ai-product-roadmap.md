# AI Product Roadmap — CampVibe

> **เอกสารมีชีวิต (living doc) — Source of Truth.** รวม requirement AI ทั้งหมด (chat A–E + Host + video/social proof F + infra) พร้อม feasibility, effort/timeline, dependency, spend และลำดับ release train. Requirement ใหม่เข้ามา → เติมลงตาราง → จัด train.
>
> **สถานะ:** planning artifact — docs เท่านั้น ยังไม่ build/ไม่ spend. Epic Linear = **CAM-266**. Visual คู่กัน: `docs/design/ai-product-roadmap.html`.
> **อัปเดตล่าสุด:** 2026-07-01

---

## 1. Intake process (requirement ฟุ้ง → roadmap)
1. Owner โยน requirement (ฟุ้งได้) → เราทำ discovery สั้น ๆ ให้เป็น use case ที่จับต้องได้.
2. เติม 6 ช่อง: **feasibility · effort · depends-on · spend? · release train · status**.
3. วางลงตาราง §3 + จัดเข้า train §4. ถ้าเปลี่ยนลำดับ/ขอบเขต → บันทึกใน §6 decisions log.
4. เมื่อจะเริ่ม train ไหน → ค่อยสร้าง Linear story ของ train นั้น + ADR/wireframe ที่เกี่ยว (ไม่สร้าง backlog ล่วงหน้าทั้งหมด).

## 2. Scales (นิยามคงที่ เพื่อประเมินสม่ำเสมอ)
**Effort (AI-assisted solo delivery):**
| ระดับ | ระยะโดยประมาณ | ความหมาย |
|---|---|---|
| **S** | ~0.5–1 สัปดาห์ | 1 PR เล็ก, ไม่มี migration หรือ migration ตรงไปตรงมา |
| **M** | ~1–2 สัปดาห์ | หลาย PR / migration + UI |
| **L** | ~3–5 สัปดาห์ | data model + infra + หลาย story |
| **XL** | ~6+ สัปดาห์ | subsystem ใหม่ (เช่น trip planner + routing) |

**Feasibility:** 🟢 พร้อม (data+API มีแล้ว) · 🟡 ต้อง prep (มี gap/dependency ภายใน) · 🔴 ติดข้อจำกัด (ToS / spend / eligibility / ต้องพึ่ง external).

**Spend?** = มีค่าใช้จ่ายเงินจริงไหม (AI token / external API / 3rd-party) → ถ้ามี ต้อง **owner อนุมัติที่ G2** ก่อนยิงจริง.

> หมายเหตุ: ตัวเลขสัปดาห์เป็น **ประมาณการหยาบ** สำหรับจัดลำดับ ไม่ใช่คำมั่น; หลาย item ในเทรนเดียวทำคู่ขนานได้ ระยะรวมจึงสั้นกว่าผลบวกตรง ๆ.

## 3. Requirement table

### AI core / infra (ฐานของทุกอย่าง)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| PREP-1 | availability เช็ค BlockedDate + partial capacity | 🟢 | S (~1wk) | — | no | R1 | CAM-267 backlog |
| PREP-2 | price/fee ตรง total + cancellation field | 🟢 | M (~1–1.5wk) | — | no | R1 | CAM-268 backlog |
| PREP-3 | verified-stay gate ของรีวิว | 🟢 | S–M (~1wk) | — | no | R1 | CAM-269 backlog |
| AI-1 | tool registry + searchCampsites + OpenRouter client | 🟡 | M (~1.5wk) | PREP-1 | **yes (G2)** | R1 | CAM-270 backlog |
| AI-2 | agent loop + streaming + checkAvailability + getCampDetail | 🟡 | M–L (~2wk) | AI-1 | **yes** | R1 | CAM-271 backlog |
| AI-3 | chat UI + การ์ดในแชท + booking handoff | 🟢 | M (~1.5–2wk) | AI-2 | no | R1 | CAM-272 backlog |

### A · Discover (v1)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| A1 | NL compound search → การ์ด | 🟢 | S (incremental) | AI-1 | yes | R1 | planned |
| A2 | geo / near-me (ระยะขับ) | 🟡 distance calc | S–M | AI-1, lat/lng | yes | R1 | planned |
| A3 | availability transparency ("เหลือ 2/5") | 🟡 | S | PREP-1, AI-2 | yes | R1 | planned |
| A4 | "วันนี้ลานนี้ว่างไหม" (สด) | 🟢 | S | AI-2 | yes | R1 | planned |

### C · Book (v1)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| C1 | การ์ด → กดจอง (เข้า `/campgrounds/[slug]`) | 🟢 | S | AI-3 | no | R1 | planned |
| C2 | booking prep (deep-link prefill widget) | 🟡 | M | AI-2, AI-3 | yes | R1 | planned |

### B · Decide + F · Social proof / video (v1.5 → R2)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| B2 / F1 | AI สรุปรีวิว **ของเรา** ในแชท | 🟢 | M | PREP-3, AI-2 | yes | R2 | planned |
| B3 | price / cancellation Q&A | 🟡 | S | PREP-2 | yes | R2 | planned |
| B1 | เทียบ A vs B | 🟢 | M | AI-2 | yes | R2 | planned |
| VID-1 | data model `ReviewVideo` + `VideoSource` + migration | 🟢 | M | — | no | R2 | planned |
| VID-2 | oEmbed resolver + host/admin ใส่ owned video + embed + CSP | 🟡 CSP | M | VID-1 | no | R2 | planned |
| VID-3 | batch harvest job (allow-list → เก็บ metadata) + moderation | 🔴 ToS/scrape | M–L | VID-1 | **maybe (3rd-party scraper)** | R2 | planned |
| VID-4 | AI tool `getReviewMedia` + chat video cards (link-out + embed) | 🟢 | M | VID-1 | yes | R2 | planned |
| F2 | วิดีโอ TikTok/FB **harvested** = การ์ด thumbnail กด→เปิดของจริง | 🔴 | (รวมใน VID-3/4) | VID-3, VID-4 | maybe | R2 | planned |
| F3 | วิดีโอ **owned** (host/admin) = ฝัง+เล่นในแชท | 🟡 | (รวมใน VID-2/4) | VID-2, VID-4 | no | R2 | planned |

### D · Plan/Trip + E · Post-trip (R3)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| D2 | packing list (จาก terrain/facilities) | 🟢 | S | AI-2 | yes | R3 | planned |
| D3 | weather + นำทาง (ลิงก์ Google Maps) | 🟡 external | M | weather API | **yes (weather API)** | R3 | planned |
| E2 | ชวนรีวิว / แนะนำลานคล้าย | 🟢 | S–M | AI-2 | yes | R3 | planned |
| D1 | trip / route planner (multi-camp + ระยะขับ + งบรวม) | 🔴 | **XL (~6+wk)** | trip/itinerary model + distance/routing (+maps API) | **yes** | R3 | planned |

### Host / Platform (R4)
| ID | Item | Feas. | Effort | Depends on | Spend? | Train | Status |
|---|---|---|---|---|---|---|---|
| E1 | ที่เที่ยว/กิจกรรมใกล้ลาน (POI) | 🟡 external | M | POI API | **yes** | R4 | planned |
| H1 | AI listing builder (FB/รูป → ร่าง listing) | 🟡 | L | AI infra | **yes** | R4 | planned |
| H2 | FAQ auto-reply | 🟡 | M | AI infra | **yes** | R4 | planned |
| H3 | listing optimizer (แนะนำรูป/ราคา) | 🟡 | M | analytics | **yes** | R4 | planned |

## 4. Release trains (ลำดับแนะนำ)
| Train | ธีม | Items | Effort รวม (~) | Gate สำคัญ |
|---|---|---|---|---|
| **R1** ← ทำก่อน | Chat core (v1) | PREP-1/2/3 → AI-1/2/3 + A1–A4 + C1–C2 | **~8–10 สัปดาห์** | G1 scope · **G2 spend (OpenRouter)** ก่อน AI-1 ยิงจริง |
| **R2** | Decide + Social proof / video | B1/B2(F1)/B3 + VID-1/2/3/4 (F2 link-out, F3 embed) | **~7–9 สัปดาห์** | G2 spend (scraper ถ้าใช้ 3rd-party) · CSP review · ADR-010 |
| **R3** | Plan / Trip | D2, D3, E2, **D1 trip planner (XL)** | **~8–10 สัปดาห์** | data model ใหม่ (trip/itinerary) · G2 (weather/maps API) |
| **R4** | Post-trip + Host tools | E1, H1, H2, H3 | **~7–9 สัปดาห์** | G2 (POI API + AI generation) |

> ลำดับยึด **feasibility + คุณค่า**: R1 = ฐาน chat ที่พิสูจน์ demand ก่อน; R2 = social proof/รีวิว (แรงจูงใจจอง) พร้อม video; R3 = trip planner (ของใหญ่ ต้องมี data ใหม่) ทำเมื่อ chat พิสูจน์แล้ว; R4 = ต่อยอด host.

## 5. Risks / constraints (ไม่กลบเกลื่อน)
- **Availability ต้องแม่นก่อน AI** — PREP-1 (BlockedDate + partial capacity) ต้องเสร็จก่อน A3/A4 ไม่งั้นแชทตอบ "ว่าง" ผิด → double-booking.
- **Video harvested (F2/VID-3) ยังขัด ToS TikTok/FB เชิงเทคนิค** + thumbnail เป็นลิขสิทธิ์ครีเอเตอร์. ลดความเสี่ยง: allow-list แหล่งที่เลือกเอง · **link-out ไม่ rehost** · เครดิต+ลิงก์กลับ · takedown · batch ความถี่ต่ำ. Owner รับความเสี่ยงระดับนี้แล้ว. กลไก scrape (self-host vs 3rd-party = spend) เคาะที่ G2 (ADR-010).
- **Embeddings deferred** (ADR-009) — v1 ใช้ tool-use/keyword; query แนว "ฟีลดิบ เงียบ ๆ" อาจอ่อนจนกว่าจะเติม vector (content-only).
- **External API + spend** — D3 weather, E1 POI, D1 maps/routing, H1–H3 AI generation, F2 scraper (ถ้า 3rd-party) = มีค่าใช้จ่าย ต้องอนุมัติ G2.
- **CSP** — ฝัง owned video (F3/VID-2) ต้องเพิ่ม `frame-src`/`script-src` โดเมน player ใน `proxy.ts` (strict nonce CSP ปัจจุบัน).
- **AI spend gate** — ทุก item ที่ Spend=yes: ไม่ยิง API จริงจนกว่า owner อนุมัติ G2.

## 6. Decisions log
- **2026-07-01** — chat v1 = cluster **A Discover + C Book**; prep-data (PREP-1/2/3) ก่อน AI.
- **2026-07-01** — architecture (ADR-009): **ไม่ merge data**, typed tool layer over normalized DB, availability = live query, embeddings deferred (content-only).
- **2026-07-01** — video reviews **2 ชั้น**: owned (host/admin) = ฝัง+เล่นในแชท; harvested (จาก allow-list ที่เราติดตาม) = การ์ด thumbnail กด→เปิดของจริง (link-out). Harvest แบบ **batch รายเดือน** เก็บ metadata ลง DB. Owner รับความเสี่ยง ToS/link-out.
- **2026-07-01** — roadmap นี้เป็น SoT; ประเมินด้วย **S/M/L + สัปดาห์ + release train**; visual คู่ที่ `docs/design/ai-product-roadmap.html`.

## 7. Linear
- Epic: **CAM-266** "AI Camping Assistant" (project เดียวกัน).
- Stories ที่มีแล้ว: CAM-267/268/269 (PREP-1/2/3), CAM-270/271/272 (AI-1/2/3) — R1.
- R2+ stories (B*, VID-*, D*, E*, H*) = สร้าง **เมื่อจะเริ่ม train นั้น** (ไม่ pre-create backlog ทั้งหมด). ADR-010 (video) + cluster-F wireframe = ทำตอนถึง R2.

## 8. Related artifacts
- `docs/adr/ADR-009-ai-assistant-data-architecture.md` — data-arch decision.
- `docs/design/ai-search-architecture.html` — architecture visual.
- `docs/design/ai-assistant-journeys.html` — 17 use-case wireframes (A–E + Host).
- `docs/design/ai-product-roadmap.html` — visual ของเอกสารนี้.
