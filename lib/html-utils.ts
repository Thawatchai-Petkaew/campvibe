/**
 * html-utils.ts — CAM-173
 * Pure HTML entity decoder. No DOM, no React — fully unit-testable in Node.
 */

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Decode the common HTML character references that appear in Linear/API titles.
 * Handles: &amp; &quot; &lt; &gt; &#39; &apos;
 * Output is a plain string — safe to use as React textContent (NOT dangerouslySetInnerHTML).
 */
export function decodeHtmlEntities(str: string): string {
  return str.replace(
    /&(?:amp|quot|lt|gt|#39|apos);/g,
    (match) => HTML_ENTITIES[match] ?? match
  );
}
