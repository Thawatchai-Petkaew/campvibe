---
linear: CAM-411
feature: ai-assistant
epic: ai-camping-assistant-a1-a4-b1-b3-c-inquiry (CAM-266)
persona: camper
artifact: design
owner: ux-designer
status: In Progress
version: v1
updated: 2026-07-18
---
# Design — Assistant personality: name, avatar and camp-friend voice (CAM-411)

> **G2 class: novel-ui** (new brand identity for the assistant: a name, an avatar mark,
> a system-prompt voice, plus bubble/welcome polish). Full design brief. DESIGN ONLY —
> Frontend builds the components from this brief; the Thai tone line (§Personality tone)
> is a MODEL INSTRUCTION for the AI backend, not a UI string.

## User job (from AC)

A camper opens the CampVibe chat to find a campsite. Today the chat is functional but
faceless — a generic title (`ผู้ช่วยหาที่กางเต็นท์`) and a `Sparkles` button. This story
gives the assistant an **identity**: a short Thai name, a consistent avatar mark, a warm
plain-language voice, and enough visual polish (avatar beside each reply, a gentle
entrance, a richer welcome) that asking for a camp feels like chatting with a fellow
camper who knows their stuff — not a bot. Discover-only, unchanged: no booking, no lead,
no card-list changes.

## Personality — name

Candidates (Thai, camp-friendly, short):

| Candidate | Reads as | Why / why not |
|---|---|---|
| **น้องกองไฟ** (Kongfai, "campfire buddy") | the friend you sit with at the campfire | ✅ **chosen** — the campfire is the social heart of a camp, exactly where people gather to ask, share tips and plan; a conversational helper IS that companion. Camp-native (not a generic bot name), warm without being cutesy, ties straight to a `Flame` avatar. |
| น้องแคมป์ (Nong Camp) | "camp buddy" | Safe and literal, but generic — many Thai apps use a plain `น้อง<noun>`; no evocative hook. |
| น้องเต็นท์ (Nong Tent) | "tent buddy" | Names an object, colder than the campfire metaphor; no gathering/warmth association. |

**Chosen: `น้องกองไฟ` / EN `Kongfai`.** Rationale: it carries the exact target voice —
*เพื่อนนักแคมป์ที่รู้จริง* — warm and gathering, holds DESIGN.md §1 "friendly but not
cutesy," is short enough for a small header, gender-neutral via `น้อง`, and pairs
one-to-one with the `Flame` mark so the name and the avatar reinforce each other
everywhere. The existing title `ผู้ช่วยหาที่กางเต็นท์` demotes to a **role subtitle** under
the name (so EN users and screen readers still get the plain-language role).

## Avatar (mark)

- **`Flame` (lucide) inside a token-tinted round icon-chip** — the DESIGN.md §3 "icon-chip
  background" pattern: a `rounded-full` wrapper `bg-primary/10` (10% teal tint) + the
  `Flame` icon in `text-primary`. `aria-hidden="true"` (decorative — the name carries the
  meaning in text). **No emoji, no external image, token-only.**
- The flame is **brand-tinted teal** — a stylised mark, not a literal orange fire — so it
  holds the teal calm-confidence POV and never reads as a warning/destructive signal.
- **One mark, everywhere** (identity consistency): the launcher FAB icon changes
  `Sparkles → Flame`; the header, the welcome hero, and each assistant bubble use the same
  chip. Build a tiny presentational `AiChatAvatar` in `components/ai-chat/` with three
  sizes so it can't drift:

  | size | wrapper | icon | used in |
  |---|---|---|---|
  | `sm` | `h-8 w-8` | `size-4` | beside each assistant bubble + typing indicator |
  | `md` | `h-10 w-10` | `size-5` | panel header |
  | `lg` | `h-12 w-12` | `size-6` | welcome hero |

  This is a **composition of an existing DESIGN.md pattern**, not a new primitive (the
  launcher FAB itself stays a `Button` with the `Flame` child).

## Personality tone — the exact system-prompt line (for the AI backend)

The AI backend appends **this one Thai line** to `buildSystemPrompt()` in
`lib/ai/openrouter-client.ts` — insert it as the second array item, right after the
existing `"You are the CampVibe camping assistant…"` line and before the injection-guard
line, so the persona frames the whole prompt. Every other existing prompt line (CAM-405
plain-text rules, CAM-408 date/filter guidance) stays unchanged. It is a **model
instruction**, so it lives inline in the code like the other prompt lines — NOT in
`locales/`.

