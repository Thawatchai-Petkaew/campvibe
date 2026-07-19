---
ticket: CAM-426
feature: ai-assistant
epic: chat-experience-overhaul
persona: Camper
artifact: design
owner: ux-designer
status: in-progress
version: v1
updated: 2026-07-19
---

# Design — AI Expression Layer (CAM-426)

> **Purpose.** Make the AI assistant surface feel futuristic / ล้ำ **within CampVibe's guardrails**.
> This is a **Design Brief for G2** — a token proposal + a DESIGN.md sanctioned-exception + the
> application spec. **Nothing here edits `app/globals.css` / `DESIGN.md` / `locales/` yet.** Frontend (S2)
> applies the diffs below **after the owner's G2 tap.**
>
> **Owner's #1 ask:** the chat should feel ล้ำ (ambient aurora, glass, teal→sky gradient) — re-derived
> from OUR tokens (`--primary` teal, `--info` sky), never a copied prototype hex.

## Scope

- **In scope:** the assistant surface **only** — the chat panel (`AiChatPanel`), the message list
  (`AiChatMessageList`), the assistant avatar (`AiChatAvatar`). A closed `--ai-*` token set derived from
  `--primary` + `--info`. A DESIGN.md sanctioned-exception paragraph. 8 states + a11y. A frontend build checklist.
- **Out of scope:** the chat data/stream contract (→ Architect), the component code itself (→ Frontend S2),
  any standard page (Home / dashboard / booking) — those keep stock tokens and 120–250ms motion, untouched.

## Big-picture research (done before designing)

- `--primary` teal hue = **186–188**, `--info` sky hue = **237.0** (globals.css `:root` L88/L103, `.dark` L133/L147).
  The `--ai-*` set uses **only these two hues** (+ their blend ~205–210) — no invented hue.
- `@theme inline` (globals.css L34–80) is the mapping layer that turns a `--x` var into a Tailwind utility
  (`--color-* → bg-*/text-*`, `--shadow-* → shadow-*`). The `--ai-*` utilities plug in here.
- `check:palette` **exempts `app/globals.css`** (L68) → OKLCH/gradient literals belong there, never in a component.
  It flags numbered palette (`from-teal-400`) and raw hex (`#…`, `[#…]`) in `app/**`/`components/**`.
- `check:ds` **R1** bans `rounded-(sm|md|lg)` and **R2** bans `shadow-xl|shadow-xs|shadow-inner` on consumers
  → the glow MUST be a `--ai-glow` box-shadow var (utility `shadow-ai-glow`), NOT `shadow-xl`; radius stays
  role-scale (`rounded-3xl` panel, `rounded-2xl` bubble), never `rounded-lg`.
- The existing `@media (prefers-reduced-motion …)` block (globals.css L200–211, CAM-245) is the **precedent
  pattern** any AI motion must follow: gate motion in `no-preference`, no-op it in `reduce`.
- **Reuse, don't reinvent:** the surface composes existing primitives — `Textarea` (composer), `Button size="icon"`
  (send), `Avatar`/icon-chip (assistant), `LoadingSpinner`, `ErrorBanner`, `Sparkles`/`Send`/`Square`/`RotateCw`
  from **lucide** (§7, lucide-only). No new component vocabulary; only the ambient/glass **styling layer** is new.

---

## 1) `--ai-*` token set (derived from `--primary` + `--info`)

Four tokens, complete light + dark, OKLCH matching globals.css style. **All hues ∈ {186–188 teal, 237 sky, ~205–210 blend}.**

| token | role | light | dark |
|---|---|---|---|
| `--ai-tint` | assistant message-bubble fill + soft accent surface | `oklch(0.965 0.018 205)` | `oklch(0.300 0.028 210)` |
| `--ai-surface` | glass panel base (translucent, pairs with `backdrop-blur`) | `oklch(0.995 0.006 205 / 0.72)` | `oklch(0.225 0.012 224 / 0.70)` |
| `--ai-glow` | ambient glow box-shadow on the panel/avatar (NOT `shadow-xl`) | see block below | see block below |
| `--ai-gradient` | ambient aurora background image (teal→sky) | see block below | see block below |

