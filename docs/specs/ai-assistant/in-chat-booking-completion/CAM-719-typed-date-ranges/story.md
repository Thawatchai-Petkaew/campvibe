# CAM-719 — A camper can type a date range, and no date is ever silently misread

version 1 · 2026-08-13

## Story

As a **camper** typing my stay dates in the booking flow, I want a range like "19-21" understood as a two-night stay, so that I can book the days I actually mean instead of being re-asked or, worse, booked onto a different date.

Why: the owner typed "ต้องการจอง 19-21 ที่จะถึง" and got the unreadable reprompt. Exploration (regexes RUN, not read) found no range rule exists — and a silent misread hiding behind it: `ABSOLUTE_THAI_MONTH_RE` is unanchored, so "19-21 ส.ค." scans past "19-" and resolves **21 Aug, one night**, silently discarding the camper's span. "19 ส.ค. - 21 ส.ค." collapses to its start. A silent wrong date is worse than a miss.

Scope: `lib/ai/date-phrases.ts` · `components/ai-chat/booking-flow.ts` (the accept ceiling) · `lib/ai/tools/resolve-dates.ts` (description) · `locales/translations.json` (hint copy) · tests. Depends on: —

## AC

| # | Given | When | Then (user sees, Thai verbatim) | System effect | Neg/edge |
|---|---|---|---|---|---|
| AC-1 | The date step is asking | The camper types ต้องการจอง 19-21 ที่จะถึง | ข้ามไปถามจำนวนคนทันที ไม่ถามจำนวนคืนซ้ำ | Range parsed: check-in the 19th (next occurrence), exclusive checkout the 21st, nights pre-filled = 2 via the CAM-699 seam | EC-1, EC-2 |
| AC-2 | The date step is asking | The camper types 19-21 ส.ค. | สรุปภายหลังแสดงเข้า 19 ส.ค. พัก 2 คืน | The silent-misread path is dead: the range rule fires BEFORE the absolute rule | EC-3 |
| AC-3 | The date step is asking | The camper types 19 ถึง 21 สิงหา or วันที่ 19 ถึง 21 or 19 ส.ค. - 21 ส.ค. | ผลเดียวกัน เข้า 19 พัก 2 คืน | One rule covers dash and ถึง, with and without month/year (พ.ศ. and ค.ศ.) | — |
| AC-4 | The date step is asking | The camper types a range longer than 30 nights (เช่น 1-15 ต.ค. ถึงเดือนถัดไป or 1 ส.ค. - 15 ก.ย.) | ระบบบอกว่าจองได้ไม่เกิน 30 คืน ลองเลือกช่วงสั้นลง (ใช้ shape ปฏิเสธเดิมของขั้นคืน) | The typed-range MAX_BOOKING_NIGHTS bypass in acceptDateCandidate is closed | EC-4 |

## Rules

- BR-1 The range rule inserts BETWEEN rule 7 (single weekday) and rule 8 (absolute) in `resolveDatesCore` — ordering is load-bearing: after rule 8 it is unreachable for month-bearing ranges (rule 8 eats the second number); before rule 7 risks nothing but is unnecessary (ranges never contain weekday names).
- BR-2 Semantics: "19-21" = check-in 19, checkout 21 EXCLUSIVE = 2 nights (the repo-wide endDate contract). Monthless = the next future occurrence of the start day (this month if not past, else next month); "ที่จะถึง" and similar trailing qualifiers are tolerated as noise. Buddhist-era and Gregorian years both normalise via the existing helpers.
- BR-3 The rule returns exactly ONE DateRange (parseDateAnswer consumes `dates[0]` only). An inverted range (21-19) resolves by the same next-occurrence logic per number and, if still inverted, is rejected as unsupported — never silently swapped.
- BR-4 The rule reuses the existing siblings: `THAI_MONTH_ALIAS_TO_NUMBER`, `isValidCalendarDate`, `normalizeYearToGregorian`. No second month table.
- BR-5 `acceptDateCandidate` gains the `MAX_BOOKING_NIGHTS` (30) ceiling, rejecting through the existing `too_long`-equivalent shape — no new rejection kind.
- BR-6 The typeHint and unreadable copy gain a range example so the promise matches reality (the CAM-645 precedent: copy must not promise what the parser cannot read — and now must ADVERTISE what it can). Keep no-em-dash, no-particle, TH/EN parity (cam-638 structural guards).
- BR-7 The resolve-dates tool description mentions ranges (it serves the assistant too). lib/ai changes → the real-model gate runs; the golden corpus has NO range case today (swept), so this is additive — add one non-guardrail eval case for a range phrase if cheap, with the fixture-count pin bumped.

## Edge cases

- EC-1 IF the start day has already passed this month (e.g. typing 5-7 on the 13th) THEN resolve to next month's 5-7, consistent with rule 8's next-occurrence behaviour.
- EC-2 IF the range spans a month boundary via explicit months (30 ส.ค. - 2 ก.ย.) THEN it resolves correctly across the boundary.
- EC-3 IF the text contains a range AND an unrelated number (ต้องการจอง 19-21 สำหรับ 4 คน) THEN the rule must anchor on the range and not mis-eat the party size; the party number is simply ignored by the date step (guests asked next, as today).
- EC-4 IF the range is exactly 30 nights THEN it passes (ceiling inclusive, matching the nights step's own bound).
- EC-5 IF the typed range is 1 night (19-20) THEN checkIn/checkOut set but nights NOT pre-filled — preserving the cam-699 pin that 1-night phrases still ask the nights step. (Decide honestly: a 19-20 range IS an explicit 1-night statement, so pre-filling nights=1 is arguably correct — but that changes the pinned behaviour. Default to preserving the pin; if you conclude pre-fill is more truthful, supersede the pin with a dated note and say so in the PR.)

## Data

None.

## Seams & refs

`lib/ai/date-phrases.ts:445-552` (the 11-rule dispatch; insert at :519) · `:166-172` (regex siblings) · `:203-242` (resolver sibling) · `components/ai-chat/booking-flow.ts:294-310` (acceptDateCandidate — the ceiling gap) · `:269-270` (dates[0] only) · the CAM-699 nights pre-fill seam (`:308-309`) · `lib/ai/tools/resolve-dates.ts:88` (second consumer) · hint copy `locales/translations.json:2341/:2343` (+EN :1130/:1132). Pins: cam-638-booking-copy :37/:40 (supersede with dated note) · cam-645 (rules 1-7 unshadowed — must stay green) · cam-699 :253-254 (1-night no-prefill) · cam-640-booking-turn :136-151 (typed/chip equivalence) · cam-462/479 (older rules).

## Out of scope

- Weekend-only date chips (a round-1 snapshot design; typing now covers all days — evaluate at G4 whether a richer picker is warranted).
- Any model-behaviour change; the parser is pure and deterministic.

## Self-verify

- The parser is a pure function: a deterministic matrix over every AC/EC form, INCLUDING the anti-silent-misread cases (19-21 ส.ค. → 2 nights from the 19th, NEVER 1 night on the 21st; 19 ส.ค. - 21 ส.ค. → the same, never collapsed to its start).
- Full suite as the last act (all named pins green) · lint · typecheck · ai-guardrail-gate green on CI.
- Localhost: drive the real flow with the owner's exact sentence and screenshot the summary showing พัก 2 คืน.
