import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

type Entry = { id: string; type: string; title: string; name: string };

// Storybook's own list of stories, from the build.
const index = JSON.parse(readFileSync(new URL("../storybook-static/index.json", import.meta.url), "utf8")) as {
  entries: Record<string, Entry>;
};
const stories = Object.values(index.entries).filter((e) => e.type === "story");

for (const story of stories) {
  test(`${story.title} › ${story.name}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    // Rendered, and its play function (a click that opens a popover, …) done.
    await page.waitForFunction(() => {
      const renders = (window as unknown as { __STORYBOOK_PREVIEW__?: { storyRenders: { phase?: string }[] } })
        .__STORYBOOK_PREVIEW__?.storyRenders ?? [];
      return renders.some((r) => r.phase === "finished");
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${story.id}.png`);
  });
}
