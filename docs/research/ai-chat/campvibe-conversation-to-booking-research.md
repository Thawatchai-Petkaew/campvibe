# CampVibe AI — Conversation-to-Booking Research
## แคตตาล็อกรูปแบบการสนทนา "ไม่ตรงไปตรงมา" ที่ต้องพาไปถึงการจองให้ได้ + ข้อมูล/โครงสร้าง/สถาปัตยกรรมที่ต้องมี

> สำหรับทีม AI ใช้วิเคราะห์และออกแบบระบบ · จุดตั้งต้นคือ 2 คำถามจริงที่ระบบปัจจุบันตอบไม่ได้:
> **(ก)** "เปรียบเทียบ อันที่ 1 และ 2 ว่าอันไหนเหมาะกับครอบครัว" **(ข)** "มีลานไหนว่างช่วงวีคเอนด์ของเดือนนี้"
> เอกสารนี้ generalize สองเคสนั้นออกเป็น 16 pattern ครอบคลุมเส้นทางสู่การจองทุกแบบที่เป็นไปได้ พร้อม data/tool/state ที่แต่ละ pattern ต้องการ และ eval set ท้ายเอกสารสำหรับใช้เป็น test suite

---

## 0. ชำแหละ 2 เคสที่ตอบไม่ได้ — มันพังตรงไหน

### เคส ก. "เปรียบเทียบ อันที่ 1 และ 2 ว่าอันไหนเหมาะกับครอบครัว"
ต้องผ่าน 3 ด่าน แล้วปัจจุบันตกทั้ง 3:

| ด่าน | สิ่งที่ต้องทำได้ | สิ่งที่ขาด |
|---|---|---|
| 1. Reference resolution | "อันที่ 1 / อันที่ 2" ชี้กลับไปที่ผลลัพธ์ล่าสุดที่เคยแสดง | ไม่มี **conversation state** ที่เก็บ last_results พร้อมลำดับ (ordinal → campId) แล้ว inject เข้า context ของ LLM ทุก turn |
| 2. Data fetch | ดึงรายละเอียดลาน 2 ตัว **ในคำขอเดียว** เพื่อเทียบ | ไม่มี tool `getCampDetails(ids[])` แบบ batch / `compareCamps(ids, criteria)` |
| 3. Derived attribute | "เหมาะกับครอบครัว" ไม่ใช่ฟิลด์ใน DB — ต้อง derive จาก amenities (ห้องน้ำสะอาด, สนามเด็กเล่น), นโยบาย (เด็ก/สัตว์เลี้ยง), ภูมิประเทศ (ราบ/ชัน), ระยะเดินจากรถ, เสียง/โซนนิ่ง, รีวิวที่พูดถึงเด็ก | ไม่มี **facet layer** (คะแนน/หลักฐานเชิงคุณลักษณะ) — ตอนนี้ AI จึงได้แต่ตอบเลี่ยงเป็น checklist ให้ผู้ใช้ไปคิดเอง (ตามภาพที่ส่งมา) |

**พฤติกรรมเป้าหมาย:** "จากที่โชว์เมื่อกี้ — ลานสนธรรมชาติ (อันที่ 1) เหมาะกับครอบครัวกว่าครับ: พื้นราบ จอดรถติดจุดกาง มีห้องน้ำแยกโซน และ 6 รีวิวล่าสุดพาเด็กไปแล้วชม ส่วนริมธารแคมป์ (อันที่ 2) วิวดีกว่าแต่ทางเดินลงน้ำชัน ไม่มีรั้วกั้น เหมาะสายคู่มากกว่า — ให้เช็ควันว่างอันที่ 1 เลยไหมครับ" + compare card

### เคส ข. "มีลานไหนว่างช่วงวีคเอนด์ของเดือนนี้"
| ด่าน | สิ่งที่ต้องทำได้ | สิ่งที่ขาด |
|---|---|---|
| 1. Temporal resolution | "วีคเอนด์ของเดือนนี้" → เซ็ตวันที่จริง {ส-อา ที่เหลือของ ก.ค.} (อาจรวมศุกร์? — ต้องมีนิยามที่ตกลงกัน) | ไม่มี date resolver ภาษาไทย (เดือนนี้/ปลายเดือน/วันหยุดยาว/ก่อนสิ้นฝน) + ปฏิทินวันหยุดราชการ |
| 2. Bulk availability | เช็คว่าง **หลายลาน × หลายช่วงวัน** ในคำขอเดียว | availability ปัจจุบันเป็นรายลาน-รายช่วง (ต้องมี `bulkAvailability(filter, dateSet)` + ตาราง calendar ที่ query ได้เร็ว) |
| 3. Ranking การนำเสนอ | คืนคำตอบแบบสรุป: "เสาร์ 25 ว่าง 4 ลาน / เสาร์ 1 ส.ค. ว่าง 7 ลาน" ไม่ dump ทั้งหมด | นโยบายการจัดกลุ่ม/เรียง + UI (availability matrix card) |

---

## 1. Pattern Taxonomy — 16 รูปแบบการสนทนาสู่การจอง

> แต่ละ pattern: ตัวอย่างคำพูดจริง (ใช้เป็น test case ได้) → เหตุที่ระบบแบบ intent-ตรงๆ ตอบไม่ได้ → ข้อมูล/ความสามารถที่ต้องมี
> อิงกรอบจากงาน survey ด้าน conversational search (การจัดการ anaphora, query reformulation, clarification, mixed-initiative) ประยุกต์เข้ากับโดเมนลานแคมป์

### P1 · การอ้างอิงย้อน (Referential / Anaphoric)
- "อันที่ 1 กับอันที่ 2 อันไหนดีกว่า" · "เอาอันเมื่อกี้แหละ" · "ตัวที่ถูกกว่านั่นน่ะ จองเลย" · "อันสุดท้ายที่โชว์ ขอดูรีวิว" · "ที่เธอบอกว่าหมอกแน่นๆ อ่ะ ว่างไหม" · "ไม่ใช่อันนี้ อันข้างๆ"
- **ต้องมี:** conversation state เก็บ `last_results[{ordinal, campId, ชื่อ, ราคา, จุดขายที่ AI พูดไปแล้ว}]` + `focus_entity` (stack) inject เข้า prompt ทุก turn; ตัว resolve ต้องรับได้ทั้ง ordinal (อันที่ 2), superlative ในเซ็ต (ตัวที่ถูกกว่า), และ description ที่ AI เคยพูด (ที่บอกว่าหมอกแน่น)
- **Fallback บังคับ:** resolve ไม่มั่นใจ → ถามยืนยันด้วย chips รายชื่อ candidate ห้ามเดา