**Contrast note (honesty):** the assistant bubble uses `text-foreground` on `bg-ai-tint`. Light `--ai-tint`
L≈0.965 vs foreground L≈0.148 = **near-parity with foreground-on-background** (a combo the token system already
guarantees ≥ AA); dark `--ai-tint` L≈0.300 vs foreground L≈0.987 = high contrast. **AA by token parity — exact
ratio NOT measured with a tool; Frontend must axe-verify at build (Design Gate a11y).**

### Exact lines to add to `app/globals.css`

**(a) `:root` block (after L123 `--foreground:`), light values:**

```css
    /* ── CAM-426 AI Expression Layer — assistant surface only (see DESIGN.md §2.1) ── */
    /* Derived strictly from --primary (teal 186–188) + --info (sky 237); blend hue ~205–210. */
    --ai-tint: oklch(0.965 0.018 205);
    --ai-surface: oklch(0.995 0.006 205 / 0.72);
    --ai-glow:
      0 0 0 1px oklch(0.511 0.096 186.391 / 0.10),
      0 1px 2px oklch(0.148 0.004 228.8 / 0.04),
      0 18px 50px -24px oklch(0.511 0.130 237.0 / 0.28),
      0 6px 20px -12px oklch(0.511 0.096 186.391 / 0.22);
    --ai-gradient:
      radial-gradient(120% 130% at 12% 0%, oklch(0.511 0.096 186.391 / 0.12) 0%, transparent 46%),
      radial-gradient(120% 130% at 100% 8%, oklch(0.511 0.130 237.0 / 0.12) 0%, transparent 52%);
```

**(b) `.dark` block (after L164 `--sidebar-ring:`), dark values:**

```css
    /* ── CAM-426 AI Expression Layer (dark) — brighter aurora + glow for the dark canvas ── */
    --ai-tint: oklch(0.300 0.028 210);
    --ai-surface: oklch(0.225 0.012 224 / 0.70);
    --ai-glow:
      0 0 0 1px oklch(0.637 0.143 237.0 / 0.22),
      0 1px 2px oklch(0 0 0 / 0.30),
      0 24px 64px -22px oklch(0.437 0.078 188.216 / 0.50),
      0 0 40px -14px oklch(0.637 0.143 237.0 / 0.28);
    --ai-gradient:
      radial-gradient(120% 130% at 12% 0%, oklch(0.437 0.078 188.216 / 0.26) 0%, transparent 46%),
      radial-gradient(120% 130% at 100% 8%, oklch(0.637 0.143 237.0 / 0.22) 0%, transparent 52%);
```

**(c) `@theme inline` block (add after L78 `--color-sidebar-ring:` mapping) — makes the Tailwind utilities:**

```css
    --color-ai-tint: var(--ai-tint);           /* → bg-ai-tint / text-ai-tint */
    --color-ai-surface: var(--ai-surface);     /* → bg-ai-surface */
    --shadow-ai-glow: var(--ai-glow);          /* → shadow-ai-glow (NOT shadow-xl; passes check:ds R2) */
```

**(d) ambient-aurora utility + optional drift (append after the reduced-motion block, ~L211):**

```css
/* ── CAM-426 AI Expression Layer — ambient aurora utility (assistant surface only) ── */
@layer components {
  .ai-aurora {
    background-image: var(--ai-gradient);
  }
}

/* OPTIONAL, owner-gated enhancement — slow ambient drift. OFF by default; ship static for S2.
   Motion-safe only; no-op under reduce-motion (follows the CAM-245 precedent). Transform/opacity only.
   Do NOT enable without an explicit owner G2 sign-off on the named motion (see §Motion honesty). */
@media (prefers-reduced-motion: no-preference) {
  .ai-aurora-drift {
    animation: ai-aurora-drift 14s ease-in-out infinite alternate;
    will-change: transform, opacity;
  }
}
@keyframes ai-aurora-drift {
  from { transform: translate3d(0, 0, 0) scale(1);        opacity: 0.9; }
  to   { transform: translate3d(1.5%, -1.5%, 0) scale(1.04); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ai-aurora-drift { animation: none; }
}
```

**Guard confirmation:**

