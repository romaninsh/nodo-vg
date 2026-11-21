import { test, expect, type Browser, type Page } from "@playwright/test";

// Marc Demo's to-dos on Odoo's demo data, through the whole stack: sign-in checks his Odoo
// password hash, the board reads Odoo's tables, and each change is written back to them.

async function signInAsDemo(page: Page) {
  await page.goto("/");
  // The about splash shows once per session, over the sign-in page.
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Marc Demo" }).click();
  await expect(page.getByLabel("Login")).toHaveValue("demo");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation").getByText("Marc Demo")).toBeVisible();
}

/** A card on the board, found by its title. */
const card = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

/** The first open card on the board: not done, so it can be completed. */
async function firstOpenCard(page: Page) {
  const first = page.locator("article.card:not(.done)").first();
  await expect(first).toBeVisible();
  return (await first.getAttribute("aria-label")) ?? "";
}

/**
 * The same board in a second browser, signed in afresh: what's there was read back from the
 * database. (A reload of the first tab isn't enough yet: the server can serve that session's
 * board from before the change for a while; see docs/todo.md.)
 */
async function elsewhere(browser: Browser, check: (page: Page) => Promise<void>) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await signInAsDemo(page);
    await check(page);
  } finally {
    await context.close();
  }
}

test("sign in as the demo user and see the board", async ({ page }) => {
  await signInAsDemo(page);
  const columns = page.locator("section.col");
  await expect(columns.first()).toBeVisible();
  expect(await columns.count()).toBeGreaterThan(1);
  await expect(page.locator("article.card").first()).toBeVisible();
});

test("the app switcher lists the apps and takes you to To-do", async ({ page }) => {
  await signInAsDemo(page);
  await page.getByRole("navigation", { name: "To-do" }).getByRole("link", { name: "List" }).click();
  await expect(page).toHaveURL(/\/list$/);
  await page.getByRole("button", { name: "Apps" }).click();
  await expect(page.getByRole("option", { name: /CRM/ })).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("option", { name: /To-do/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("section.col").first()).toBeVisible();
});

test("change a to-do's priority", async ({ page, browser }) => {
  await signInAsDemo(page);
  const name = await firstOpenCard(page);
  const star = card(page, name).getByRole("button", { name: /Priority/ });
  const level = (await star.textContent())?.includes("Urgent") ? "Low" : "Urgent";
  await star.click();
  await page.getByRole("option", { name: level }).click();
  await expect(card(page, name).getByRole("button", { name: new RegExp(level) })).toBeVisible();

  await elsewhere(browser, async (other) => {
    await expect(card(other, name).getByRole("button", { name: new RegExp(level) })).toBeVisible();
  });
});

test("complete a to-do", async ({ page, browser }) => {
  await signInAsDemo(page);
  const name = await firstOpenCard(page);
  await card(page, name).getByRole("button", { name: "Done" }).click();
  await expect(card(page, name).getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
  await expect(card(page, name)).toHaveClass(/\bdone\b/);

  await elsewhere(browser, async (other) => {
    await expect(card(other, name).getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
  });
});
