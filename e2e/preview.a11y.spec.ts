/**
 * CAM-230 B4 — Axe a11y audit for /preview (design kitchen-sink) and / (home).
 *
 * Fails on `critical` or `serious` violations only.
 * `moderate` and `minor` violations are reported but do not fail the test,
 * keeping this advisory check from generating false-gate noise while still
 * surfacing real issues in the CI artifact.
 *
 * The CI job runs with `continue-on-error: true` — these tests are a
 * mechanical reviewer, not a merge gate.
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Fail on critical + serious; log moderate + minor so they are visible in
 * the playwright-report artifact without blocking the job.
 */
async function assertA11y(
  builder: AxeBuilder,
  label: string,
): Promise<void> {
  const { violations } = await builder.analyze();

  const blocking = violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );

  const advisory = violations.filter((v) =>
    ["moderate", "minor"].includes(v.impact ?? ""),
  );

  if (advisory.length > 0) {
    console.warn(
      `[a11y advisory — ${label}] ${advisory.length} moderate/minor violation(s):\n` +
        advisory
          .map(
            (v) =>
              `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} node(s))`,
          )
          .join("\n"),
    );
  }

  expect(
    blocking,
    `[a11y] ${label} — ${blocking.length} critical/serious violation(s):\n` +
      blocking
        .map(
          (v) =>
            `  [${v.impact}] ${v.id}: ${v.description}\n` +
            v.nodes
              .slice(0, 3)
              .map((n) => `    • ${n.html}`)
              .join("\n"),
        )
        .join("\n"),
  ).toHaveLength(0);
}

test.describe("a11y — /preview", () => {
  test("no critical/serious axe violations", async ({ page }) => {
    await page.goto("/preview");
    await page.waitForLoadState("networkidle");

    const builder = new AxeBuilder({ page })
      // wcag2a + wcag2aa cover the most actionable rules.
      .withTags(["wcag2a", "wcag2aa", "best-practice"]);

    await assertA11y(builder, "/preview");
  });
});

test.describe("a11y — / (home)", () => {
  test("no critical/serious axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const builder = new AxeBuilder({ page }).withTags([
      "wcag2a",
      "wcag2aa",
      "best-practice",
    ]);

    await assertA11y(builder, "/");
  });
});
