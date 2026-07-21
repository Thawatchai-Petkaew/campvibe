# CampVibe AI — Gap Closure & Data Layer
## ปิดช่องว่าง "ภาษาผู้ใช้จริง ↔ ระบบค้นหา" ของน้องกองไฟ: คำตอบเรื่อง Knowledge Graph, LangChain และข้อมูลที่ต้องเพิ่ม

> ใช้คู่กับ `campvibe-utterance-corpus.md` (356 utterances, P1–P18 + หมวดเสริม A–J) และ `campvibe-conversation-to-booking-research.md` (pattern taxonomy + D1–D9 + tool contract) — **สองไฟล์นี้ยังไม่อยู่ใน repo (แนบจากเจ้าของ) แนะนำนำเข้า `docs/research/` คู่กับไฟล์นี้**
> การวิเคราะห์อิงจากการสแกนโค้ดจริงบน `dev` (HEAD `8aff245`): `prisma/schema.prisma` ทั้งไฟล์ (907 บรรทัด, 22 migrations), ชั้น AI ทั้งหมด (`lib/ai/*`, `app/api/ai/chat/route.ts`), ADR-013, และ spec ทั้ง 3 epic ใน `docs/specs/ai-assistant/`
> คำถามตั้งต้นจากเจ้าของ: (1) คำถามผู้ใช้ส่วนใหญ่เป็น "ภาษา by the way" — อ้อมก่อนแล้วค่อยโยงเข้าข้อมูล หรือถามในมุมที่ระบบค้นไม่ได้ — จะปิดช่องว่างยังไงให้**คุยได้และปิดงาน (จอง) ได้** (2) จำเป็นต้องใช้ Knowledge Graph ไหม (3) จำเป็นต้องใช้/ลอก LangChain ไหม (4) ต้องเพิ่มข้อมูลส่วนไหน

---

## 0. คำตอบสั้น (TL;DR)

1. **ช่องว่างไม่ใช่ปัญหา NLU — คือปัญหา "intent ไม่มีที่ลงจอด"** — LLM + tool description ที่ฝัง synonym ไทยแปลง "อยากหนีเมืองไปฮีลใจ" → intent ได้อยู่แล้ว แต่แปลเสร็จแล้วไม่มีอะไรให้เรียก: search รับได้แค่ province/price/taxonomy-ทีละโค้ด/petFriendly ไม่มี facet layer, ไม่มี conversation state, ไม่มีข้อมูล derived (เงียบ/เหมาะครอบครัว/หมอก/ยุง) แม้แต่ field เดียว → การลงทุนต้องเทไปที่ **semantic data layer** ไม่ใช่เปลี่ยนโมเดลหรือ framework
2. **Knowledge Graph (graph DB / GraphRAG): ยังไม่จำเป็น** — โครง entity เป็นดาวตื้น 2–3 hop รอบ CampSite, ontology นิ่ง; Postgres + ตาราง mapping ("KG-lite") ตอบ corpus ได้ครบ (§3)
3. **LangChain: ไม่จำเป็น และไม่ควร migrate; ลอกทั้ง repo ก็ไม่ควร** — agent loop ที่เขียนเอง (CAM-415/416) คือแก่นเดียวกับ AgentExecutor แต่แน่นกว่าและผ่าน security review แล้ว สิ่งที่ควรทำคือ **pattern study 1 วัน** (StateGraph / Checkpointer / Interrupt) + ยกระดับ prompt เป็น **Answer-Policy 3 โซน** ซึ่งตอบโจทย์ "คำถามที่ไม่ต้องเข้าถึงข้อมูล ตอบทั่วไปก่อนได้" ตรงๆ (§4)
4. **ข้อมูลที่ต้องเพิ่ม แบ่ง 3 เฟส** (§5): เฟส 1 ไม่ต้องเก็บข้อมูลใหม่จากโลกจริงเลย ปลดล็อก ~ครึ่ง corpus (state + tool v2 + facet-from-rules + date resolver + region normalize + bulkAvailability); เฟส 2 คือข้อมูลที่ต้อง "หามาใหม่" (review mining, host form, KB ภูมิภาค, policy tiers, lexicon); เฟส 3 คือ capability ใหม่ (memory, watcher, gear, trip)
5. **ชิ้นที่ขาดที่อันตรายสุดคือ eval harness** — ยังไม่มี golden tool-call test เลยสักไฟล์ ทุกการแก้ prompt/tool วันนี้คือการเดา ต้องแปลง eval set 40 ข้อ (research เดิม §5) เป็น CI **ก่อน**เริ่มเฟสไหนก็ตาม (§6)

---

## 1. สถานะระบบปัจจุบัน (ตรวจจากโค้ดจริง, 2026-07-20)

### 1.1 สิ่งที่มีแล้วและใช้การได้

