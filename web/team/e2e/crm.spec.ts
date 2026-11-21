import { test, expect, type Page } from "@playwright/test";

// Marc Demo's CRM pipeline on Odoo's demo data, through the whole stack. Marc is a Sales
// "User: Own Documents Only" in Odoo, so he sees his own opportunities and the unassigned ones.
// Only the priority is changed, and it is put back.

async function signInAsDemo(page: Page) {
  await page.goto("/crm");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Marc Demo" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation").getByText("Marc Demo")).toBeVisible();
  await page.goto("/crm");
}

const card = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

// The board fills within 5 s of a finished sign-in, before and after a reload. (A reload while
// the sign-in still runs drops it and shows the sign-in page again: the password check takes
// 1.6 to 2.5 s on a debug build, so a script must wait for the sign-in, not a fixed time.)
test("the board shows its cards right after sign-in and after a reload", async ({ page }) => {
  await page.goto("/crm");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Marc Demo" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation").getByText("Marc Demo")).toBeVisible();
  await expect(page.locator("article.crm-card").first()).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(page.locator("article.crm-card").first()).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#login")).toHaveCount(0);
});

test("the pipeline: a column per stage, each with its revenue and activity bar", async ({ page }) => {
  await signInAsDemo(page);
  for (const stage of ["New", "Qualified", "Proposition", "Won"]) {
    await expect(page.getByRole("region", { name: stage })).toBeVisible();
    await expect(page.getByRole("group", { name: `Activities in ${stage}` })).toBeAttached();
  }
  await expect(page.locator("article.crm-card").first()).toBeVisible();
  await expect(page.locator(".col-total").first()).toHaveText(/^\$ [\d,]+$/);
});

test("My pipeline shows only his own; Everyone the same for him (Odoo's own-documents rule)", async ({ page }) => {
  await signInAsDemo(page);
  await expect(page.locator("article.crm-card").first()).toBeVisible();
  const mine = await page.locator("article.crm-card").count();
  await page.getByRole("radio", { name: "Everyone" }).click();
  await expect(page.getByRole("radio", { name: "Everyone" })).toBeChecked();
  await expect(page.locator("article.crm-card")).toHaveCount(mine);
});

test("the team switcher lists only his own team, and remembers it across a reload", async ({ page }) => {
  await signInAsDemo(page);
  await page.getByRole("button", { name: /Sales team/ }).click();
  await expect(page.getByRole("option")).toHaveText(["All Teams", "Pre-Sales"]);
  await page.getByRole("option", { name: "Pre-Sales" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Sales team/ })).toContainText("Pre-Sales");
  await page.getByRole("button", { name: /Sales team/ }).click();
  await page.getByRole("option", { name: "All Teams" }).click();
});

test("open an opportunity: stage bar, revenue, probability, contact fields", async ({ page }) => {
  await signInAsDemo(page);
  const first = page.locator("article.crm-card").first();
  const name = (await first.getAttribute("aria-label")) ?? "";
  await first.click();
  await expect(page).toHaveURL(/\/crm\/\d+$/);
  await expect(page.getByRole("textbox", { name: "Opportunity" })).toHaveValue(name);
  await expect(page.getByRole("navigation", { name: "Stage" }).locator("[aria-current=step]")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "Expected Revenue" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Probability", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Pipeline" }).first().click();
  await expect(page).toHaveURL(/\/crm$/);
});

test("change a card's priority and put it back", async ({ page }) => {
  await signInAsDemo(page);
  const name = (await page.locator("article.crm-card").first().getAttribute("aria-label")) ?? "";
  const star = card(page, name).getByRole("button", { name: /Priority/ });
  const before = (await star.textContent()) ?? "";
  const original = ["Very High", "High", "Medium", "Low"].find((l) => before.includes(l)) ?? "Low";
  const other = original === "Very High" ? "Low" : "Very High";
  await star.click();
  await page.getByRole("option", { name: other, exact: true }).click();
  await expect(star).toContainText(other);
  await star.click();
  await page.getByRole("option", { name: original, exact: true }).click();
  await expect(star).toContainText(original);
});
