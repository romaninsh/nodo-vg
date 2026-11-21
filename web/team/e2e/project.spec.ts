import { test, expect, type Page } from "@playwright/test";

// Marc Demo's Project app on Odoo's demo data, through the whole stack. Marc is a Project User:
// he sees the projects open to all employees, not the team-members-only ones. Read-only: the
// writes (moves, states, quick create, the form) were checked on throwaway tasks
// (docs/project.md), never on demo rows.

async function signInAsDemo(page: Page) {
  await page.goto("/project");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Marc Demo" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation").getByText("Marc Demo")).toBeVisible();
  await page.goto("/project");
}

test("the overview shows the six projects Odoo shows Marc", async ({ page }) => {
  await signInAsDemo(page);
  await expect(page.locator("article.pcard")).toHaveCount(6);
  await expect(page.getByRole("article", { name: "Research & Development" })).toHaveCount(0);
  const office = page.getByRole("article", { name: "Office Design" });
  await expect(office).toContainText("18 Tasks");
  await expect(office).toContainText("Sep 17 → Nov 27");
  await expect(office.getByRole("button", { name: /Status/ })).toContainText("On Track");
});

test("a project's board: its stages, the state bar, Cancelled folded, sub-tasks hidden", async ({ page }) => {
  await signInAsDemo(page);
  await page.getByRole("article", { name: "Office Design" }).click();
  await expect(page).toHaveURL(/\/project\/1\/tasks$/);
  for (const stage of ["New", "In Progress", "Done"]) {
    await expect(page.getByRole("region", { name: stage })).toBeVisible();
    await expect(page.getByRole("group", { name: `Task states in ${stage}` })).toBeAttached();
  }
  await expect(page.getByRole("button", { name: /Cancelled, \d+ tasks, folded/ })).toBeVisible();
  const energy = page.getByRole("group", { name: "Energy Certificate", exact: true });
  await expect(energy).toContainText("Final Phase - 11/19/2028");
  await expect(energy.getByRole("button", { name: /State/ })).toBeVisible();
  await page.getByRole("button", { name: "Show sub-tasks" }).click();
  await expect(page.locator(".task-card .parent").first()).toBeVisible();
});

test("a task's form: stage bar, milestone and hours", async ({ page }) => {
  await signInAsDemo(page);
  await page.goto("/project/1/tasks/38");
  await expect(page.getByLabel("Title")).toHaveValue("Customer review");
  await expect(page.getByRole("navigation", { name: "Stage" }).getByRole("button", { name: "In Progress" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByText("Sub-tasks (0/1)")).toBeVisible();
});