| ชั้น | สิ่งที่มี | ที่อยู่ |
|---|---|---|
| Agent loop | bounded loop สูงสุด 4 รอบ / 3 tool calls ต่อรอบ / 6 ต่อ turn / deadline 40s, รอบสุดท้ายบังคับ prose (`tool_choice:'none'`) | `lib/ai/openrouter-client.ts` (CAM-416) |
| Tools (7 ตัว, read-only ทั้งหมด) | `searchCampsites`, `checkAvailability`, `getCampDetail`, `getMyBookings`, `getMyBookingDetail`, `getMyProfile`, `getMyWishlist` — zod validate ทุก call, tier guest/authed, `userId` ผูกจาก session ฝั่ง server | `lib/ai/tools/*`, `lib/ai/tool-registry.ts` |
| Chat persistence | `ChatConversation` + `ChatMessage` (role/seq/contentText/blocks JSON), เก็บเฉพาะ user ล็อกอิน, โหลด 10 ข้อความล่าสุดต่อ turn, hard-delete + retention 180 วัน | CAM-414 / ADR-013, `lib/ai/conversation-store.ts` |
| Guardrails | injection fencing (`sanitize.ts` + `<user_message>` DATA), ห้ามตอบ availability โดยไม่เรียก tool, PII masked (เบอร์โทร), rate limit 30/15min | `lib/ai/sanitize.ts`, `build-turn-messages.ts` |
| ภาษาไทยเบื้องต้น | วันที่สัมพัทธ์ (พรุ่งนี้/เสาร์นี้) แก้ใน **prompt** (inject วันที่วันนี้ + วันภาษาไทยทุก turn); จังหวัดไทย→อังกฤษผ่าน `ThailandLocation` | `formatTodayContextLine`, `resolveProvinceForSearch` (CAM-404/408) |
| อยู่ระหว่างทาง | CAM-412 streaming (In Progress), CAM-449 camp-detail fields + `weekendAvailability` + `distanceFromBangkokKm` (In Review) | `docs/specs/ai-assistant/` |

### 1.2 สิ่งที่ "ไม่มีเลย" (ยืนยันจาก schema + grep ทั้ง repo)

| หมวด | ไม่มี | ผลกระทบต่อ corpus |
|---|---|---|
| Derived data | facet/score table ต่อลาน · segment score · evidence | P2, P4, P7, หมวด H ตกเกือบหมด |
| State | conversation state เชิงโครงสร้าง (`last_results`/`focus`/`active_flow`) — "ความจำ" คือ replay ข้อความ 10 อันเท่านั้น | P1 "เอาอันที่สอง", P11, P16 |
| Tool params | `excludeIds` · `sort` (ฝั่ง AI tool) · multi-code ต่อ facet group (OR ไม่ได้ — "ริมน้ำหรือชายหาด" จะโดน AND แล้วพลาด) · batch detail · compare | P1, P2, P4, P5 |
| Calendar/aggregate | materialized availability calendar · ตารางวันหยุดไทย · `resolveDates` แบบโค้ด | P3, P4, P12 |
| Policy/เงิน | cancellation tier (มีแค่ enum 4 ค่า) · fee breakdown (มีแค่ `extraFeeAmount` ก้อนเดียว) · deposit model | P14 (no-hallucination zone ที่ไม่มีข้อมูลให้ตอบ) |
| สภาพพื้นที่ | ฤดู/อุณหภูมิ/ยุง/หมอก/ทาก/ลม ต่อลานหรือต่อภาค | หมวด C, P17, P18 |
| Region | `Location.region` เป็น free-string nullable, ไม่มี rollup ราย "ภาค"; **`ThailandLocation` seed จังหวัดไว้ ~12 จาก 77** — จังหวัดนอก list = เข้าใจภาษาถูกแต่ค้นไม่เจอ (bug เงียบที่มีผลแล้ววันนี้) | P18, หมวด J |
| Party | `guests` ก้อนเดียว — ไม่มี adults/children/pets/vehicles | P8 |
| อื่นๆ | gear KB · `EquipmentRental` · user preference/memory · watcher · trip entity · **eval harness ใดๆ** | P9, P10, P15, P17, หมวด I |

---

## 2. วินิจฉัย: corpus 356 ข้อ ติดที่อะไร

จำแนกตาม "ตัวบล็อกหลัก" (ตัวเลขเป็น**ประมาณการ**จากการไล่กลุ่ม — หนึ่งข้ออาจติดหลายตัว นับตัวที่บล็อกก่อน):