- `check:palette` — all literals live in `app/globals.css` (exempt); the component references only
  `bg-ai-surface` / `bg-ai-tint` / `text-foreground` / `shadow-ai-glow` / `ai-aurora` (no numbered palette, no hex). **PASS.**
- `check:ds` — glow = `shadow-ai-glow` (not `shadow-xl/xs/inner`, R2 clean); radius = `rounded-3xl`/`rounded-2xl`
  (no `rounded-sm/md/lg`, R1 clean); no `!h-*`, no `rounded-[Npx]`, no `text-[Npx]`. **PASS.**

---

## 2) DESIGN.md sanctioned-exception (exact prose to add)

Add as a new subsection **§2.1** in `DESIGN.md`, immediately after §2's Motion-tokens block:

```markdown
### §2.1 Sanctioned exception — AI Assistant Expression Layer (CAM-426)

**Scope: the assistant surface ONLY** — `components/ai-chat/*` (`AiChatPanel`, `AiChatMessageList`,
`AiChatAvatar`). No standard page (Home / catalog / dashboard / booking / auth) may use this exception;
those keep stock tokens and the standard 120–250ms transform/opacity motion.

Within that scope, and using ONLY the closed `--ai-*` token set (`--ai-tint`, `--ai-surface`, `--ai-glow`,
`--ai-gradient` — derived in `app/globals.css` from `--primary` teal + `--info` sky), the assistant surface MAY:

1. render an **ambient aurora** background layer (`.ai-aurora`, `aria-hidden`, `pointer-events-none`) — a subtle
   teal→sky gradient, **static by default**;
2. use a **glass card surface** (`bg-ai-surface` + `backdrop-blur-xl`) for the panel;
3. apply the **`--ai-glow`** ambient glow (`shadow-ai-glow`) to the panel and assistant avatar;
4. tint the assistant bubble with **`bg-ai-tint`** (`text-foreground`, ≥ AA).

**Still binding inside the exception:** role-radius (`rounded-3xl` panel, `rounded-2xl` bubble — never
`rounded-lg`), lucide-only icons, no emoji, all copy in `locales/` (TH+EN), all 8 states, WCAG 2.1 AA
(contrast, visible focus ring `ring-ring`, tap ≥44px), `check:palette` + `check:ds` green.

**Motion within the exception:** entrance + panel-open clamp to **≤250ms** transform/opacity (standard rule).
A longer **one-shot 450–700ms surface morph** (panel "materialize") OR a **slow ambient aurora drift loop** is
permitted ONLY when it is (a) explicitly named + justified in the story's `design.md`, (b) OFF under
`prefers-reduced-motion`, (c) transform/opacity only. Either one is a **human Design-Gate item** — it does not
pass on the pre-authorized standard class.

This exception is the record that legitimizes the futuristic assistant look; anything beyond items 1–4 above,
or any attempt to reuse `--ai-*` outside the assistant surface, routes back to full human G2.
```

---

## 3) `AiChatPanel` application

**Layout (mobile-first).** Bottom sheet / docked panel on mobile (full-width, `rounded-t-3xl`), floating
docked card on ≥md (`max-w-md`, `rounded-3xl`). Structure top→bottom: assistant header (avatar + name) ·
scrollable message list · composer (textarea + send). Chrome renders instantly; only the message list is async.

**Surface classes (token/utility usage — copy-ready for FE):**

| element | classes (tokens/utilities only) | note |
|---|---|---|
| panel card | `relative overflow-hidden rounded-3xl bg-ai-surface backdrop-blur-xl border border-border shadow-ai-glow` | glass + glow; role radius; works light+dark automatically |
| ambient aurora | `<div aria-hidden className="pointer-events-none absolute inset-0 ai-aurora" />` | static for S2; decorative, behind content (`-z-10` under content wrapper) |
| assistant avatar | icon-chip `bg-primary/10 text-primary rounded-full h-11 w-11` + lucide `Sparkles`; glow `shadow-ai-glow` optional | on-brand teal, no gradient fill |
| assistant name | `text-sm font-medium text-foreground` (i18n key) | no jargon |
| message list region | `flex-1 overflow-y-auto` + `aria-live="polite"` for streamed text | see §4 states |
| user bubble | `rounded-2xl bg-primary text-primary-foreground px-4 py-2.5` | primary fill = user |
| assistant bubble | `rounded-2xl bg-ai-tint text-foreground px-4 py-2.5` | the `--ai-tint` accent |
| composer textarea | `Textarea` (`rounded-3xl`) — `bg-card` | reuse primitive |
| send button | `Button size="icon"` (`h-11 w-11 rounded-full`) + lucide `Send`, `aria-label` | tap ≥44px |

**Anti-slop hold:** teal→sky comes ONLY from the ambient aurora + glow + tint (subtle, low-chroma), not a loud
full-bleed gradient or purple. One dominant surface (the panel), light chrome (border + glow > heavy shadow),
no cards-in-cards. Icons lucide, no emoji. This reads as CampVibe-ล้ำ, not a generic AI-chat template.

---

## 4) 8 states + a11y (assistant surface)

| state | what the user sees | mechanics |
|---|---|---|
| **default** | glass panel + static aurora + glow; composer ready | `bg-ai-surface backdrop-blur-xl shadow-ai-glow` |
| **hover** | send button + suggestion chips lift subtly | `hover:` on control only, ≤250ms opacity/transform |
| **focus** | **visible ring** on textarea + send | `ring-ring` / `outline-ring/50` (never removed) |
| **active** | send press | `active:scale-95` (standard) |
| **loading** | assistant "thinking": 3-dot pulse + streamed tokens appear live | module indicator (NOT skeleton — chat has no fixed layout to mirror, per loading.md canvas rule); `role="status" aria-live="polite"` + `กำลังพิมพ์…`; `aria-busy` on the list region while streaming |
| **error** | `ErrorBanner` at top of the panel + `ลองอีกครั้ง` retry on the failed turn | reuse `components/ui/error-banner.tsx`; retry button ≥44px, focusable |
| **empty** | no messages yet → assistant avatar + welcome title + one-line hint (+ optional starter prompts) | reuse `EmptyState` pattern; copy in `locales/` |
| **disabled** | send greyed + not clickable while composer empty OR a turn is streaming; stop-button (`Square`) offered during stream | `disabled` state; `PermissionTooltip` optional to explain |

**a11y (WCAG 2.1 AA):**
- Panel has an accessible name (`aria-label` = assistant name key); message list `aria-live="polite"` so streamed
  text is announced without interrupting; decorative aurora `aria-hidden`.
- Icon-only controls (send / stop / retry) carry an `aria-label` from `locales/`.
- Visible focus ring on every focusable control; logical tab order; no keyboard trap; panel dismiss via `Esc`.
- Tap target ≥44px (send/stop = `h-11 w-11`).
- Color-not-only: user vs assistant distinguished by **side + fill + avatar**, not hue alone.
- Contrast: `text-foreground` on `bg-ai-tint` and on `bg-ai-surface` (over the solid `bg-card` base behind the
  blur) — **FE to axe-verify** (marked AA-by-parity, not tool-measured here).

---

## Copy (keys for `locales/` — TH + EN, Thai-copy rules: no em-dash separator, no jargon)

Frontend adds these to `locales/translations.ts` (+ `.json`) before build — **no hardcoded strings**.

| key | TH | EN |
|---|---|---|
| `aiChat.panel.label` | ผู้ช่วยแคมป์ไวบ์ | CampVibe assistant |
| `aiChat.assistant.name` | ผู้ช่วยแคมป์ไวบ์ | CampVibe assistant |
| `aiChat.empty.title` | เริ่มคุยกับผู้ช่วยได้เลย | Start a conversation |
| `aiChat.empty.hint` | ถามเรื่องที่พักหรือทริปของคุณได้ทุกอย่าง | Ask anything about your stay or trip |
| `aiChat.composer.placeholder` | พิมพ์ข้อความ | Type a message |
| `aiChat.send` | ส่งข้อความ | Send message |
| `aiChat.stop` | หยุดสร้างคำตอบ | Stop generating |
| `aiChat.thinking` | กำลังพิมพ์… | Typing… |
| `aiChat.error.stream` | ตอบกลับไม่สำเร็จ กรุณาลองใหม่ | Couldn't get a reply, please try again |
| `aiChat.error.retry` | ลองอีกครั้ง | Try again |

---

## Motion honesty

- **S2 default = static.** Ambient aurora is a static gradient; message entrance + panel open clamp to **≤250ms**
  transform/opacity, easing `cubic-bezier(0.23,1,0.32,1)`. This passes the standard motion gate — **no exception needed.**
- **Named enhancements (owner-gated, human Design-Gate — do NOT ship on the standard class):**
  1. `ai-aurora-drift` — a slow (~14s) ambient drift loop, OFF under `prefers-reduced-motion`, transform/opacity only.
     *Justification if approved:* reinforces the "alive assistant" feel without a waveform. Recommend **defer** past S2.
  2. Panel "materialize" **one-shot 450–700ms** surface morph on open, OFF under `prefers-reduced-motion`.
     *Justification if approved:* the assistant "arriving" moment. Recommend **≤250ms for S2** unless the owner wants the longer morph.
- No waveform / audio-viz motion is proposed. Any future waveform = human Design-Gate, per the exception.

---

## 5) Frontend build checklist (S2 — after owner G2 tap)

1. **`app/globals.css`** — add blocks (a)+(b)+(c)+(d) from §1: `--ai-*` in `:root` + `.dark`, the three
   `@theme inline` mappings, the `.ai-aurora` utility (+ the optional drift, left commented/off unless owner approves).
2. **`DESIGN.md`** — add the §2.1 sanctioned-exception prose from §2 verbatim.
3. **`locales/translations.ts` (+ `.json`)** — add the 10 `aiChat.*` keys (TH+EN) from the Copy table.
4. **`components/ai-chat/AiChatPanel.tsx`** — apply the §3 surface classes: glass card (`bg-ai-surface
   backdrop-blur-xl`), `shadow-ai-glow`, ambient `.ai-aurora` layer (`aria-hidden` `pointer-events-none`),
   `rounded-3xl`. lucide-only, no emoji.
5. **`components/ai-chat/AiChatMessageList.tsx`** — user bubble `bg-primary/text-primary-foreground rounded-2xl`;
   assistant bubble `bg-ai-tint text-foreground rounded-2xl`; `aria-live="polite"` + `aria-busy` on stream;
   thinking indicator (§4 loading); `ErrorBanner` + retry (§4 error); `EmptyState` (§4 empty).
6. **`components/ai-chat/AiChatAvatar.tsx`** — icon-chip `bg-primary/10 text-primary rounded-full h-11 w-11`
   + lucide `Sparkles`; optional `shadow-ai-glow`.
7. **Self-verify:** `npm run check:palette` (green) · `npm run check:ds` (green) · `npm run lint` · `npm run typecheck`
   · axe on the panel (contrast + focus + labels) · screenshot the panel in **both light and dark** on `/preview`
   and compare against this Brief (§3/§4).

---

## Links

`DESIGN.md` (§2 tokens, §2.1 new exception, §5 anti-slop, §6 Design Gate) · `app/globals.css` (token home) ·
`.claude/rules/loading.md` (§5 a11y, canvas→indicator rule) · `components/ui/form-patterns.md` (ErrorBanner) ·
`.claude/rules/code.md` §i18n (copy in `locales/`).

## Open questions (for the owner / orchestrator at G2)

- **Q1 (motion):** ship S2 **static** (recommended) or approve `ai-aurora-drift` + the 450–700ms materialize morph now?
  Default if no answer = **static, ≤250ms** (needs no exception).
- **Q2 (starter prompts):** show 2–3 suggested-prompt chips in the empty state? Default if no answer = **yes, 3 chips**
  (copy keys to be added under `aiChat.empty.*`), reusing `FilterChip`-style pills at role radius.
- **Note (baseline):** this worktree branched fresh off `origin/dev`; globals.css there is 217 lines with the
  reduced-motion block at L200–211. All line references above are against that dev baseline. If S2 builds on a
  different in-flight branch, re-anchor the insert points (the blocks are additive and self-contained).

## Changelog
- v1 (2026-07-19) — created: `--ai-*` token proposal (light+dark) + DESIGN.md §2.1 exception + AiChatPanel
  application + 8-states/a11y + FE build checklist. Awaiting owner G2 tap.
