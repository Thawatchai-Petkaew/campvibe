---
name: ux-validation-and-pdpa
description: Standard for the central catalog of field validation and PDPA masking. Use when adding or validating any form field; when displaying sensitive PII; when wiring user-facing error copy; or when deciding what to mask and how to reveal it. Memory for the Designer, Frontend, and Backend roles. Pairs with DESIGN.md, std/api.md, std/qa.md, std/security.md.
---

# UX Validation & PDPA Masking

## Overview

One zod schema validates a field on both client and server; one catalog owns every rule and every Thai error string a user reads. Sensitive PII is masked by default and revealed only when the user asks — because under PDPA, "showing" the data is a use the user controls.

## When to Use

- Adding or validating any form field (phone, email, name, password, OTP, camp data, dates, coordinates)
- Displaying sensitive PII anywhere in the UI (national ID, phone, name, birth date, payout account)
- Wiring user-facing error copy or deciding what to mask and how reveal works
- Reviewing a PR that touches form validation, error messages, or PII display

**NOT for:**

- Interaction states, a11y, i18n, em-dash rule, technical-jargon rule, test-id, form/error pattern — owned by `DESIGN.md`, do not duplicate; reference it instead
- Server-side enforcement plumbing of the shared schema — see `std/api.md`
- Test design around validation (happy/boundary/error coverage) — see `std/qa.md`
- Audit log definition and storage for reveal events — see `std/security.md`

> Read before working: this file + `DESIGN.md` (states/a11y/i18n/form-error pattern/test-id/no-em-dash/no-tech-jargon) + `std/api.md` (server enforces validation) + `std/qa.md` (tests cover validation) + `std/security.md` (audit logging).
> Scope of this file: the **central catalog** of field validation + PDPA masking only. What `DESIGN.md` already owns (interaction states, a11y, i18n, em-dash, technical jargon, test-id, form/error pattern) is **not duplicated** — reference it instead.

## Standards

### 1. Principles

- **One schema, shared client + server** — every field's validation is defined once with `zod`; the type is `z.infer<typeof schema>`. Forms use shadcn form + `<form noValidate>` (custom validation per `DESIGN.md`); the server enforces with the same schema (see `std/api.md`). Never have two divergent validation paths.
- **One catalog** — every validated field pulls its rule + error copy from the table below. Never inline regex or messages in individual forms. A new field → add it to this table first, then reference it.
- **Error copy = the real UI** — the Thai strings in the table are the copy the user actually sees (verbatim), stored in `locales/` as the source of truth (TH/EN); never hardcode. QA asserts the exact characters.
- **Masked by default** — sensitive PII renders masked by default and is revealed only when the user presses to reveal (PDPA: "showing" = a use of the data the user controls).

### 2. Validation catalog

Trigger/timing follows the form pattern in `DESIGN.md`; copy is verbatim.

| Field | rule / regex | error copy (Thai verbatim) |
|---|---|---|
| Mobile number `phone` | `^0[689]\d{8}$` (10 digits, digits only, strip non-digit) | `กรุณากรอกเบอร์มือถือที่ถูกต้อง` |
| Email `email` | max 100, no Thai characters `[฀-๿]`, format `^[^\s@]+@[^\s@]+\.[^\s@]+$` | `รูปแบบอีเมลไม่ถูกต้อง` |
| Full name (Thai) `firstName`/`lastName` | `^[ก-๙\s]+$` max 50 | `กรุณากรอกเฉพาะภาษาไทย` |
| Password `password` | ≥8 chars, letters + digits, show strength meter | `รหัสผ่านต้องมีอย่างน้อย 8 ตัว ผสมตัวอักษรและตัวเลข` |
| OTP `otp` | 6 numeric digits, ≤5 attempts/session, block 300 seconds | `รหัส OTP ไม่ถูกต้อง` |
| Camp name `campName` | `^[a-zA-Z0-9ก-๙\s]+$` max 100 (no special characters) | `ชื่อแคมป์ไม่รองรับอักขระพิเศษ` |
| Price/night `pricePerNight` | positive integer 0–100,000 THB | `ราคาต้องอยู่ระหว่าง 0–100,000 บาท` |
| Guests/capacity `capacity` | integer ≥1 | `จำนวนผู้เข้าพักต้องมากกว่า 0` |
| Booking date range `checkIn`/`checkOut` | check-out > check-in, no past dates (≥ today) | `วันเช็คเอาท์ต้องหลังวันเช็คอิน` |
| Province `provinceId` | select from master list (required) | `กรุณาเลือกจังหวัด` |
| Camp coordinates `lat`/`lng` | lat -90…90, lng -180…180 (decimal) | `พิกัดไม่ถูกต้อง` |

### 3. PDPA masking defaults

Mask glyph = `•` (U+2022) only · reveal via the eye-toggle component, auto-revert after 30 seconds · on every reveal → backend emits audit event `pdpa.sensitive_field_revealed` `{userId, field, ts, ip}` (defined/stored per `std/security.md`, not redefined here).

| Field | how to mask (glyph `•`) | how to reveal |
|---|---|---|
| National ID `nationalId` | keep first 1 + last 1 → `1-••••-••••XXX-Y` | eye-toggle 30s + audit |
| Mobile number `phone` | keep first 3 + last 2 → `081-•••-••XX` | eye-toggle 30s + audit |
| Full name (Thai + English) `fullName` | first character of each word → `เ•••••์ พ•••••••` | eye-toggle 30s + audit |
| Birth date `birthDate` | mask fully → `••/••/••••` | eye-toggle 30s + audit |
| Bank/PromptPay account (camp owner payout) `payoutAccount` | keep first 3 + last 1 → `XXX-•-•••••XX-X` | eye-toggle 30s + audit |
| **Do not mask:** email (must be user-editable) · camp location/shipping address (required for booking/travel flow) · province | show in full | — |

**Rule of thumb:** mask if the field is used (alone or combined) to (a) impersonate the user, (b) conduct a financial transaction, or (c) link across apps — do not mask demographic/categorical data or data the user must edit themselves.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "I'll mask with `X` / `*` / `_`." | Use `•` only (combinable with `-` `/` `()` to preserve the format). |
| "Client and server can validate slightly differently." | One zod schema, shared on both sides (server = authoritative, see `std/api.md`). |
| "A technical error message (`regex invalid`, `400`) is fine." | Use the Thai copy from the catalog (per `DESIGN.md` no-tech-jargon). |
| "Revealing PII doesn't need a log." | Emit an audit event on every reveal (`std/security.md`). |
| "I'll just repeat the validation rule / error string in this form." | One catalog, pulled in and shared. |

## Verify (exit criteria)

- [ ] Every validated field uses the rule + copy from the catalog (no inlining)
- [ ] One zod schema shared across client + server (`z.infer` is the type)
- [ ] Every PII field follows the masking table: glyph `•` + reveal 30s + audit event
- [ ] Thai error copy verbatim per catalog + lives in `locales/` (TH/EN)
- [ ] Tests cover validation (happy + boundary + error), including server-side, per `std/qa.md` (coverage ≥80% on new code)
