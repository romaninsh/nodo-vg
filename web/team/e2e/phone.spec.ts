import { test, expect, type Page } from "@playwright/test";

// The web app on a phone (375 px, touch): pictures of each page, compared with
// e2e/snapshots/*-phone.png, and the controls worked with taps. Runs before the desktop tests
// change the demo data. Deadlines and tags are masked: Odoo dates its demo data from the day
// the seed was built, so "in 3 days" changes from one seed to the next, and it gives each demo
// tag a random colour at install. The gallery covers how tags look.

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).tap();
  await page.getByRole("button", { name: "Marc Demo" }).tap();
  await page.getByRole("button", { name: "Log in" }).tap();
  await expect(page.locator("section.col").first()).toBeVisible();
  await expect(page.locator("article.card").first()).toBeVisible();
}

// What changes from day to day or per install: deadlines, chatter headers (a time today, a date
// later, so their width changes too; the whole header line keeps the mask one size), and tags
// (random demo colours).
const dates = (page: Page) => [page.locator(".deadline"), page.locator(".dt-group"), page.locator(".tag"), page.locator(".message-head")];

test("sign-in page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).tap();
  await expect(page.getByRole("button", { name: "Marc Demo" })).toBeVisible();
  await expect(page).toHaveScreenshot("signin.png");
});

test("board: one column fills the screen and a swipe moves one column", async ({ page }) => {
  await signIn(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page).toHaveScreenshot("board.png", { mask: dates(page) });

  const board = page.locator(".board");
  const columns = page.locator("section.col");
  const second = await columns.nth(1).evaluate((el) => (el as HTMLElement).offsetLeft);
  // A short swipe still lands on the next column, never between two.
  await board.evaluate((el) => el.scrollBy({ left: 80 }));
  await expect.poll(() => board.evaluate((el) => el.scrollLeft)).toBe(second - 8);
  await expect(page).toHaveScreenshot("board-second-column.png", { mask: dates(page) });
});

test("list: done, title, priority and deadline fit", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "List" }).first().tap();
  await expect(page.locator("tr.row").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page).toHaveScreenshot("list.png", { mask: dates(page) });
});

test("form: fields stack under their labels", async ({ page }) => {
  await signIn(page);
  await page.locator("article.card").first().tap();
  await expect(page.locator("#f-assignees")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Description" })).toBeVisible();
  // The chatter loads after the form; wait for its followers and first message, or the page's
  // height (and the full-page shot) depends on timing.
  await expect(page.locator(".follower-list li").first()).toBeVisible();
  await expect(page.locator(".message").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await expect(page).toHaveScreenshot("form.png", { fullPage: true, mask: dates(page) });
});

test("pickers work by touch, with finger-sized targets", async ({ page }) => {
  await signIn(page);
  const card = page.locator("article.card:not(.done)").first();
  const star = card.getByRole("button", { name: /Priority/ });
  const box = await star.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(36);
  expect((await card.getByRole("button", { name: "Done" }).boundingBox())!.width).toBeGreaterThanOrEqual(24);

  const level = (await star.textContent())?.includes("High") ? "Medium" : "High";
  await star.tap();
  const option = page.getByRole("option", { name: level });
  expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(page).toHaveScreenshot("priority-open.png", { mask: dates(page) });
  await option.tap();
  await expect(card.getByRole("button", { name: new RegExp(level) })).toBeVisible();

  // The deadline's calendar opens from its button and takes a tapped day.
  await card.tap();
  await page.getByRole("button", { name: /Calendar/ }).tap();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const day = dialog.getByRole("button", { name: /15/ }).first();
  expect((await day.boundingBox())!.width).toBeGreaterThanOrEqual(40);
  await day.tap();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
});
