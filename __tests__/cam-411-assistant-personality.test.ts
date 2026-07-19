/**
 * cam-411-assistant-personality.test.ts — CAM-411 (name น้องกองไฟ, Flame
 * avatar, tone line, welcome/bubble/launcher polish).
 *
 * Source-inspection coverage (this repo's Vitest config runs
 * `environment: 'node'`, no jsdom — see __tests__/cam-272-ai-chat-components
 * .test.ts for the established convention), plus a real fetch-mocked unit
 * test for AC-6 (the system-prompt tone line actually reaches the model
 * call). Existing CAM-272/409/410 assertions that pinned the OLD
 * title-only header / old copy were updated in place (not duplicated here).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import translations from "../locales/translations.json";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf-8");

const avatarSrc = read("components/ai-chat/AiChatAvatar.tsx");
const launcherSrc = read("components/ai-chat/AiChatLauncher.tsx");
const panelSrc = read("components/ai-chat/AiChatPanel.tsx");
const listSrc = read("components/ai-chat/AiChatMessageList.tsx");

const th = translations.th.aiChat;
const en = translations.en.aiChat;

describe("BR-2 — AiChatAvatar: one token-tinted icon-chip mark, 3 sizes, decorative", () => {
  it("[unit] renders a lucide Flame icon inside a rounded-full bg-ai-ember/10 chip (CAM-432: fire-toned, was teal bg-primary/10)", () => {
    expect(avatarSrc).toContain('import { Flame } from "lucide-react"');
    expect(avatarSrc).toContain("rounded-full bg-ai-ember/10");
  });

  // CAM-426 (DESIGN.md §2.1 sanctioned exception): the flame recolors
  // text-primary -> text-ai-ember (warm campfire ember token) with the
  // ai-flame-glow dim pulse; CAM-432 then retints the chip itself to
  // bg-ai-ember/10 (see above) and adds a flickering aura halo.
  it("[unit] the flame icon uses the ai-ember token + the ai-flame-glow pulse", () => {
    expect(avatarSrc).toContain("text-ai-ember");
    expect(avatarSrc).toContain("ai-flame-glow");
    expect(avatarSrc).toContain("fill-current");
  });

  it("[unit] the three documented sizes exist (sm 8/4, md 10/5, lg 12/6)", () => {
    expect(avatarSrc).toContain('sm: { wrapper: "h-8 w-8", icon: "size-4" }');
    expect(avatarSrc).toContain('md: { wrapper: "h-10 w-10", icon: "size-5" }');
    expect(avatarSrc).toContain('lg: { wrapper: "h-12 w-12", icon: "size-6" }');
  });

  it("[a11y] the mark is decorative (aria-hidden) — the name/role text carries the meaning", () => {
    expect(avatarSrc).toContain('aria-hidden="true"');
  });

  it("[structural] no new component invented — a composition of the existing icon-chip pattern (no separate primitive file elsewhere reused)", () => {
    expect(avatarSrc).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(avatarSrc).not.toMatch(/\[\d+px\]/);
  });
});

describe("AC-1 — header shows the Flame avatar + name over role subtitle", () => {
  it("[unit] the header renders AiChatAvatar size=md + a two-line name/role stack", () => {
    expect(panelSrc).toContain('import { AiChatAvatar } from "@/components/ai-chat/AiChatAvatar"');
    expect(panelSrc).toContain('<AiChatAvatar size="md" />');
    expect(panelSrc).toContain("{t.aiChat.name}");
    expect(panelSrc).toContain("{t.aiChat.role}");
  });

  it("[unit] the panel aria-label composes {name} {role} so a screen reader announces the full identity on open", () => {
    expect(panelSrc).toContain("aria-label={`${t.aiChat.name} ${t.aiChat.role}`}");
  });

  it("[i18n] name/role copy verbatim (TH) per design.md §Copy", () => {
    expect(th.name).toBe("น้องกองไฟ");
    expect(th.role).toBe("ผู้ช่วยหาที่กางเต็นท์");
    expect(en.name).toBe("Kongfai");
  });
});

describe("AC-2/BR-5 — richer welcome: avatar hero, name-voiced greeting, labelled examples, 44px pills", () => {
  it("[unit] the welcome hero shows AiChatAvatar size=lg above the greeting", () => {
    expect(listSrc).toContain('<AiChatAvatar size="lg" />');
    expect(listSrc).toContain("{t.aiChat.welcomeHeading}");
  });

  it("[unit] the examples label renders above the 3 suggestion pills", () => {
    expect(listSrc).toContain("{t.aiChat.welcomeExamplesLabel}");
    const welcomeBlock = listSrc.slice(
      listSrc.indexOf('data-testid="empty--ai-chat-welcome"'),
      listSrc.indexOf("{entries.map((entry, index) =>")
    );
    expect(welcomeBlock.indexOf("welcomeExamplesLabel")).toBeLessThan(welcomeBlock.indexOf("SUGGESTION_KEYS.map"));
  });

  it('[a11y] BR-5: the welcome pills are bumped to size="default" (h-11/44px), not size="sm" (h-9/36px)', () => {
    const welcomeBlock = listSrc.slice(
      listSrc.indexOf('data-testid="empty--ai-chat-welcome"'),
      listSrc.indexOf("{entries.map((entry, index) =>")
    );
    expect(welcomeBlock).toContain('size="default"');
    expect(welcomeBlock).not.toContain('size="sm"');
  });

  it("[i18n] welcomeHeading is name-voiced + welcomeExamplesLabel verbatim (TH)", () => {
    expect(th.welcomeHeading).toBe("สวัสดี เราน้องกองไฟเอง อยากได้ที่กางเต็นท์แบบไหน ลองเล่าให้ฟังได้เลย");
    expect(th.welcomeExamplesLabel).toBe("ลองถามแบบนี้ดู");
  });
});

describe("AC-3/BR-3/EC-1 (CAM-430 SUPERSEDES the per-row avatar) — every assistant-side row is w-full + motion-safe entrance", () => {
  it("[unit] CAM-430: the answer, typing, rate-limited, disabled and error rows no longer render a per-message AiChatAvatar (size=sm) — the mark is decorative identity, now only in the panel header + resuming/welcome hero", () => {
    const occurrences = listSrc.split('<AiChatAvatar size="sm" />').length - 1;
    expect(occurrences).toBe(0);
    // size=lg still renders exactly twice: the welcome hero (calm, default intensity)
    // and the CAM-425 resuming indicator, which since CAM-435 explicitly passes
    // intensity="loading" (a distinct literal) — counted separately below.
    const welcomeHeroOccurrences = listSrc.split('<AiChatAvatar size="lg" />').length - 1;
    expect(welcomeHeroOccurrences).toBe(1);
    const resumingOccurrences = listSrc.split('<AiChatAvatar size="lg" intensity="loading" />').length - 1;
    expect(resumingOccurrences).toBe(1);
  });

  it("[unit] CAM-430: every assistant-side bubble/notice is w-full (was capped to the narrower chat-bubble width, sized to leave room for the avatar that no longer exists) — the USER bubble keeps its own cap, unaffected", () => {
    const assistantRowsBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'));
    expect(assistantRowsBlock).not.toMatch(/max-w-\[85%\]/);
    expect(listSrc).toContain('max-w-[85%] self-end'); // the user bubble, untouched
  });

  it("[unit] the in-chat card carousel + suggestion chips get their own pl-4 so they line up with the bubble's own px-4 text inset", () => {
    const answerBlock = listSrc.slice(listSrc.indexOf('entry.kind === "answer"'), listSrc.indexOf('if (entry.kind === "rate-limited"'));
    expect(answerBlock).toContain('<div className="pl-4">');
    expect(answerBlock).toContain('className="flex flex-wrap gap-2 pl-4"');
  });

  it('[unit/EC-1] entrance motion is motion-safe-gated transform+opacity ~200ms (instant under reduced-motion)', () => {
    expect(listSrc).toContain(
      "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
    );
  });

  it("[unit] the user bubble also eases in (ENTRANCE_MOTION_CLASS applied)", () => {
    const userBlock = listSrc.slice(listSrc.indexOf('entry.role === "user"'), listSrc.indexOf('entry.kind === "answer"'));
    expect(userBlock).toContain("ENTRANCE_MOTION_CLASS");
  });

  it("[unit] the typing dots pulse is unchanged (still motion-safe:animate-pulse, no re-implementation)", () => {
    expect(listSrc).toContain("motion-safe:animate-pulse");
  });
});

describe("EC-2 (CAM-430: notices no longer carry a per-row avatar, see AC-3 block above) — disabled copy is name-voiced", () => {
  it("[i18n] disabled copy is name-voiced; error/rateLimited copy is unchanged (out of scope)", () => {
    expect(th.disabled).toBe("น้องกองไฟยังไม่พร้อมให้บริการ");
    expect(th.error).toBe("ผู้ช่วยขัดข้อง กรุณาลองใหม่อีกครั้ง");
    expect(th.rateLimited).toBe("มีคำถามเข้ามามากเกินไป กรุณารอสักครู่แล้วลองใหม่");
  });

  it("[unit] AC-4: zeroResult copy is name-voiced", () => {
    expect(th.zeroResult).toBe("ยังไม่เจอที่ถูกใจเลย ลองบอกเงื่อนไขใหม่ให้น้องกองไฟช่วยหาอีกทีได้นะ");
  });
});

describe("AC-5 — launcher shows the Flame mark with the คุยกับน้องกองไฟ accessible name", () => {
  it("[unit] the launcher icon is Flame (not Sparkles), from lucide-react", () => {
    expect(launcherSrc).toContain('import { Flame } from "lucide-react"');
    // the old icon name may only appear in a traceability doc-comment, never as a rendered/imported icon
    expect(launcherSrc).not.toMatch(/import\s*\{\s*Sparkles/);
    expect(launcherSrc).not.toMatch(/<Sparkles\b/);
    expect(launcherSrc).toContain("<Flame className=");
  });

  it("[unit] launcher aria-label resolves through the (renamed) i18n key", () => {
    expect(launcherSrc).toContain("aria-label={t.aiChat.launcherLabel}");
  });

  it("[i18n] launcherLabel verbatim (TH)", () => expect(th.launcherLabel).toBe("คุยกับน้องกองไฟ"));

  it("[unit] launcher interaction states (hover/active scale, size) are unchanged; the offset is bottom-10 right-6 per CAM-432", () => {
    expect(launcherSrc).toContain("motion-safe:hover:scale-105");
    expect(launcherSrc).toContain("motion-safe:active:scale-95");
    expect(launcherSrc).toContain("h-12 w-12");
    expect(launcherSrc).toContain("bottom-10 right-6");
  });
});

describe("Icons/copy — lucide only, no emoji, no hardcoded string (standing rules)", () => {
  it("[structural] no emoji literal in the new/changed files", () => {
    // eslint-disable-next-line no-misleading-character-class
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const src of [avatarSrc, launcherSrc, panelSrc, listSrc]) expect(emojiPattern.test(src)).toBe(false);
  });

  it("[structural] no raw Thai glyph inside JSX text or an attribute literal in the changed files", () => {
    for (const src of [avatarSrc, launcherSrc, panelSrc, listSrc]) {
      expect(src).not.toMatch(/>[^<{]*[ก-๙][^<{]*</);
      expect(src).not.toMatch(/="[^"]*[ก-๙][^"]*"/);
    }
  });

  it("[structural] token-only: no stray hex/px in the touched components", () => {
    for (const src of [avatarSrc, launcherSrc, panelSrc, listSrc]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* AC-6 — the system prompt carries the น้องกองไฟ tone line on every turn      */