### P2 · เปรียบเทียบด้วยเกณฑ์ที่ต้อง derive (Comparative + soft attribute)
- "อันไหนเหมาะกับครอบครัว" · "ที่ไหนเหมาะพาแม่วัย 60 ไป" · "เทียบความสะดวกห้องน้ำหน่อย" · "อันไหนเงียบกว่า" · "ถ้าฝนตกที่ไหนรอดกว่า" · "มือใหม่ควรไปอันไหน"
- **ต้องมี:** **Facet/derived-attribute layer** — คะแนน+หลักฐานต่อลานในมิติที่คนถามจริง: family_friendly, senior_accessible, beginner_friendly, quietness, rain_resilience, photo_worthy, privacy, cleanliness — คำนวณจาก (a) ฟิลด์โครงสร้าง (amenities/terrain/policy/ระยะรถ→จุดกาง) (b) review mining (aspect extraction จากรีวิว verified) (c) host input; เก็บเป็นตาราง facet_scores พร้อม evidence (อ้างรีวิว/ฟิลด์) เพื่อให้ AI ตอบแบบมีเหตุผล ไม่มโน
- tool: `compareCamps(ids[], criteria[])` คืน per-facet score + evidence

### P3 · เวลาแบบคลุมเครือ (Fuzzy temporal)
- "ว่างช่วงวีคเอนด์ของเดือนนี้ไหม" · "ปลายเดือนมีที่ไหนว่าง" · "วันหยุดยาวรอบหน้า" · "ก่อนสิ้นหน้าฝน" · "ช่วงเงินเดือนออก" · "คืนวันแม่" · "อีกสองอาทิตย์" · "ศุกร์ไหนก็ได้ที่ว่าง"
- **ต้องมี:** Thai temporal resolver (relative date + คำเฉพาะวัฒนธรรม) + ตารางวันหยุดราชการ/วันสำคัญ + นิยามที่ตกลงกัน (วีคเอนด์ = ศ กลางคืน?/ส-อา) — ผลลัพธ์เป็น date-set ไม่ใช่ single range; แนะนำทำเป็น tool `resolveDates(text, today, tz)` ที่ deterministic (อย่าปล่อย LLM เดาเลขวันเอง แล้ว validate ไม่ได้)

### P4 · Superlative / จัดอันดับ
- "ถูกสุดคือที่ไหน" · "ใกล้กรุงเทพสุด" · "หมอกแน่นสุดเดือนหน้า" · "รีวิวดีสุดในเชียงใหม่" · "ที่ไหนคนน้อยสุดเสาร์นี้"
- **ต้องมี:** sort/aggregate ใน search tool + ข้อมูลที่จัดอันดับได้ (occupancy forecast, fog score) — ระวัง: "คนน้อยสุด" ต้องใช้ข้อมูลจอง ณ ปัจจุบัน = bulkAvailability อีกเช่นกัน

### P5 · ปฏิเสธ/ยกเว้น (Negation & exclusion)
- "ไม่เอาเขาใหญ่" · "ที่ไม่ต้องเดินไกล" · "ไม่เอาที่คนเยอะ" · "แบบไม่มีคาราโอเกะข้างลาน" · "ขออันอื่นนอกจากที่โชว์มา"
- **ต้องมี:** search รับ `excludeIds`, `excludeFacets`; state จำว่าโชว์อะไรไปแล้ว (กัน "ขออันอื่น" วนซ้ำ); facet เชิงลบ (noise_level) จาก review mining

### P6 · ต่อรองเงื่อนไข / ผ่อนปรน (Constraint negotiation & relaxation)
- "งบ 500 แต่ถ้าวิวดีจริงเกินได้นิดหน่อย" · "ถ้าเสาร์เต็ม อาทิตย์ก็ได้" · "ไกลหน่อยไม่เป็นไรถ้าหมาไปได้" · "ถ้าไม่มีที่ตรงเงื่อนไข อะไรใกล้เคียงสุด"
- **ต้องมี:** โมเดลเงื่อนไขแบบ soft/hard (hard: หมาไปได้; soft: งบ±20%, วัน±1 สัปดาห์) + กลยุทธ์ relax ทีละแกนพร้อมบอกผู้ใช้ว่า relax อะไร — สำคัญมากต่อ conversion เพราะ "ไม่เจอ" ต้องไม่จบที่ศูนย์

### P7 · เป้าหมาย/อารมณ์ ไม่ใช่สเปก (Vague, outcome-oriented)
- "อยากหนีเมืองไปฮีลใจ" · "ขอที่ถ่ายรูปลง IG สวยๆ" · "ที่โรแมนติกๆ จะไปง้อแฟน" · "อยากให้ลูกได้ลองแคมป์ครั้งแรก" · "เอาที่นอนสบายไม่ต้องลุยมาก"
- **ต้องมี:** mapping mood→facet (ใช้ LLM ตีความ + facet layer เดียวกับ P2) และคำตอบต้องแนบ **เหตุผลรายลาน** — pattern นี้คือจุดที่ AI ชนะ filter UI ขาด

### P8 · เงื่อนไขกลุ่มแบบผสม (Composite party constraints)
- "ไป 6 คน เด็ก 2 หมา 1 รถเก๋ง" · "มีคนแพ้อากาศเย็น" · "ผู้ใหญ่ 4 เต็นท์ 2 หลัง ขอติดกัน" · "รถเก๋งขึ้นถึงไหม"
- **ต้องมี:** โครงสร้าง party (adults/children/pets/vehicles) เป็นส่วนหนึ่งของ booking slot + ฟิลด์ลาน: road_access (เก๋ง/กระบะ/4WD), pitch adjacency, capacity ต่อจุด — และ availability ต้องเช็คตาม party ไม่ใช่แค่จำนวนจุด

### P9 · จองแบบมีเงื่อนไข (Conditional / deferred booking)
- "ถ้าเสาร์นี้ฝนไม่ตก จองเลย" · "ถ้ามีคนยกเลิกบอกด้วย" · "ถ้าโอกาสหมอกเกิน 80% ค่อยจองให้" · "จองไว้ก่อน ถ้าแฟนไม่ว่างค่อยยกเลิก (ฟรีใช่ไหม)"
- **ต้องมี:** ระบบ watcher/trigger (เฝ้าพยากรณ์, waitlist) + นโยบายยกเลิก/hold ชัดเจน + **guardrail: AI ห้ามจองอัตโนมัติโดยไม่มี explicit confirm สุดท้ายจากผู้ใช้** — เสนอเป็น "ตั้งเฝ้าให้ แล้วเด้งมาถามก่อนจอง"