| ตัวบล็อก | กลุ่มใน corpus | ~สัดส่วน | สิ่งที่ขาด | ประเภทงาน |
|---|---|---|---|---|
| ไม่มี facet/derived attribute ให้ intent ลงจอด | P2 เปรียบเทียบ, P4 บางส่วน, P7 อารมณ์/เป้าหมาย, หมวด H persona×style, หมวด C บางส่วน | **~25%** | facet layer + segment score + evidence | data model + pipeline (เฟส 1–2) |
| ต้องเก็บข้อมูลใหม่จากโลกจริง | หมวด C (ยุง/น้ำอุ่น/สัญญาณ), P14 นโยบาย/เงิน, หมวด I gear, หมวด J region | ~20% | condition pixels, policy tiers, gear KB, RegionSeasonProfile | host form + review mining + curated KB (เฟส 2) |
| ไม่มี conversation state | P1 อ้างอิงย้อน, P5 (ตัวที่แสดงแล้ว), P11 แก้กลางทาง, P16 แทรกเรื่อง | ~15% | D1 state store + `excludeIds` + slot editing | โค้ดล้วน (เฟส 1) |
| ไม่มี deterministic service | P3 เวลาเบลอ, P4 superlative, P12 aggregate | ~12% | `resolveDates` + วันหยุด + availability calendar + region rollup | โค้ด + ตารางเล็ก (เฟส 1) |
| Capability ใหม่ | P9 watcher, P10 memory, P15 trip, หมวด E after-sale | ~12% | D5/D7/D8 | feature ใหม่ (เฟส 3) |
| ความทนทานภาษา/เสียง | หมวด B typo/สแลง, หมวด G voice | ~6% | lexicon + eval (LLM รับส่วนใหญ่ได้อยู่แล้ว) | data + eval |
| ตอบได้แล้ววันนี้ | หมวด A เส้นทางตรง, หมวด F guardrail (มีแล้ว), หมวด I ส่วน general knowledge | ~10% | — | — |

**ข้อสรุปเชิงวินิจฉัย — สถาปัตยกรรม 2 ชั้น:**

1. **LLM = ตัวแปลภาษา → intent** — มีแล้ว ใช้การได้ ภาษา "by the way" ("มือใหม่หัดกาง", "งานตี้", "หนีเมืองไปฮีลใจ") คือสิ่งที่โมเดลยุคนี้ถนัดที่สุดอยู่แล้ว ไม่ต้องสร้าง NLU pipeline แยก
2. **Semantic data layer = ตัวรับ intent** — ยังไม่มี และคือที่ที่เงินลงทุนควรไปเกือบทั้งหมด: facet, state, lexicon, calendar, condition data

คำว่า "คำถามที่เป็นไปไม่ได้ที่จะค้นในมุมภาษานั้น" ในโจทย์ จึงแปลใหม่ได้ว่า: **เป็นไปได้ทันทีที่มี field ให้ค้น** — "ที่ไหนเงียบสุด" เป็นไปไม่ได้วันนี้เพราะไม่มี `quietness` ไม่ใช่เพราะภาษากำกวม

---

## 3. Knowledge Graph — จำเป็นไหม?

### คำตอบ: ยังไม่จำเป็น (ไม่เอา graph DB, ไม่เอา GraphRAG ในเฟสนี้) — ให้สร้าง "KG-lite" เป็นตาราง mapping ใน Postgres

สิ่งที่มักอยากได้จากคำว่า Knowledge Graph ในเคสนี้ แยกได้ 3 อย่าง — ทุกอย่างทำแบบ relational ได้:

| ความต้องการจริง | รูปแบบใน KG | รูปแบบ relational ที่เพียงพอ |
|---|---|---|
| Derived attribute พร้อมที่มา ("เงียบ เพราะรีวิว 12 คนพูดตรงกัน") | node Camp —hasFacet→ Quiet | `CampFacetScore(campSiteId, facet, score, confidence, evidence[])` |
| Concept mapping (mood→facet, segment→facet weight, gear→เงื่อนไข) | edge ontology | `ConceptMapping` / rule tables — **นี่คือ knowledge graph ฉบับ adjacency list** แก้ได้เป็น data ไม่ต้อง deploy โค้ด |
| Synonym ภาษาพูด → โค้ดระบบ ("งานตี้"→amplifiedSound, "หนีเมือง"→quiet+nature) | — | ตาราง lexicon → inject เข้า tool description/prompt |

### เหตุผลที่ graph engine ยังไม่คุ้ม