> `คุณคือ "น้องกองไฟ" ผู้ช่วยหาที่กางเต็นท์ของ CampVibe คุยกับผู้ใช้แบบเพื่อนนักแคมป์ที่รู้จริง อบอุ่น สุภาพ และกระชับ ใช้ภาษาพูดที่คนทั่วไปเข้าใจง่าย ไม่ใช้ศัพท์เทคนิคและไม่ใส่อีโมจิ ตอบให้ตรงคำถาม ไม่เยิ่นเย้อและไม่ทำตัวน่ารักเกินจำเป็น ถ้ายังไม่พบที่กางเต็นท์ที่ตรงกับที่ผู้ใช้ต้องการ ให้บอกตามตรงแล้วชวนปรับเงื่อนไขการค้นหา`

It establishes: identity + name · เพื่อนนักแคมป์ที่รู้จริง (warm, polite, concise) · plain
language, no jargon, no emoji · answer directly, don't ramble or over-cutesy (holds §1
"not cutesy") · be honest when nothing is found and invite adjusting the search (Trust,
`principles.md` #1). It does NOT override CAM-405's "answer in the camper's language" rule.

## Flow (delta only — the CAM-272 flow is unchanged)

```
Launcher FAB (Flame mark, "คุยกับน้องกองไฟ")
  └─ tap → panel opens
       ┌──────────── panel ────────────┐
       │ header: [Flame avatar] น้องกองไฟ        (close 44px) │
       │                        ผู้ช่วยหาที่กางเต็นท์          │
       │ message log:                                        │
       │   • welcome (empty): [Flame hero]                   │
       │       greeting-by-name → "ลองถามแบบนี้ดู" → 3 pills │
       │   • assistant turn: [Flame] │ bubble  (eases in)    │
       │       └ cards render FULL-WIDTH below (UNCHANGED)    │
       │   • user turn: bubble (right, no avatar, eases in)   │
       │   • typing: [Flame] │ • • •  (dots UNCHANGED)        │
       │   • notices: [Flame] │ bubble (rate-limit/disabled)  │
       │ composer (UNCHANGED)                                 │
       └──────────────────────────────────────────────────────┘
```

## Visual polish specs

**Header (`AiChatPanel`, the top band).** Replace the single title `<p>` with an identity
cluster: `AiChatAvatar size="md"` + a two-line stack — name (`font-heading text-base
font-medium leading-tight text-foreground truncate` = `aiChat.name`) over role (`text-xs
text-muted-foreground leading-tight truncate` = `aiChat.role`). Wrap in `flex items-center
gap-3 min-w-0`; the close `Button` (`h-11 w-11`) and the `border-b` divider stay. Set the
panel `aria-label` to the composed `{name} {role}`.

**Assistant bubble + avatar.** Each assistant-side row becomes
`flex items-start gap-2` = `AiChatAvatar size="sm"` (top-aligned, `shrink-0`) + the
existing bubble (`max-w-[85%] rounded-2xl bg-muted px-4 py-2.5`). Applies to the answer
bubble, the typing indicator, and every notice bubble (rate-limit / disabled / error).
**The in-chat card block stays full-width, rendered BELOW this row — never indented under
the avatar** (preserves CAM-407's card-width fix; the card list is out of scope). The user
bubble keeps `self-end`, no avatar.

**Entrance micro-motion (motion-safe only).** Each message turn eases in once on mount via
`motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1
motion-safe:duration-200` on the turn's outer wrapper — transform + opacity only, ~200ms,
using the same `tw-animate-css` idiom the panel already uses for its bottom-sheet slide.
Under `prefers-reduced-motion` the utilities don't apply → instant appear (EC-1). The
typing 3-dot pulse is unchanged.

**Richer welcome / empty state.** `space-y-4 py-2`: a hero block (`flex flex-col
items-start gap-3`) with `AiChatAvatar size="lg"` above the name-voiced greeting
(`aiChat.welcomeHeading`), then a labelled examples block (`aiChat.welcomeExamplesLabel`
= "ลองถามแบบนี้ดู" in `text-xs text-muted-foreground`) above the **3 existing** prompt
pills. Clear top-down hierarchy (avatar → greeting → label → pills), teal-tinted mark, no
gradient. Bump the pills from `size="sm"` (h-9/36px) to `size="default"` (h-11/44px) so the
tap target meets the DESIGN.md §3 bar (BR-5).

**Launcher.** Swap the FAB icon `Sparkles → Flame` (same mark family); `aria-label` =
`aiChat.launcherLabel` (now "คุยกับน้องกองไฟ"). All existing launcher states
(`hover:scale-105`, `active:scale-95`, focus ring, `h-12 w-12` ≥44px) are unchanged.

## States (8)

This story introduces **no new interactive element** — the interactive set (Launcher L,
Composer C, Send S, Suggestion pills P, in-chat Card K) and its full 8-state matrix are
**unchanged from CAM-272 §States** (see that brief). Deltas only:

- **Launcher (L):** icon `Sparkles → Flame`; states unchanged (default/hover `scale-105`/
  focus ring/active `scale-95`; never disabled).
- **Suggestion pills (P):** size `sm → default` (h-11) for tap target; default/hover
  `bg-accent`/focus ring/active `scale-95`/disabled-while-sending all unchanged.
- **Avatar:** **decorative, non-interactive** (`aria-hidden`) — no interactive states; it
  is a static mark, so the "every interactive element has 8 states" rule does not add a
  new obligation here.
- **empty:** the richer welcome (above). **loading:** typing indicator gains the avatar,
  dots unchanged. **error:** notice bubbles gain the avatar; copy unchanged except
  `disabled` (name-voiced). All per CAM-272.

## Components & tokens

**Components (from the system — no invention):** `Button` (launcher, send, pills) ·
`Textarea` (composer) · `ScrollArea` · `ErrorBanner` (error notice) · `CampgroundCard`
(in-chat card, untouched) · lucide `Flame` (new mark) / `Send` / `Clock` / `Info` /
`X` · new `AiChatAvatar` = a composition of the DESIGN.md §3 icon-chip pattern (not a new
primitive).

**Tokens — all existing, NO new token:**

| Token | Use |
|---|---|
| `primary` (via `bg-primary/10` + `text-primary`) | avatar icon-chip (fill tint + Flame mark) |
| `foreground` / `muted-foreground` | header name (foreground) + role subtitle & examples label (muted-foreground) |
| `muted` | assistant bubble + typing/notice bubble surface (unchanged) |
| `primary` / `primary-foreground` | launcher, send, user bubble (unchanged) |
| `border` / `ring` | header divider + focus rings (unchanged) |

**Radius / size / spacing (DESIGN.md §2):** avatar chip `rounded-full` (h-8/h-10/h-12);
bubbles `rounded-2xl px-4 py-2.5` (unchanged); pills `rounded-full` `h-11`; header gap
`gap-3`, welcome `space-y-4`. **Motion (§2):** transform+opacity, 120–250ms, motion-safe,
no `transition: all`.

## Copy (keys → verbatim TH / EN)

> Frontend updates `locales/translations.json` (`aiChat.*`, TH + EN) before any hardcoded
> string. `design.md` is the verbatim source of truth. No em-dash separator, no jargon
> (DESIGN.md §4). The §Personality tone line is a MODEL INSTRUCTION and does **not** go here.

| key | status | TH (verbatim) | EN |
|---|---|---|---|
| `aiChat.name` | NEW | `น้องกองไฟ` | `Kongfai` |
| `aiChat.role` | NEW | `ผู้ช่วยหาที่กางเต็นท์` | `Camping assistant` |
| `aiChat.welcomeExamplesLabel` | NEW | `ลองถามแบบนี้ดู` | `Try asking:` |
| `aiChat.launcherLabel` | CHANGED | `คุยกับน้องกองไฟ` | `Chat with Kongfai` |
| `aiChat.welcomeHeading` | CHANGED | `สวัสดี เราน้องกองไฟเอง อยากได้ที่กางเต็นท์แบบไหน ลองเล่าให้ฟังได้เลย` | `Hi, I'm Kongfai. Tell me what kind of campsite you're after.` |
| `aiChat.zeroResult` | CHANGED | `ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ` | `I couldn't find a match yet. Tell me a bit more and I'll try again.` |
| `aiChat.disabled` | CHANGED | `น้องกองไฟยังไม่พร้อมให้บริการ` | `Kongfai is not available yet.` |

**KEPT unchanged** (CAM-272): `aiChat.title` (still the panel accessible-name base),
`close`, `composerPlaceholder`, `send`, `typing`, `loading`, `suggestion1`–`suggestion3`
(the 3 pills), `error`, `retry`, `rateLimited`.

## a11y (WCAG 2.1 AA per DESIGN.md §3)

- **Avatar is decorative** → `aria-hidden="true"` on every `AiChatAvatar`; the identity is
  in the header text + the `role="log"` region — do NOT announce the mark per message
  (matches `.claude/rules/loading.md` §5 "decorative shapes aria-hidden").
- **Header** → the panel `aria-label` composes `{name} {role}` so a screen reader announces
  `น้องกองไฟ ผู้ช่วยหาที่กางเต็นท์` on open.
- **Motion** → `motion-safe:` gated; reduced-motion = instant appear (EC-1).
- **Tap targets** → welcome pills raised to `h-11` (≥44px, BR-5); launcher `h-12`, close
  `h-11 w-11` unchanged.
- **Contrast (verify with axe at build, not measured):** name `text-foreground` on
  `bg-popover` and role/label `text-muted-foreground` on `bg-popover` are the DESIGN.md §2
  primary/secondary-text pairs (AA). The `Flame` mark is a non-text graphic on `bg-primary/10`
  (the approved dashboard icon-chip idiom) — **not measured**, confirm ≥3:1 graphics
  contrast with axe.
- **Icons** → lucide only (`Flame`, `Send`, `Clock`, `Info`, `X`); no emoji (standing rule).

## Test IDs (`<type>--<module>-<detail>`)

Unchanged from CAM-272. New/affected: `img--ai-chat-avatar` on the `AiChatAvatar` mark (or
omit — it is `aria-hidden` decorative; add only if QA needs to assert its presence). The
header, welcome (`empty--ai-chat-welcome`), bubbles, typing (`status--ai-chat-typing`) and
launcher (`btn--ai-chat-launcher`) test IDs are unchanged.

## Anti-slop (§5) self-check

Teal POV held (avatar is teal-tinted, no orange fire, no gradient); the identity gives
personality via a camp-native mark, not a generic purple bot blob; clear top-down
hierarchy in the header (avatar + name + role) and welcome (avatar → greeting → label →
pills); no heavy-shadow or card-in-card stacking; reuses the icon-chip pattern and the
CampgroundCard (no parallel card style). Motion is restrained (from-bottom-1, ~200ms).

## Non-goals

- **No card-list / answer-body change.** The in-chat card render and the answer body are
  owned by CAM-409 (carousel) and CAM-410 (chips) — this story does not touch that block,
  to avoid a merge conflict (land CAM-411 after them).
- **No new avatar illustration / mascot art.** A token-tinted lucide `Flame` mark is the
  whole avatar — no bespoke SVG character, no external image (keeps it token-only and
  dark-mode-safe).
- **No streaming, no `/assistant` page.** → CAM-412 / later.

## Seams & coordination (for Frontend / AI backend)

- **AI backend:** append the §Personality tone line inside `buildSystemPrompt()`
  (`lib/ai/openrouter-client.ts`); a `buildSystemPrompt()` unit test should assert the
  line is present (AC-6). No endpoint/contract change.
- **Frontend:** build `AiChatAvatar` (3 sizes) once; consume it in the launcher, header,
  welcome and message list. Edit ONLY header (AiChatPanel), welcome + assistant rows +
  typing (AiChatMessageList), launcher icon (AiChatLauncher). Do NOT edit the `entry.cards`
  block. Sequence after CAM-409/410 merge.

## Design Gate self-check (DESIGN.md §6 — this PR must pass)

- [ ] **Token-only** — avatar `bg-primary/10` + `text-primary`; no new token; `check:palette` green.
- [ ] **Component-in-system** — `Button`/`Textarea`/`ErrorBanner`/`CampgroundCard` reused; `AiChatAvatar` = icon-chip composition; lucide `Flame` only, no emoji, no external image.
- [ ] **Scale matches role** — avatar `rounded-full`; bubbles `rounded-2xl`; pills `rounded-full h-11`; no inline height override.
- [ ] **All 8 states** — no new interactive element; L/C/S/P/K states inherited from CAM-272; pills bumped to h-11; avatar decorative (aria-hidden).
- [ ] **Loading** — typing indicator keeps its 3-dot pulse (correct loader, NOT a skeleton) + `aria-live`; dots disabled under reduced-motion.
- [ ] **a11y AA** — avatar `aria-hidden`; panel aria-label = name+role; tap ≥44px; focus rings; contrast pairs AA (mark contrast verified with axe at build).
- [ ] **i18n** — all copy in `locales/` `aiChat.*` TH + EN; no em-dash separator, no jargon; tone line is a model instruction, not a UI string.
- [ ] **Motion** — entrance transform+opacity ~200ms, motion-safe, no `transition: all`, respects reduced-motion.
- [ ] **Anti-slop (§5)** — teal POV, clear hierarchy, no gradient/heavy-shadow stack, no parallel card style.
- [ ] **Card list untouched** — diff confirms the `entry.cards` block is unchanged (CAM-409/410 boundary).

## Links

`../../feature.md` (## Design overview) · `../CAM-272-ai-chat-shows-campsite-cards-in-the-conversation-t/design.md` (base chat brief) · `DESIGN.md` (§1 voice · §2 tokens/motion · §3 icon-chip · §5 anti-slop · §6 gate) · `story.md` (BR-1..5) · `components/ai-chat/AiChatPanel.tsx` · `components/ai-chat/AiChatMessageList.tsx` · `components/ai-chat/AiChatLauncher.tsx` · `lib/ai/openrouter-client.ts` (`buildSystemPrompt`) · `docs/context/principles.md` (#1 Trust)

## Changelog
- v1 (2026-07-18) — created (G2 novel-ui personality brief: name น้องกองไฟ, Flame avatar, tone line, welcome/bubble/launcher polish).
