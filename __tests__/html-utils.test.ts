/**
 * html-utils.test.ts — CAM-173
 *
 * Unit tests for lib/html-utils.ts decodeHtmlEntities.
 *
 * AC coverage matrix:
 *   AC#3  decode HTML entities in item.title before render
 *
 * Coverage matrix:
 *   normal · null/empty · boundary · error/validation
 */

import { describe, it, expect } from "vitest";
import { decodeHtmlEntities } from "@/lib/html-utils";

describe("decodeHtmlEntities — HTML entity decoder (AC#3)", () => {
  // ── normal ──────────────────────────────────────────────────────────────────

  it('[normal] decodes &quot; to double-quote character', () => {
    expect(decodeHtmlEntities('ปรับ &quot;modal&quot; ส่งมอบ')).toBe(
      'ปรับ "modal" ส่งมอบ'
    );
  });

  it('[normal] decodes &amp; to ampersand', () => {
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
  });

  it('[normal] decodes &lt; to less-than', () => {
    expect(decodeHtmlEntities("value &lt; 10")).toBe("value < 10");
  });

  it('[normal] decodes &gt; to greater-than', () => {
    expect(decodeHtmlEntities("value &gt; 5")).toBe("value > 5");
  });

  it("[normal] decodes &#39; to apostrophe", () => {
    expect(decodeHtmlEntities("it&#39;s a test")).toBe("it's a test");
  });

  it("[normal] decodes &apos; to apostrophe", () => {
    expect(decodeHtmlEntities("it&apos;s a test")).toBe("it's a test");
  });

  it("[normal] decodes multiple entities in a single string", () => {
    expect(
      decodeHtmlEntities('ชื่อ &quot;ดี&quot; &amp; สวยงาม &lt;3&gt;')
    ).toBe('ชื่อ "ดี" & สวยงาม <3>');
  });

  it("[normal] &amp; is decoded first — no double-decode of &amp;quot;", () => {
    // &amp; → & only; does NOT cascade into &quot; decode
    // The regex matches whole entities only, so &amp;quot; is decoded as &quot; (not ")
    // because the match is &amp; → &, leaving quot; as literal text.
    // This is the safe behaviour — no cascading decode, no XSS risk.
    expect(decodeHtmlEntities("&amp;quot;")).toBe('&quot;');
  });

  it("[normal] real-world Linear title with &quot; around a name", () => {
    expect(
      decodeHtmlEntities(
        '[frontend] ปรับ &quot;modal ส่งมอบสำเร็จ&quot; ให้เข้า design system'
      )
    ).toBe('[frontend] ปรับ "modal ส่งมอบสำเร็จ" ให้เข้า design system');
  });

  // ── null/empty ───────────────────────────────────────────────────────────────

  it("[null/empty] returns empty string unchanged", () => {
    expect(decodeHtmlEntities("")).toBe("");
  });

  it("[null/empty] returns plain text with no entities unchanged", () => {
    expect(decodeHtmlEntities("ส่งมอบสำเร็จ")).toBe("ส่งมอบสำเร็จ");
  });

  // ── boundary ─────────────────────────────────────────────────────────────────

  it("[boundary] string with only an entity", () => {
    expect(decodeHtmlEntities("&quot;")).toBe('"');
  });

  it("[boundary] consecutive entities without spaces", () => {
    expect(decodeHtmlEntities("&lt;&gt;&amp;")).toBe("<>&");
  });

  it("[boundary] entity at the very start of the string", () => {
    expect(decodeHtmlEntities("&quot;hello")).toBe('"hello');
  });

  it("[boundary] entity at the very end of the string", () => {
    expect(decodeHtmlEntities("hello&quot;")).toBe('hello"');
  });

  // ── error/validation ─────────────────────────────────────────────────────────

  it("[error/validation] unknown entity is left unchanged", () => {
    expect(decodeHtmlEntities("&unknown;")).toBe("&unknown;");
  });

  it("[error/validation] malformed entity (no semicolon) is left unchanged", () => {
    expect(decodeHtmlEntities("&amp")).toBe("&amp");
  });

  it("[error/validation] partial entity sequence does not crash", () => {
    expect(decodeHtmlEntities("&amp &quot")).toBe("&amp &quot");
  });
});