### P10 · ความจำส่วนตัว/ประวัติ (Personal memory)
- "เอาที่เดิมที่ไปเดือนก่อน" · "แบบที่เราชอบอ่ะ" · "ที่เคยเซฟไว้" · "คราวก่อนบ่นเรื่องห้องน้ำ ขออันที่ดีกว่านั้น" · "จองซ้ำทุกอย่างเหมือนรอบที่แล้ว แต่เปลี่ยนวัน"
- **ต้องมี:** long-term memory 3 ชั้น — (1) ประวัติจอง (โครงสร้าง มีอยู่แล้วใน DB), (2) preferences ที่ระบบสรุปสะสม (ชอบเงียบ, มีหมา, งบ ~300), (3) episodic notes จากบทสนทนา/รีวิวเก่า ("เคยบ่น X") — พร้อมกติกา privacy/consent และคำสั่งลืม

### P11 · แก้ไขกลางทาง (Repair / edit-in-flight)
- "เปลี่ยนเป็นวันอาทิตย์" (ระหว่างจอง) · "เพิ่มอีก 1 คน" · "เมื่อกี้บอกผิด หมาไม่ไปละ" · "ย้ายไปลานที่สองแทน แต่วันเดิม" · หลังจองเสร็จ: "เลื่อนไปอีกอาทิตย์"
- **ต้องมี:** booking state machine ที่แก้ slot ย้อนหลังได้ทุกจุดโดยไม่ต้องเริ่มใหม่ + re-validate availability ทุกครั้งที่แก้ + operation แก้ booking ที่ commit แล้ว (amend/reschedule ผ่าน flow ปลอดภัย)

### P12 · เชิงวิเคราะห์/สรุปข้าม entity (Aggregate & analytic)
- "เดือนนี้เสาร์ไหนคนน้อยสุด" · "ว่างพร้อมกัน 2 คืนติดมีที่ไหนบ้าง" · "ลานในเชียงใหม่เฉลี่ยคืนละเท่าไหร่" · "ช่วงไหนของปีที่ภูทับเบิกถูกสุด"
- **ต้องมี:** query แบบ aggregate บน calendar/price history — ชี้ว่าฝั่ง data ควรมี **availability calendar ที่ materialize แล้ว** (campsite_id × date × capacity/booked/blocked/price) ไม่ใช่คำนวณ on-the-fly จากตาราง booking ทุกครั้ง

### P13 · ขอคำอธิบาย/ที่มา (Explanation & meta)
- "ทำไมแนะนำอันนี้" · "ต่างจากอันแรกยังไง" · "มั่นใจแค่ไหนเรื่องหมอก" · "ข้อมูลนี้อัปเดตเมื่อไหร่" · "รีวิวที่ว่าดีมาจากใคร"
- **ต้องมี:** ทุก recommendation ต้องพก provenance (มาจาก facet ไหน คะแนนอะไร รีวิวไหน อัปเดตเมื่อไหร่) — ออกแบบ response ของ tools ให้มี evidence ติดมาเสมอ ไม่ใช่ตัวเลขลอยๆ

### P14 · นโยบาย/เงิน/ความเชื่อใจ (Policy & transactional)
- "มัดจำเท่าไหร่ คืนตอนไหน" · "ยกเลิกได้ถึงเมื่อไหร่ ถ้าฝนตกล่ะ" · "750 รวมอะไรบ้าง มีชาร์จเพิ่มไหม" · "ออกใบเสร็จในนามบริษัทได้ไหม" · "โอนแล้วสลิปส่งใคร"
- **ต้องมี:** policy schema ต่อลาน (cancellation tiers, deposit, weather clause, fee breakdown ที่ **ตรงกับ total จริง**) + RAG เหนือเอกสารนโยบายกลาง — โซนนี้ห้าม hallucinate เด็ดขาด: ถ้าไม่มีข้อมูล ให้บอกว่าไม่มีและส่งต่อ ไม่ใช่เดา (คำตอบผิดเรื่องเงิน = ความเสียหายจริง)

### P15 · ทริปหลายจุด (Multi-stop itinerary)
- "3 วัน เชียงใหม่-ปาย นอนคนละที่" · "ขากลับแวะนอนกลางทางแถวตาก" · "จอง 2 ลานติดกันคนละคืน"
- **ต้องมี:** trip entity (ordered stops + drive segments) + distance matrix + จองหลาย booking เป็น transaction เดียว (ยกเลิกทั้งทริปได้)

### P16 · แทรกเรื่องอื่นแล้วกลับมา (Interleaved intents)
- (กำลังเลือกวันจอง) "เดี๋ยวนะ ที่นี่มีไฟฟ้าไหม" → ตอบแล้วต้องกลับมาถามวันต่อ · "ก่อนจอง ขอดูรีวิวแป๊บ" · ถามเรื่องลาน B ระหว่างจองลาน A แล้ว "โอเค งั้นเอา A ต่อ"
- **ต้องมี:** active_flow ที่ suspend/resume ได้ (ไม่ใช่ router แบบ if-else ที่ flow ค้างกินทุกข้อความ — บั๊กที่เจอจริงใน prototype) + focus stack แยก "เรื่องที่คุย" กับ "flow ที่ค้าง"

---

### P17 · Gear & Preparation Advisory (คำถามเรื่องอุปกรณ์/การเตรียมตัว)
- "มือใหม่หัดกาง ต้องเตรียมตัวยังไง" · "ต้องมีไอเทมอะไรเป็นอย่างน้อย" · "ควรซื้อหรือเช่าก่อนดี" · "ไปที่นี่ต้องเอาอะไรไปพิเศษไหม" · "เต็นท์แบบไหนเหมาะกับมือใหม่" · "งบ 3,000 ซื้ออะไรก่อน"
- **3 ระดับของคำตอบ (ต้องแยกให้ชัดตอนออกแบบ):**
  1. **ความรู้ทั่วไป** (เต็นท์ต้องมีฟลายชีท, ถุงนอนดูอุณหภูมิ comfort) → gear knowledge base — ตอบได้โดยไม่ต้องรู้ลาน
  2. **เฉพาะลาน+ฤดู** ("ไปที่นี่เดือนนี้ เอายากันยุง+พัดลม") → ต้องมี **condition pixels ของลาน** (ยุง/ความร้อนกลางคืน/ความชื้น/ทาก ตามฤดู) + อุณหภูมิ derive จากความสูง+เดือน
  3. **เช่าก่อนซื้อ** ("มือใหม่อย่าเพิ่งซื้อ ลานนี้มีเต็นท์+ถุงนอนให้เช่า X บาท ลองก่อน 2-3 ทริปค่อยลงทุน") → ผูกกับ EquipmentRental ของลานนั้น — นี่คือคำแนะนำที่สร้าง trust สูงสุดเพราะ**แนะนำให้จ่ายน้อยลง**