1. **โครง entity ตื้น** — ทุก query ใน corpus 356 ข้อ ลดรูปเหลือ: filter + facet lookup + aggregate + join evidence รอบ CampSite ไม่เกิน 2–3 hop, ontology นิ่ง; จุดแข็งของ graph DB (variable-depth traversal, ontology วิวัฒน์เร็ว, path query) **ไม่ปรากฏใน corpus แม้แต่ข้อเดียว**
2. **GraphRAG ออกแบบมาสำหรับ corpus เอกสาร unstructured** — ข้อมูล CampVibe เป็น first-party structured; retrieval ที่ต้องใช้จริงมีแค่เอกสารนโยบาย + quote รีวิว (RAG ธรรมดา)
3. **ต้นทุน ops จริง** — infra ใหม่, sync pipeline สองทาง (Postgres↔graph), ภาษา query ใหม่ให้ทีมดูแล — ขัด Iron Rule "Lean" ในขณะที่ Postgres ตอบได้ครบ
4. **P15 (ทริปหลายจุด)** ดูเผินๆ เหมือน graph แต่คือ distance matrix + ordering (haversine มีแล้วใน `lib/geo/distance.ts` จาก CAM-449) — ถ้าโตจริงค่อย pgRouting ซึ่งก็ยังไม่ใช่ semantic KG

### เงื่อนไขกลับมาทบทวน (ADR-ready — บันทึกเมื่อเข้า Discovery รอบถัดไป)

- (a) เกิด query multi-hop ลึกแบบ variable depth เช่น recommendation ข้ามพฤติกรรมผู้ใช้จำนวนมาก (collaborative filtering ข้าม entity)
- (b) ontology facet โตจนความสัมพันธ์ระหว่าง concept เป็นเครือข่ายจริง (ไม่ใช่ตาราง mapping แบนๆ อีกต่อไป)
- (c) trip planning ต้อง route optimization บนโครงข่ายถนนจริง

---

## 4. LangChain / LangGraph — จำเป็นไหม? ลอกมาไหม?

### 4.1 คำตอบ: ไม่ใช้ framework, ไม่ migrate, ไม่ลอกทั้ง repo

1. **ของที่มีคือแก่นเดียวกันแต่แน่นกว่า** — `openrouter-client.ts` + `tool-registry.ts` คือ agent executor แบบ hand-rolled: bounded loop, zod validate, tier auth ผูก userId ฝั่ง server, injection fencing, spend/deadline caps — ทั้งหมดผ่าน security review แล้ว migrate = เขียนของที่ทำงานอยู่ทิ้งเพื่อ abstraction ที่หลวมกว่า และ**ไม่ได้ capability ใหม่แม้แต่ตัวเดียว** (LangChain ไม่ได้ให้ facet data / state / lexicon ซึ่งคือช่องว่างจริงตาม §2)
2. **Research เดิม (§4.5) ตัดสินไปแล้วและยังถูกต้อง** — LangChain classic มี abstraction overhead สูง; ADR-013 เลือก bounded loop เองไปแล้ว การกลับคำต้องมีหลักฐานใหม่ ซึ่งไม่มี
3. **ลอกทั้งโครงจาก repo: ไม่ควร** — repo LangChain/LangGraph เป็น general-purpose framework: provider abstraction หลายสิบเจ้า, runnable/graph engine, serialization, callback system, integrations นับร้อย — ~95% ของความ general นั้นคือ dead weight สำหรับเรา (1 provider, 7 tools, 1 โดเมน) การยก architecture แบบ framework มาไว้ในแอป = รับภาระ maintain "ท่อของ framework" โดยไม่มีผู้ใช้ framework; ข้อเท็จจริงสำคัญ: **เราลู่เข้าหาสถาปัตยกรรมเดียวกับเขาไปแล้วโดยอิสระ** (bounded loop + tool registry + schema validation ≈ AgentExecutor + max_iterations) ส่วนที่ยังขาด (facet data, lexicon ไทย, เนื้อ state, eval corpus) **ไม่มีอยู่ใน repo เขาเลย** — มันคือ data ของโดเมนเรา ลอกจากใครไม่ได้ (license เขาเป็น MIT ลอกได้ถูกกฎหมาย — ต้นทุนจริงคือ maintenance ไม่ใช่ลิขสิทธิ์)
4. **สิ่งเดียวที่ ecosystem เขามีแล้วเราไม่มีคือ observability** (LangSmith) — ใช้ standalone ได้ (Langfuse/LangSmith trace ไม่ผูก framework) ควรเพิ่มเป็นชิ้นแยกพร้อม eval harness (§6)
5. **LangGraph ค่อยทบทวนเมื่อถึงเฟส 3** (watcher P9 = durable workflow ข้ามวัน + resume) — ตรรกะเดียวกับเรื่อง KG: อย่าซื้อ infra ก่อนมีปัญหาที่ infra นั้นแก้

### 4.2 Answer-Policy 3 โซน — ตอบประเด็น "บางคำถามไม่ต้องเข้าถึงข้อมูล ตอบทั่วไปก่อนได้"