/* -------------------------------------------------------------------------- */

vi.mock("server-only", () => ({}));

describe("AC-6/BR-4 — buildSystemPrompt() carries the น้องกองไฟ tone line", () => {
  const FAKE_KEY = "sk-or-test-cam-411";

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = FAKE_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("[unit] the system message contains the exact persona/tone line, placed before the injection-guard sentence", async () => {
    const { runAssistantTurn } = await import("@/lib/ai/openrouter-client");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: "assistant", content: "ok" } }] }),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    await runAssistantTurn("มีแคมป์ไหมคะ");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    const toneLine =
      'คุณคือ "น้องกองไฟ" ผู้ช่วยหาที่กางเต็นท์ของ CampVibe คุยกับผู้ใช้แบบเพื่อนนักแคมป์ที่รู้จริง อบอุ่น สุภาพ และกระชับ ใช้ภาษาพูดที่คนทั่วไปเข้าใจง่าย ไม่ใช้ศัพท์เทคนิคและไม่ใส่อีโมจิ ตอบให้ตรงคำถาม ไม่เยิ่นเย้อและไม่ทำตัวน่ารักเกินจำเป็น ถ้ายังไม่พบที่กางเต็นท์ที่ตรงกับที่ผู้ใช้ต้องการ ให้บอกตามตรงแล้วชวนปรับเงื่อนไขการค้นหา';
    expect(systemMessage.content).toContain(toneLine);
    expect(systemMessage.content.indexOf(toneLine)).toBeLessThan(
      systemMessage.content.indexOf("<user_message></user_message>")
    );
  });

  it("[unit] the tone line appears exactly once (no duplication across turns)", async () => {
    const { runAssistantTurn } = await import("@/lib/ai/openrouter-client");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { role: "assistant", content: "ok" } }] }),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    await runAssistantTurn("hello");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    const occurrences = (systemMessage.content.match(/น้องกองไฟ/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