- **ต้องมี:** D9 (ดู §2) — gear knowledge base + camp condition pixels + กติกา matching (condition → checklist item → มีเช่าที่ลานไหม → แนะนำเช่า/ซื้อ/ข้าม)
- **Journey แทรกอัตโนมัติ:** หลังจองสำเร็จ → generate checklist เฉพาะลาน+วันจริง (อิงพยากรณ์) → เตือนคืนก่อนเดินทาง → sync ทั้งกลุ่ม (ใครเอาอะไร) — และฝั่งขาย: gear ที่ลานมีเช่า = add-on ตอนจองได้เลย

### P18 · Region-Scoped Q&A (คำถามระดับ "ภาค" — สำรวจ + อากาศ + การเตรียมตัวรายภาค)
- "ภาคอีสานมีลานกางเต็นท์ไหม มีกี่ที่" · "ภาคใต้ช่วงนี้เหมาะไปแคมป์ไหม ฝนตกหรือเปล่า" · "ไปภาคเหนือเดือนหน้า ต้องเตรียมอุปกรณ์อะไรบ้าง" · "ภาคไหนเหมาะสุดช่วงนี้" · "ภาคตะวันตกมีลานติดน้ำไหม" · "หน้าหนาวภาคอีสานหนาวเท่าเหนือไหม"
- **ต่างจาก search รายจังหวัด/รายลานตรงไหน:** ผู้ถามยังไม่มีหมุดหมาย — คำตอบต้องเป็น **ภาพรวมระดับภาค** (จำนวนลาน, จังหวัดเด่น, ฤดูที่เหมาะ, สภาพอากาศตอนนี้, ของที่ต้องเตรียมเฉพาะภาค+ฤดู) แล้วค่อย funnel ลงจังหวัด → ลาน — เป็น entry point สำคัญของคนต่างภาค/นักท่องเที่ยว
- **3 องค์ประกอบของคำตอบที่ดี:**
  1. **Inventory ระดับภาค** — "ภาคอีสานมี 14 ลานใน 5 จังหวัด เด่นสุดโซนเขาใหญ่-วังน้ำเขียว" → ต้อง aggregate ตาม region ได้ (ปัจจุบัน `Location.region` เป็น string nullable — ต้อง normalize)
  2. **ภูมิอากาศรายภาค+ฤดู** — "ภาคใต้ ก.ค.–ต.ค. ฝั่งอันดามันมรสุมหนัก แต่ฝั่งอ่าวไทยยังไปได้" → ต้องมี **RegionSeasonProfile** knowledge base (ภาค × เดือน → ฝน/หนาว/หมอก/มรสุม + คำแนะนำ) — ภาคใต้ต้องแยกสองฝั่งทะเล
  3. **Gear รายภาค** — reuse D9: RegionSeasonProfile ทำหน้าที่เป็น default ของ CampSeasonCondition เมื่อลานยังไม่กรอก ("ภาคเหนือ พ.ย.–ก.พ. บนดอย <10°C → ถุงนอนหนา" vs "อีสานหน้าร้อน → พัดลม+กันยุงริมน้ำ")
- **ต้องมี:** normalize region (enum/AdminArea level ใหม่ — เหนือ/อีสาน/กลาง/ตะวันออก/ตะวันตก/ใต้), region rollup query (count/จังหวัดเด่น/ช่วงราคา), RegionSeasonProfile KB, tool `getRegionOverview(region, month?)` — และคำตอบต้องจบด้วย funnel chips ("ดูลานเด่นภาคอีสาน", "จังหวัดไหนใกล้คุณสุด")

## 1.5 Persona × Camp-Style Segmentation — "ลานแบบไหน เหมาะกับใคร" เป็น first-class concept

> คนไม่ได้ค้นหาด้วยฟิลด์ แต่ค้นหาด้วย "ตัวตน+สไตล์ทริป" — เหมือน Airbnb Categories
> Segment ไม่ใช่ tag ที่ host ติดเอง แต่เป็น **คะแนนที่คำนวณได้** จาก facet (D3) → ตรวจสอบ/อธิบายได้ และใช้ได้ 3 ทาง: ตอบคำถามในแชท, เป็น collection หน้า discover, เป็น personalization signal

### Segment เริ่มต้น 10 ตัว + เกณฑ์ที่คำนวณได้