ประเด็นนี้ถูกต้องและเป็นช่องว่างจริง: ตอนนี้ system prompt ปล่อยให้โมเดล "เดาเอง" ว่าเมื่อไหร่ต้องเรียก tool ให้ยกระดับเป็นนโยบายชัดเจน (ก็อปแนวคิด router ของ LangGraph มาเป็น prompt policy + โค้ด ไม่ใช่ framework):

| โซน | ประเภทคำถาม | นโยบาย | ตัวอย่างจาก corpus |
|---|---|---|---|
| **A · General knowledge** | ความรู้แคมป์ทั่วไป: gear พื้นฐาน, ฤดูกาลภาพรวม, how-to มือใหม่ | **ตอบได้เลยไม่เรียก tool** (ประหยัด budget 6 calls/turn + เร็ว) แล้ว**ปิดท้ายด้วยสะพานกลับสู่ข้อมูลจริง** ("อยากให้เช็กไหมว่าลานไหนมีเต็นท์ให้เช่า?") | P17 ข้อ 311–316, 327–333 ("มือใหม่ต้องเตรียมอะไร", "งบ 3,000 ซื้ออะไรก่อน") — **ตอบได้ตั้งแต่วันนี้โดยไม่ต้องรอ data ใหม่** |
| **B · Camp-specific fact** | ข้อเท็จจริงรายลาน: ว่าง/ราคา/นโยบาย/สิ่งอำนวยความสะดวก/สภาพพื้นที่ | **ต้องเรียก tool เท่านั้น** — ไม่มีข้อมูล = ตอบ "ไม่มีข้อมูล" ตรงๆ ห้ามเดา (ขยาย no-hallucination zone ของ P14 คลุมทุก fact รายลาน) | P3, P4, P12, P14, หมวด C |
| **C · Transactional** | จอง/แก้/ยกเลิก | state machine ในโค้ด + human confirm เสมอ (ADR-013 write tier: "AI proposes, human approves") | P9, P11, หมวด F ข้อ 256 |

สิ่งที่ต้องทำจริง 3 ข้อ:

1. เขียน policy matrix นี้ลง system prompt ให้ชัด (แทนที่ implicit)
2. **eval ต้อง assert สองทาง** — โซน A assert ว่า "ไม่เรียก tool" (คุมต้นทุน+latency) เท่าๆ กับโซน B assert ว่า "เรียก tool ถูกตัว+พารามิเตอร์ถูก"
3. โซน A ทุกคำตอบปิดด้วย bridge กลับสู่ data — นี่คือกลไกที่ทำให้ "คุยได้ → ปิดงานได้" คำถาม by the way กลายเป็นทางเข้า funnel แทนที่จะเป็นทางตัน

### 4.3 Pattern study 1 วัน — อ่าน design ของ LangGraph แล้วกลั่นเป็นของเรา (ไม่ port โค้ด)

| หัวข้อใน LangGraph | กลั่นมาเป็นของเรา |
|---|---|
| **StateGraph** (node/edge + typed state) | design ของ D1 state store + booking state machine (~ร้อยบรรทัด เขียนเอง; research เดิมพูดไว้แล้ว: "LLM เป็นคนคุย ไม่ใช่คนถือเงิน") |
| **Checkpointer** (persist state ต่อ step, resume ได้) | รูปแบบเก็บ `ChatConversation.state` ต่อ turn + suspend/resume `active_flow` (P16 "แทรกเรื่องแล้วกลับมา") |
| **Interrupt / human-in-the-loop** | จุด confirm การจอง (โซน C) — ตรงกับหลักใน ADR-013 อยู่แล้ว ยืมแค่รูปแบบ "ค้าง state ไว้รอคนกด" |

---

## 5. ข้อมูล/โครงสร้างที่ต้องเพิ่ม — 3 เฟส

### เฟส 1 · ปลดล็อกสูงสุด, ไม่ต้องเก็บข้อมูลใหม่จากโลกจริง (~ครึ่งหนึ่งของ corpus)