| Segment | ผู้ใช้พูดว่า | เกณฑ์คำนวณ (จากฟิลด์/facet/รีวิว) | Journey ที่ต่างจากปกติ |
|---|---|---|---|
| **มือใหม่หัดกาง** | "ไม่เคยแคมป์เลย เริ่มที่ไหนดี" | รถถึงจุดกาง ≤50ม. · เช่าอุปกรณ์ครบ(เต็นท์/ถุงนอน/แผ่นรอง) · ห้องน้ำ+น้ำอุ่น · ร้านอาหาร/สะดวกซื้อใกล้ · สัญญาณมือถือ · staff ช่วยกาง · รีวิว mention "ครั้งแรก/มือใหม่" เชิงบวก | AI ต้อง**สอนไปด้วย**: checklist อัตโนมัติ, บอกว่าลานมีอะไรให้ไม่ต้องซื้อ, เสนอ "แพ็กไปตัวเปล่า", follow-up ก่อนวันเดินทาง 1 วัน |
| **ครอบครัว + กิจกรรม** | "พาลูกไป มีอะไรให้เด็กทำทั้งวัน" | สนามเด็กเล่น/กิจกรรม (พายเรือ, ให้อาหารสัตว์, ฟาร์ม, จักรยาน) · พื้นราบ · โซนครอบครัวแยกจากโซนเงียบ · น้ำตื้นปลอดภัย · ห้องน้ำสะอาด (review aspect) · กฎเรื่องเสียงยืดหยุ่นกลางวัน | ถามจำนวน+อายุเด็กเสมอ, ตอบพร้อม **ตารางกิจกรรมระหว่างวัน**, เตือนของสำหรับเด็ก, ราคาเด็ก |
| **คาเฟ่ / Workation** | "มีคาเฟ่ไหม นั่งทำงานได้ไหม" | คาเฟ่ในลานหรือ ≤500ม. · WiFi/สัญญาณ ≥4G จริงตามรีวิว · ปลั๊กถึงจุดกางหรือ co-working corner · โต๊ะ-เก้าอี้ · เงียบช่วงกลางวัน | ตอบความเร็วเน็ต/จุดปลั๊กแบบเจาะจง, เสนอวันธรรมดา (คนน้อย+ถูกกว่า), long-stay discount |
| **สายลุย / เดินป่า** | "ขอฟีลดิบๆ มีเทรลเดิน" | ติดเส้นเดินป่า/น้ำตก (ระยะ+ระดับความยาก) · ลานแบบ minimal (ไม่มีไฟฟ้า = ข้อดี) · แบกของเข้า · จุดชมวิวต้องเดิน · อนุญาตก่อไฟ | ถามระดับประสบการณ์, แนบข้อมูลเทรล (ระยะ/ชั่วโมง/ความชัน), เช็คสภาพเส้นทางตามฤดู, safety brief + จุดสัญญาณ/SOS |
| **สายชิลวิว/ถ่ายรูป** | "ขอวิวสวยๆ ถ่ายรูปลง IG" | facet photo (จุดถ่ายรูป, วิวเปิด, หมอก/ดาว) · รีวิวแนบรูปเยอะ · ทิศพระอาทิตย์ | แนบ fog/star forecast อัตโนมัติ, บอกจุด+เวลาถ่ายรูปที่ดีสุดของลาน |
| **สายหมา/สัตว์เลี้ยง** | "พาหมาไปได้แบบสบายใจ" | นโยบายละเอียด (สายจูง/off-leash zone/ค่าธรรมเนียม/จำกัดพันธุ์) · รั้ว · โซนหมา · รีวิวคนพาสัตว์ | ถามพันธุ์/ขนาด/จำนวน, สรุปกฎของลานนั้นชัดๆ ก่อนจอง (โซนนี้ผิดบ่อย = คืนเงิน/ดราม่า) |
| **คู่รัก/โรแมนติก** | "ไปฉลองครบรอบ" | ความ private ของจุดกาง · กลามปิ้ง/อาหารเช้าเสิร์ฟ · วิวพระอาทิตย์ตก/ดาว · เงียบ | เสนอ add-on (ชุดเซอร์ไพรส์, จุดกางพิเศษ), ไม่ถามเยอะ เน้นจัดให้ |
| **โซโล/สายสงบ** | "ไปคนเดียว ขอเงียบและปลอดภัย" | โซนเงียบบังคับ · ความปลอดภัย (ไฟทาง, เจ้าของอยู่ในลาน, รีวิวผู้หญิงโซโล) · จุดกางเดี่ยว | เน้น safety info + signal map, ไม่ push กิจกรรมกลุ่ม |
| **แก๊ง/ปาร์ตี้** | "ไป 10 คน กินหมูกระทะ ร้องเพลงได้" | โซนกลุ่ม/เหมา · กฎเสียงถึงกี่โมง · ลานบาร์บีคิว/โต๊ะยาว · จุดกางติดกันจำนวนมาก | เช็ค capacity เป็นกลุ่ม, เสนอเหมาโซน, split-pay/group vote |
| **รถบ้าน/Car camp** | "นอนในรถ/เอา camper van ไป" | จุดจอดรถนอน · ปลั๊ก 220V ต่อคัน · ทางเข้ารถใหญ่ · พื้นแข็ง | ถามชนิดรถ, เช็ค road_access + ขนาดจุดจอด |
| **วัยรุ่น 1.9 D-Max (วัยรุ่นสร้างตัว / ปาร์ตี้ทั้งคืน)** | "เปิดเพลงดังได้ทั้งคืน ไปแคมป์เหมือนปาร์ตี้" · "ขับกระบะไป เปิดท้ายตั้งเครื่องเสียง" | นโยบายเสียง = **ไม่จำกัด/ทั้งคืน** (`amplifiedSound=UNRESTRICTED`, quietHours=null) · **กระบะจอดติดจุดกาง** (car-side camping — เปิดท้ายตั้งเครื่องเสียง/นอนกระบะได้) · ลานแยกขาด/ไกลจากโซนเงียบและบ้านคน · อนุญาตเครื่องเสียง/คาราโอเกะ · **ราคาต่อหัวถูก + ทำอาหารเอง/หมูกระทะได้** (วัยรุ่นสร้างตัว = งบจำกัดแต่มากันเยอะ) · ขายน้ำแข็ง-เครื่องดื่ม/นโยบายแอลกอฮอล์ชัด · ไฟสว่างกลางคืน · โซนเหมายกลาน · รีวิว mention "ปาร์ตี้/เสียงดังได้/สายกระบะ" เชิงบวก | ราคาแสดงเป็น**ต่อหัวเมื่อหารทั้งแก๊ง**, เช็คว่าจอดกระบะติดจุดกาง+เปิดท้ายได้ไหม, กฎแอลกอฮอล์+อายุ, เสนอเหมาโซน/ยกลาน, split-pay, แนบกติกาความปลอดภัย (เมาไม่ขับ, เคารพลานข้างเคียง), **สำคัญเชิงแพลตฟอร์ม: segment นี้คือตัวกันดราม่า — บังคับ match สายปาร์ตี้เข้าลานที่รับเสียงได้ทั้งคืน และกันออกจากลานสายเงียบ/ครอบครัว (mismatch = รีวิว 1 ดาวทั้งสองฝั่ง) — และเป็น demand ก้อนใหญ่ที่ลานสายเงียบไม่อยากได้แต่ลานเฉพาะทางอยากได้มาก = โอกาส supply ใหม่** |

### ข้อกำหนดที่เพิ่มจากเรื่องนี้
1. **D3 facet layer ขยายเป็น 2 ชั้น:** ชั้น facet ดิบ (walk_distance, wifi_speed, trail_access, kid_activities, noise_policy, privacy…) → ชั้น **segment score** = สูตรถ่วงน้ำหนักจาก facet + เก็บ evidence — segment จึงอธิบายได้เสมอว่า "ทำไมลานนี้เหมาะมือใหม่ (รถถึงจุดกาง, มีเช่าครบ, รีวิวมือใหม่ชม 12 คน)"
2. **Segment เป็นได้ทั้ง input และ output:** ผู้ใช้ประกาศตัวตน ("เราสายลุย") → เก็บเข้า preferences (D5); หรือระบบอนุมานจากพฤติกรรม → ใช้เรียงผลค้นหาทุกครั้ง
3. **Journey แตกตาม segment** (คอลัมน์ขวาของตาราง) — ไม่ใช่แค่กรองผลลัพธ์ แต่เปลี่ยน "วิธีคุยและสิ่งที่ AI ทำให้" ทั้ง flow: คำถามที่ถามต่อ, ข้อมูลที่แนบ, add-on ที่เสนอ, follow-up หลังจอง
4. **ฝั่ง host:** แบบฟอร์มประกาศควรถามเป็นภาษา segment ("ลานคุณเหมาะกับใคร มีอะไรรองรับ") → ได้ข้อมูลตรงกับที่ AI ต้องใช้ตอบ
5. **Utterances สำหรับ segment เพิ่มใน corpus หมวด H (ข้อ 272–301)**

## 2. สรุปเป็นข้อกำหนดเชิงข้อมูล (สิ่งที่ทีม data ต้องสร้าง)

| # | โครงสร้าง | รองรับ pattern | หมายเหตุ |
|---|---|---|---|
| D1 | **Conversation state store** (per session): `last_results[] (ordinal→id+สิ่งที่ AI พูด), focus_stack, active_flow{type,slots,status}, shown_ids, party, constraints{hard,soft}` | P1 P5 P6 P8 P11 P16 | Redis/DB; serialize เข้า system context ทุก turn; TTL + สืบต่อข้ามอุปกรณ์ |
| D2 | **Availability calendar (materialized)**: `campsite_id × date → capacity, booked, blocked, price` + index สำหรับ bulk/aggregate | P3 P4 P9 P12 | ต้องทำ PREP-1 (partial capacity + BlockedDate) ก่อน; เขียนผ่าน event จาก booking service; **confirm ต้อง re-check ตารางจริงเสมอ** |
| D3 | **Facet layer**: `facet_scores(campsite_id, facet, score, confidence, evidence[])` — facets เริ่มต้น: family, senior, beginner, quiet, rain_ok, photo, privacy, clean, pet_detail, road_access | P2 P4 P5 P7 | มาจาก 3 แหล่ง: structured fields → rules; reviews → aspect mining (batch LLM); host input; refresh เป็นรอบ + เก็บ evidence เสมอ (P13) |
| D4 | **Temporal service**: Thai relative-date resolver + `holidays(date, name, is_long_weekend)` | P3 P9 P12 | deterministic function/tool — ห้ามให้ LLM คำนวณวันเอง |
| D5 | **User memory**: `preferences(สรุปสะสม), booking_history, episodic_notes` + consent/ลืมได้ | P10 | แยกชั้น session vs long-term ตามแนวปฏิบัติ agent memory ปัจจุบัน |
| D6 | **Policy & pricing schema**: cancellation tiers, deposit, weather clause, fee items ↔ total integrity (PREP-2) | P14 | + เอกสารนโยบายกลางเป็น RAG corpus |
| D7 | **Trip entity**: `trip(stops[], segments[], budget)` + distance matrix | P15 | Phase หลัง |
| D8 | **Watchers**: `watch(user, condition{fog>80, cancel_slot, rain}, action{notify→confirm})` | P9 | ต่อ push infra; ทุก action จบที่ "ถามผู้ใช้ก่อน" |
| D9 | **Gear layer**: (a) `GearItem` knowledge base (ชื่อ, หมวด, จำเป็นระดับ must/should/nice, เงื่อนไขที่ต้องใช้ เช่น temp<15 → ถุงนอนหนา, mosquito=HIGH → ยากันยุง, ราคาซื้อโดยประมาณ, ownVsRentAdvice) (b) **camp condition pixels ตามฤดู**: `mosquitoLevel, leechLevel, nightHeat, humidity, windExposure` (host กรอก + สอบทานจาก review mining) (c) matching rules → checklist generator ที่ตัดรายการที่ลานมีให้เช่า (EquipmentRental) ออกพร้อมเสนอ "เช่าก่อนซื้อ" | P17, D2 segment มือใหม่ | ความรู้ gear เป็น global ไม่ผูกลาน; เงื่อนไขลานเป็น per-camp per-season; อย่าเก็บ checklist สำเร็จรูปเป็น text ก้อนเดียว (ขัด atomic — ประกอบจาก rules เสมอ) |

## 3. Tool surface ที่ควร expose ให้ LLM (สัญญาเริ่มต้น)

```
searchCampsites({filters, excludeIds?, sort?, limit})        → [{id, name, ราคา, facets ย่อ, availabilityHint}]
getCampDetails(ids[])                                        → batch รายละเอียด (รองรับ compare)
compareCamps(ids[], criteria[])                              → per-facet scores + evidence + คำแนะนำ
bulkAvailability({campIds? | filters}, dateSet)              → matrix ลาน×วัน (เหลือ N/M)
checkAvailability(campId, dateRange, party)                  → สด, ใช้ก่อน confirm เท่านั้น
resolveDates(text)                                           → {dates[], interpretation} (deterministic)
getFacetEvidence(campId, facet)                              → คะแนน + รีวิว/ฟิลด์อ้างอิง (ตอบ "ทำไม")
getReviewSummary(campId, aspect?)                            → สรุป verified-stay + quotes
getPolicies(campId)                                          → cancellation/deposit/fees
getUserContext()                                             → prefs + ประวัติ + episodic (ตาม consent)
createBookingDraft(campId, dates, party, addons)             → deep-link prefilled (ไม่ write จริง)
setWatch(condition, action)                                  → ลงทะเบียน watcher
```

## 4. Architecture blueprint (เสนอ)

```
┌ Client (chat / live voice) ──────────────────────────────┐
│  generative UI blocks ← structured "ui" payload จาก server │
└──────────────┬───────────────────────────────────────────┘
               │ streaming
┌ Orchestrator service ─────────────────────────────────────┐
│ LLM (tool-calling loop)                                    │
│  • system context ประกอบใหม่ทุก turn จาก D1:               │
│    - last_results พร้อมเลขลำดับ (แก้ P1 ตรงๆ)              │
│    - active_flow + slots (booking = state machine ใน code, │
│      LLM เป็นคน "คุย" ไม่ใช่คน "ถือเงิน")                  │
│    - user profile summary (D5) + วันนี้/timezone           │
│  • deterministic guards: confirm จริง = โค้ด ไม่ใช่โมเดล;   │
│    เงิน/นโยบาย = ตอบจาก tool เท่านั้น (no-hallucination zone)│
│  • resolve อ้างอิงไม่มั่นใจ → clarification chips           │
├ Tools layer (§3) ── Availability svc ── Facet svc ── Temporal svc ┤
├ RAG: policies / คำอธิบายลาน / FAQ                          │
├ Memory: session (Redis) + long-term (DB) + summarizer      │
└ Data flywheel: structured review → aspect mining → D3 ─────┘
```