| # | สิ่งที่เพิ่ม | รายละเอียด | ปลดล็อก |
|---|---|---|---|
| 1-1 | **Conversation state (D1)** | `state Json` บน `ChatConversation`: `last_results[{ordinal, campId, name, aiMentioned}]`, `shown_ids[]`, `focus`, `constraints{hard,soft}`, `party` — serialize เข้า system prompt ทุก turn (ตอนนี้พึ่ง replay ข้อความ 10 อันอย่างเดียว); guest ใช้ state ฝั่ง client ส่งกลับ (stateless เดิม) | P1, P11, P16 |
| 1-2 | **Tool contract v2** | `excludeIds` + `sort` + **multi-code ต่อ facet group (OR ภายในกลุ่ม)** ใน `searchCampsites`; `getCampDetails(ids[])` แบบ batch; `compareCamps(ids, criteria)` ต่อยอดจาก batch | P1, P2, P4, P5 |
| 1-3 | **`resolveDates` เป็นโค้ด + ตาราง `ThaiHoliday`** | ย้าย date resolution จาก prompt → deterministic tool คืน **date-set** ไม่ใช่ single range ("วีคเอนด์เว้นวีคของเดือนนี้", "วันหยุดยาวรอบหน้า"); วันหยุดไทย seed ได้ทันที (~20 แถว/ปี) | P3, P9, P12 |
| 1-4 | **Region normalize + seed จังหวัดครบ** | `Location.region` → ค่า normalize 6 ภาค (derive จาก province ผ่าน `ThailandLocation`/`AdminArea` ที่มีอยู่); **seed `ThailandLocation` ครบ 77 จังหวัด (ตอนนี้ ~12)** — แก้ bug เงียบ "เข้าใจภาษาถูกแต่ค้นไม่เจอ" ที่มีผลแล้ววันนี้ | P18, หมวด J + brittleness ปัจจุบัน |
| 1-5 | **Facet layer v1 (rules-only)** | `CampFacetScore` คำนวณจาก field ที่มีอยู่แล้วล้วนๆ: family (facilities+terrain+maxGuests), beginner (access DRIV + facilities ครบ), road_access, photo (มี Image kind PANORAMA), pet_detail — ยังไม่ต้องมี review mining | P2, P7, หมวด H บางส่วน |
| 1-6 | **`bulkAvailability`** | เริ่ม live-batch มี cap ก่อน (บทเรียน CAM-344: ทุก loop ที่ client คุมจำนวนรอบต้องมี MAX เช็กก่อนรัน) → ค่อย materialize เป็นตารางเมื่อ query โตจริง | P3, P4, P12 |

Prisma sketch (เฟส 1 — สเปกจริงต้องผ่าน Discovery + G2 architect):

```prisma
model CampFacetScore {
  id          String   @id @default(uuid())
  campSiteId  String
  facet       String   // family | beginner | quiet | road_access | photo | privacy | clean | pet_detail | ...
  score       Decimal  @db.Decimal(3, 2)   // 0.00–1.00
  confidence  Decimal  @db.Decimal(3, 2)
  source      String   // rules | review_mining | host_input
  evidence    Json     // [{type:'field'|'review', ref, quote?}]
  computedAt  DateTime
  campSite    CampSite @relation(fields: [campSiteId], references: [id])
  @@unique([campSiteId, facet])
  @@index([facet, score])
}

model ThaiHoliday {
  date            DateTime @id @db.Date
  nameTh          String
  isLongWeekend   Boolean  @default(false)
}

// ChatConversation: เพิ่ม  state Json?   // D1: last_results/shown_ids/focus/constraints/party
```

### เฟส 2 · ข้อมูลที่ต้อง "หามาใหม่" (data acquisition — derive จาก schema ไม่ได้)

| # | สิ่งที่เพิ่ม | แหล่งข้อมูล | ปลดล็อก |
|---|---|---|---|
| 2-1 | **Review aspect mining** → `ReviewAspect(reviewId, aspect, sentiment, quote)` | batch LLM ทับรีวิว verified (ตอนนี้รีวิวมี rating ก้อนเดียว); พิจารณาเพิ่ม structured aspect ตอนเขียนรีวิว (flywheel ระยะยาว) | facet quiet/clean/staff/family + **evidence สำหรับ P13 "ทำไมแนะนำอันนี้"** |
| 2-2 | **Camp condition pixels** → `CampSeasonCondition(campSiteId, season, mosquitoLevel, nightTempClass, fogFrequency, windExposure, leechLevel, …)` | host onboarding form (หลัก) + review mining (สอบทาน) + RegionSeasonProfile (default เมื่อ host ยังไม่กรอก) | หมวด C ("ยุงเยอะไหม/หนาวไหม/หมอกเยอะสุด"), P17 |
| 2-3 | **`RegionSeasonProfile`** (6 ภาค × 12 เดือน ≈ 72 แถว, hand-curated) | ทีมเขียนเองครั้งเดียว + ปรับตามจริง | P18 ทั้งหมวด + default ของ 2-2 |
| 2-4 | **Policy structuring** → `CancellationTier(campSiteId, daysBefore, refundPct)` + fee items | host กรอก + template ตาม enum เดิม 4 ค่า; ระหว่างยังไม่มี **ต้องตอบ "ไม่มีข้อมูล" ตรงๆ** (P14 = no-hallucination zone, honest fallback เป็นข้อบังคับ) | P14 |
| 2-5 | **Lexicon / ConceptMapping (KG-lite)** | **สกัดจาก corpus 356 ข้อนี้เอง**: mood→facet ("ฮีลใจ"→quiet+nature), segment→facet weights (สายลุย/สายชิล/งานตี้), สแลง→โค้ด — เป็น data ที่แก้ได้โดยไม่ deploy, inject เข้า tool description/prompt | P7, หมวด B, H |
| 2-6 | **Party model** | `guests` ก้อนเดียว → `adults/children/pets/vehicles` ทั้ง search และ booking | P8 |