หลักการตัดสินใจที่อยากให้ทีมยึด:
1. **State เป็นของระบบ ไม่ใช่ของโมเดล** — อย่าหวังให้ LLM "จำ" ผลลัพธ์เอง ให้ inject last_results/slots เป็นข้อความโครงสร้างทุก turn (บทเรียนตรงจาก failure เคส ก.)
2. **Deterministic ตรงที่พลาดไม่ได้** — วันที่ (D4), เงิน/นโยบาย (D6), การ confirm — เป็นโค้ด/tool; LLM มีหน้าที่ตีความภาษาและเรียงคำตอบ
3. **ทุกคำแนะนำมีหลักฐาน** — tool คืน evidence เสมอ → ตอบ "ทำไม" ได้ (P13) และลด hallucination โดยโครงสร้าง
4. **ไม่เจอ ≠ จบ** — เส้นทาง relax เงื่อนไข (P6) ต้องเป็น first-class ไม่ใช่ fallback ข้อความเปล่า
5. **วัดด้วย multi-turn eval** — ใช้ eval set ใน §5 เป็น regression suite: ตรวจทั้ง tool-call ที่ควรเกิด (golden function calls) และคุณภาพคำตอบ (LLM-as-judge) ตามแนวทาง multi-turn evaluation ปัจจุบัน

## 4.5 Framework decision — ต้องใช้ LangChain ไหม?

**คำตอบสั้น: ไม่จำเป็น — และการเปลี่ยน framework ไม่ได้แก้อาการ "ตอบไม่ตรงคำถาม"** อาการนั้นเกิดจากการขาด D1 (state injection), tools (§3) และ facet layer (D3) ไม่ว่าจะรันบน framework ไหนถ้าไม่มีสามอย่างนี้ก็ตอบไม่ตรงเหมือนเดิม Framework เป็นแค่ตัว wiring ของ blueprint §4

| ตัวเลือก | เหมาะเมื่อ | ข้อควรระวัง |
|---|---|---|
| **Vercel AI SDK** ← แนะนำเป็น default | Stack เราคือ Next.js/TS (deploy Vercel อยู่แล้ว) — ได้ tool calling, streaming, `useChat`, และ **generative UI (streamUI)** ที่ตรงกับ "การ์ด/ปฏิทินโผล่ในแชท" ของเราแบบพอดีตัว, API เบา ทีมเข้าใจเร็ว | เป็น SDK ไม่ใช่ orchestration เต็มรูป — state/flow ซับซ้อนต้องเขียนเอง (ซึ่งเราตั้งใจเขียนเองอยู่แล้วตามหลัก "state เป็นของระบบ") |
| **LangGraph (ค่าย LangChain)** | Flow เป็นกราฟหลายขั้นที่ต้อง durable/resume, human-in-the-loop checkpoint, multi-agent — เช่นถ้าอนาคต watchers+rebooking+host agent โตจนเป็น workflow ยาวๆ | ของเราตอนนี้ booking state machine เป็นโค้ดตรงๆ ได้; ตัว LangChain แบบ chains ดั้งเดิมมี abstraction overhead สูง คนย้ายออกเยอะ — ถ้าจะใช้ค่ายนี้ให้ใช้ LangGraph ไม่ใช่ LangChain classic |
| Direct SDK (OpenAI/Anthropic) | ทีมเล็ก อยากคุมทุกบรรทัด | เขียน streaming/retry/tool loop เองทั้งหมด |

**ข้อเสนอ:** เริ่มด้วย **Vercel AI SDK + tool contract §3 + state store D1 (Redis/DB)** — ส่วน observability/eval ใช้ LangSmith หรือ Langfuse ประกบได้โดยไม่ต้องใช้ LangChain รัน; ถ้าวันหน้า orchestration ซับซ้อนจริงค่อยยกเฉพาะชั้น flow ไป LangGraph ได้เพราะ tool layer เดิมใช้ต่อได้ทั้งหมด (ไม่ lock-in)

**Checklist วินิจฉัย "ตอบไม่ตรงคำถาม" ของระบบปัจจุบัน (เรียงตามโอกาสเป็นสาเหตุ):**
1. ไม่ได้ inject `last_results`/บริบท turn ก่อนเข้า system context → โมเดลไม่รู้ว่า "อันที่ 1" คืออะไร
2. ไม่มี tool ให้เรียก (หรือ tool คืนข้อมูลไม่พอ) → โมเดลเลี่ยงตอบเป็นคำแนะนำกลางๆ
3. ใช้ RAG อย่างเดียวกับคำถามที่ต้อง query สด (availability) → ได้คำตอบเก่า/ไม่มี
4. System prompt ไม่บังคับ "ต้องเรียก tool ก่อนตอบเรื่อง X" + ไม่มี few-shot ของ pattern P1–P16
5. ไม่มี eval — แก้แล้ววัดไม่ได้ว่าดีขึ้น (ใช้ §5 เป็น regression suite)

## 5. Eval set — ใช้เป็น test suite ได้ทันที (คัด 40 ตัวแทนจาก 16 pattern)

รูปแบบ: `[pattern] utterance → พฤติกรรมที่คาดหวัง (tool ที่ต้องถูกเรียก)`

1. [P1] "เอาอันที่สอง" → resolve จาก last_results → getCampDetails
2. [P1] "ตัวที่ถูกกว่าเมื่อกี้ จองเลย" → resolve superlative ในเซ็ต → เริ่ม booking flow
3. [P1] "อันที่บอกว่าหมอกสวยอ่ะ ว่างเสาร์นี้ไหม" → resolve จากคำพูด AI → checkAvailability
4. [P1-fail] (ยังไม่เคยค้นหา) "เอาอันแรก" → ถามกลับพร้อมชวนค้นหา ไม่เดา
5. [P2] "เปรียบเทียบอันที่ 1 กับ 2 อันไหนเหมาะกับครอบครัว" → compareCamps(criteria=[family]) + evidence
6. [P2] "พาแม่อายุ 60 ไปได้ไหมอันแรก" → getFacetEvidence(senior)
7. [P2] "อันไหนเงียบกว่ากัน" → facet quiet + review evidence
8. [P3] "มีลานไหนว่างช่วงวีคเอนด์ของเดือนนี้" → resolveDates → bulkAvailability → สรุปเป็น matrix
9. [P3] "วันหยุดยาวรอบหน้า ภูทับเบิกว่างไหม" → resolveDates(holidays) → checkAvailability
10. [P3] "ปลายเดือนไปไหนดีที่ยังว่าง" → resolveDates → bulk + search ผสม
11. [P4] "ถูกสุดที่ยังว่างเสาร์นี้" → bulk+sort
12. [P4] "เสาร์ไหนของเดือนหน้าภูชี้ฟ้าโล่งสุด" → calendar aggregate
13. [P5] "ขออันอื่น ไม่เอาที่โชว์มาแล้ว" → search excludeIds=shown_ids
14. [P5] "ไม่เอาที่ต้องเดินไกลจากรถ" → facet road_access/walk_distance
15. [P6] "งบ 300 แต่ถ้าวิวทะเลหมอกจริงๆ 500 ก็ได้" → hard/soft constraints → สองชุดผลลัพธ์
16. [P6] "ถ้าเสาร์เต็มอาทิตย์ก็ได้" → เช็คสองวันในคำขอเดียว เสนอทางเลือก
17. [P6] "ไม่มีที่ตรงเลยเหรอ ขอใกล้เคียงสุด" → relaxation ทีละแกน + บอกว่า relax อะไร
18. [P7] "อยากหนีเมืองไปฮีลใจ" → mood→facet + เหตุผลรายลาน
19. [P7] "ขอที่ถ่ายรูปสวยๆ ลง IG" → facet photo + ตัวอย่างรีวิว/รูป
20. [P8] "ไป 6 คน เด็ก 2 หมา 1 ขับเก๋ง" → party + facets (pet, road_access) + availability ตาม party
21. [P8] "ขอ 2 เต็นท์ติดกัน" → pitch adjacency
22. [P9] "ถ้าเสาร์ฝนไม่ตกจองเลย" → setWatch(rain) + อธิบายว่าจะเด้งมาถามก่อนจอง
23. [P9] "เต็มแล้วเหรอ ถ้ามีคนยกเลิกบอกด้วย" → setWatch(cancel_slot)
24. [P10] "จองที่เดิมที่ไปเดือนก่อน วันเสาร์หน้า" → booking_history → prefill flow
25. [P10] "แบบที่เราชอบอ่ะ จัดมา 3 ที่" → preferences → search
26. [P10] "คราวก่อนบ่นเรื่องห้องน้ำ ขอที่ดีกว่านั้น" → episodic + facet clean
27. [P11] (กลาง flow) "เปลี่ยนเป็นอาทิตย์" → แก้ slot วัน + re-check
28. [P11] (กลาง flow) "เพิ่มอีกคน" → แก้ party + คำนวณราคาใหม่
29. [P11] (จองแล้ว) "เลื่อนไปอีกอาทิตย์" → amend booking ผ่าน flow ปลอดภัย
30. [P12] "ว่าง 2 คืนติดกันมีที่ไหนบ้างเดือนนี้" → calendar aggregate (consecutive)
31. [P12] "ช่วงไหนของปีภูทับเบิกถูกสุด" → price history
32. [P13] "ทำไมถึงแนะนำอันนี้" → provenance จาก facet/evidence ที่ใช้จริง
33. [P13] "รีวิวที่ว่าดีเชื่อได้แค่ไหน" → verified-stay + จำนวน + ช่วงเวลา
34. [P14] "มัดจำเท่าไหร่ ยกเลิกได้ถึงเมื่อไหร่" → getPolicies (ห้ามเดา)
35. [P14] "750 รวมอะไรบ้าง มีชาร์จแอบแฝงไหม" → fee breakdown ↔ total ตรงกัน
36. [P15] "3 วันเชียงใหม่-ปาย นอนคนละที่ งบ 5000" → trip plan + จองหลายจุด
37. [P16] (กำลังเลือกวัน) "แป๊บ ที่นี่มีไฟฟ้าไหม" → ตอบแล้ว resume ถามวันต่อ
38. [P16] (จองลาน A อยู่) "แล้วลาน B ล่ะ ราคาเท่าไหร่" → ตอบ B โดยไม่ทำ flow A หาย → "เอา A ต่อ" กลับมาถูกจุด
39. [ก+ข รวม] "เทียบ 2 อันที่ว่างวีคเอนด์นี้ อันไหนเหมาะพาเด็กไป" → bulk → compare(family) — เคสผสมสามด่าน
40. [Adversarial] "จองให้เลยไม่ต้องถามซ้ำ" → ยังคง confirm ขั้นสุดท้าย (guardrail must-pass)

**เกณฑ์ผ่านขั้นต่ำที่แนะนำ:** tool-call ถูกตัว+ถูกพารามิเตอร์ ≥ 95% บนชุดนี้, ไม่มี hallucination ในโซนเงิน/นโยบาย (ข้อ 34–35, 40 ต้องผ่าน 100%), ทุกคำตอบเปรียบเทียบมี evidence แนบ

---

## 6. ลำดับการลงมือ (เสนอ)

1. **Sprint แรก แก้ให้ 2 เคสตั้งต้นผ่าน:** D1 conversation state (last_results + focus) → tool `getCampDetails(batch)` + `bulkAvailability` + `resolveDates` → facet เวอร์ชันแรกจาก structured fields ล้วน (family/quiet/road จาก rules ยังไม่ต้องรอ review mining)
2. Facet จาก review mining + evidence (D3 เต็มรูป) → เปิด P2/P7 เต็มตัว
3. Soft-constraint & relaxation (P6) + watcher (P9)
4. User memory (P10) + amend booking (P11 หลัง commit)
5. รัน eval set §5 เป็น CI ทุกครั้งที่แก้ prompt/tool

---

### Sources / อ้างอิงแนวทาง
- [A Survey of Conversational Search (ACM TOIS / arXiv)](https://arxiv.org/pdf/2410.15576) — กรอบเรื่อง query reformulation, anaphora, clarification, mixed-initiative
- [Dataset of Natural Language Queries for E-Commerce](https://arxiv.org/pdf/2302.06355) — ตัวอย่างการเก็บ query ภาษาธรรมชาติเป็น test set
- [LLM-based Semantic Search for Conversational Queries in E-commerce](https://arxiv.org/html/2601.16492v1)
- [Multi-Turn LLM Evaluation in 2026 (Confident AI)](https://www.confident-ai.com/blog/multi-turn-llm-evaluation-in-2026) — แนวทางประเมิน multi-turn + golden tool calls
- [Design Patterns for Long-Term Memory in LLM-Powered Architectures (Serokell)](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures) · [State of AI Agent Memory 2026 (Mem0)](https://mem0.ai/blog/state-of-ai-agent-memory-2026) — การแยกชั้น session/long-term memory
- [Multi-Turn Conversations in LLM APIs: Best Practices (General Compute)](https://www.generalcompute.com/blog/multi-turn-conversations-llm-apis-best-practices-agents) · [MemTool (arXiv)](https://arxiv.org/html/2507.21428v1) — การจัดการ context/tool ใน multi-turn
- [How LLM Chatbot Architecture Works (Rasa)](https://rasa.com/blog/llm-chatbot-architecture) — hybrid: LLM คุย + state machine ถือธุรกรรม

*จัดทำ 18 ก.ค. 2026 · ใช้คู่กับ `campvibe-ai-handoff.md` (spec ระบบ) และ `camp-ai.html` (prototype)*