Prisma sketch (เฟส 2):

```prisma
model ReviewAspect {
  id        String  @id @default(uuid())
  reviewId  String
  aspect    String  // quiet | clean | staff | family | photo | ...
  sentiment Int     // -1 | 0 | +1
  quote     String? @db.Text
  review    Review  @relation(fields: [reviewId], references: [id])
  @@index([aspect, sentiment])
}

model CampSeasonCondition {
  id            String   @id @default(uuid())
  campSiteId    String
  season        String   // hot | rainy | cool  (หรือ monthBucket)
  mosquitoLevel String?  // NONE | LOW | MED | HIGH
  nightTempClass String? // WARM | MILD | COLD | VERY_COLD
  fogFrequency  String?
  windExposure  String?
  source        String   // host | review_mining | region_default
  campSite      CampSite @relation(fields: [campSiteId], references: [id])
  @@unique([campSiteId, season])
}

model RegionSeasonProfile {
  region    String   // NORTH | NORTHEAST | CENTRAL | EAST | WEST | SOUTH
  month     Int
  rainClass String
  tempClass String
  fogClass  String
  notesTh   String?  @db.Text
  @@id([region, month])
}

model ConceptMapping {
  id        String  @id @default(uuid())
  kind      String  // mood | segment | slang
  term      String  // "ฮีลใจ" | "งานตี้" | "สายลุย"
  target    Json    // {facets:{quiet:0.8,nature:0.6}} หรือ {code:"amplifiedSound"}
  active    Boolean @default(true)
  @@unique([kind, term])
}
```

### เฟส 3 · Capability ใหม่ (ต่อเมื่อเฟส 1–2 พิสูจน์ด้วย eval แล้ว)

| # | สิ่งที่เพิ่ม | หมายเหตุ | ปลดล็อก |
|---|---|---|---|
| 3-1 | **User memory (D5)** | preferences summary + episodic notes + consent/สั่งลืมได้ (PDPA ตาม `.claude/rules/ux.md`) | P10 |
| 3-2 | **Watchers (D8)** | ต้องมี push infra + guardrail "แจ้งเตือน→คนกด confirm เอง" (ห้าม auto-book); จุดที่ค่อยทบทวน LangGraph | P9 |
| 3-3 | **Gear KB (D9)** | `GearItem` + matching rules (เงื่อนไข→checklist); `EquipmentRental` ยังไม่มีในระบบ ต้องเกิดพร้อมฝั่ง host — โยง add-on ตอนจอง | P17, หมวด I ส่วนที่ผูกลาน |
| 3-4 | **Trip entity (D7)** | trip(stops[], segments[]) + distance matrix (ต่อยอด `lib/geo/distance.ts`) | P15 |

---

## 6. Eval harness — prerequisite ของทุกเฟส

สถานะปัจจุบัน: **ไม่มี golden tool-call test เลยสักไฟล์** (grep `golden`/`corpus`/`utterance`/`eval` ทั้ง repo ยืนยันแล้ว) — ทุกการปรับ prompt/tool/model วันนี้คือการเดา ขัดหลัก metric honesty (`.claude/rules/performance.md`)

สเปกที่เสนอ:

1. **แปลง eval set 40 ข้อ** (research เดิม §5) เป็น Vitest suite: replay utterance (+ state จำลองสำหรับข้อ ctx/flow) ผ่าน agent loop จริง → assert (a) tool ที่ถูกเรียก + พารามิเตอร์, (b) โซน A assert "**ไม่เรียก tool**", (c) ข้อ guardrail (34/35/40 + หมวด F) ต้องผ่าน 100%
2. **เกณฑ์ผ่าน**: tool-call ถูกตัว+ถูกพารามิเตอร์ ≥95% ของชุด, guardrail = 100%, ไม่มี hallucination ในโซน B ที่ข้อมูลไม่มี (ต้องตอบ "ไม่มีข้อมูล")
3. **ขยายจาก corpus 356 → ~2,000** ด้วย LLM paraphrase ตามคำแนะนำใน corpus (ห้ามเปลี่ยน expected tool-call ของกลุ่ม) — ใช้เป็นชุด regression รายรอบ ไม่ใช่รายคอมมิต (ต้นทุน)
4. **Observability**: เพิ่ม trace (Langfuse หรือเทียบเท่า, standalone) พร้อมกัน — ดู tool-call จริงต่อ turn, token, latency ต่อโซน
5. **ลำดับการใช้**: รัน baseline ก่อนแก้อะไร → ได้ตัวเลขจริงว่า corpus ตกกี่ % ต่อกลุ่ม (แทนที่ประมาณการใน §2) → จัดลำดับเฟสตามข้อมูลจริง → รันซ้ำหลังทุก story
6. **โมเดล**: gpt-4o-mini คือจุดอ่อนสำหรับไทย colloquial + tool planning หลายชั้น แต่**อย่าเพิ่งอัปเกรด** — วัดด้วย eval ก่อนแล้วค่อยตัดสิน (คันโยกที่ถูกกว่า: tool contract + lexicon; `OPENROUTER_MODEL` เปลี่ยนได้ผ่าน env อยู่แล้ว ทดลอง A/B บน eval ได้ทันที)
7. **อย่าอัด few-shot 356 ข้อเข้า prompt** (budget `MAX_PROMPT_CHARS=12000`, `max_tokens=680`) — corpus มีไว้เป็น eval + แหล่งสกัด lexicon ไม่ใช่ prompt

---

## 7. Story candidates (input สำหรับ Discovery รอบถัดไป — เรียงตามลำดับแนะนำ)

> ยังไม่ใช่ ticket — ทุกตัวต้องผ่าน `/new-feature` + Discovery + G1 ตาม Iron Rules

| ลำดับ | Candidate | เฟส | เหตุผลที่มาก่อน |
|---|---|---|---|
| 1 | Eval harness v1 (40 ข้อ + zone assertions + baseline report) | §6 | ทุกอย่างหลังจากนี้วัดผลได้; ได้ตัวเลขจริงแทนประมาณการ |
| 2 | Seed `ThailandLocation` ครบ 77 จังหวัด | 1-4 | bug เงียบที่มีผลกับผู้ใช้แล้ววันนี้, งานเล็ก |
| 3 | Answer-Policy 3 โซน ลง system prompt + eval | §4.2 | ปลดล็อกหมวด general knowledge ทันทีโดยไม่ต้องรอ data; คุมต้นทุน |
| 4 | Conversation state D1 (`state Json` + inject ต่อ turn) | 1-1 | ปลดล็อก P1/P11/P16 (~15%) — โค้ดล้วน |
| 5 | Tool contract v2 (excludeIds/sort/OR/batch/compare) | 1-2 | ต่อยอด state; ปลดล็อก P2/P5 |
| 6 | `resolveDates` + `ThaiHoliday` | 1-3 | ปลดล็อก P3; ลด error วันที่จาก prompt-only |
| 7 | Region normalize + facet v1 (rules-only) + bulkAvailability | 1-4/1-5/1-6 | ปิดเฟส 1 |
| 8 | Lexicon/ConceptMapping จาก corpus | 2-5 | ยกความแม่นภาษา; data-only iterate ได้เร็ว |
| 9 | Review aspect mining + condition pixels + RegionSeasonProfile | 2-1/2-2/2-3 | เริ่ม data acquisition (host form = งานฝั่ง product ด้วย) |
| 10 | Policy tiers + party model | 2-4/2-6 | ปิด P14/P8 |
| 11+ | Memory / watcher / gear / trip | เฟส 3 | หลัง eval พิสูจน์เฟส 1–2 |

---

## 8. อ้างอิง

- `campvibe-utterance-corpus.md` — corpus 356 utterances (แนบจากเจ้าของ 2026-07-18; แนะนำนำเข้า repo)
- `campvibe-conversation-to-booking-research.md` — pattern taxonomy P1–P18, D1–D9, tool contract, eval set §5 (แนบจากเจ้าของ 2026-07-18)
- `docs/adr/ADR-013-ai-chat-persistence-agency-foundation.md` + `docs/research/ai-chat-architecture-adr-013.html` — สถาปัตยกรรม chat ปัจจุบัน (bounded loop, 3 tiers, persistence)
- โค้ดที่สแกน: `prisma/schema.prisma`, `lib/ai/*`, `lib/campsite-filters.ts`, `lib/campsite-availability.ts`, `app/api/ai/chat/route.ts`, `docs/specs/ai-assistant/**`
- LangGraph concepts (pattern study §4.3): StateGraph / Checkpointer (persistence) / Interrupt (human-in-the-loop) — https://langchain-ai.github.io/langgraph/concepts/
- แนวทาง multi-turn eval + golden tool calls: ดู Sources ท้าย `campvibe-conversation-to-booking-research.md`

*จัดทำ 20 ก.ค. 2026 · วิเคราะห์จากโค้ดจริง `dev@8aff245` · ตัวเลขสัดส่วนใน §2 เป็นประมาณการ (metric honesty) — แทนที่ด้วยตัวเลขจริงเมื่อ eval harness (§6) รัน baseline แล้ว*
