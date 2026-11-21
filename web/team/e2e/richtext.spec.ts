import { test, expect, type Page } from "@playwright/test";

// Rich text through the whole stack and Odoo itself: the description is saved by Odoo's own
// write (JSON-RPC, as the signed-in person), which cleans the HTML, and the row Odoo stores is
// read back here. Needs a running Odoo next to the server (ODOO_URL, default localhost:8069),
// so it runs against the dev stack (NODO_URL), not e2e/stack.sh, which has no Odoo; without
// one it is skipped. Each test works on a throwaway record it creates and deletes.

const ODOO = process.env.ODOO_URL ?? "http://localhost:8069";
const DB = process.env.ODOO_DB ?? "odoo";
const ADMIN = { uid: 2, password: process.env.ODOO_ADMIN_PASSWORD ?? "admin" };
const MARC = { uid: 5, password: "demo" };

async function rpc<T>(who: { uid: number; password: string }, model: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${ODOO}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", id: 1, params: { service: "object", method: "execute_kw", args: [DB, who.uid, who.password, model, method, args] } }),
  });
  const out = (await res.json()) as { result?: T; error?: { data?: { message?: string } } };
  if (out.error) throw new Error(out.error.data?.message ?? "Odoo refused the call");
  return out.result as T;
}

// Read as the person who saved it: a to-do is private to its assignees, even for Odoo's admin.
const stored = async (model: string, id: number) =>
  (await rpc<{ description: string | false }[]>(MARC, model, "read", [[id], ["description"]]))[0]?.description || "";
const saved = (page: Page) => expect(page.getByRole("status")).toHaveText("Saved");

test.beforeAll(async () => {
  const up = await fetch(`${ODOO}/web/webclient/version_info`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
    .then((r) => r.ok, () => false);
  test.skip(!up, `no Odoo at ${ODOO}`);
});

async function signInAsDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("button", { name: "Marc Demo" }).click();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("navigation").getByText("Marc Demo")).toBeVisible();
}

/** Paste HTML into the focused editor, as a copy from a web page would. */
async function pasteHtml(page: Page, html: string) {
  await page.evaluate((h) => {
    const data = new DataTransfer();
    data.setData("text/html", h);
    data.setData("text/plain", h.replace(/<[^>]*>/g, ""));
    document.activeElement?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, html);
}

/** Bold, a checklist from the "/" menu, and a pasted hostile snippet. */
async function write(page: Page, box: ReturnType<Page["getByRole"]>) {
  await box.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Agenda for Friday");
  // Select the line and bold it from the toolbar; ArrowRight lands after it (Home and End
  // scroll on macOS instead of moving the caret).
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("toolbar", { name: "Formatting" }).getByRole("button", { name: "Bold" }).click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/check");
  await expect(page.getByRole("option", { name: /Checklist/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Book the room");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await pasteHtml(page, `<p>Pasted <em>note</em><img src="x" onerror="window.__pwned=1"><a href="javascript:window.__pwned=2">link</a></p>`);
}

function expectClean(html: string) {
  expect(html).toContain("<strong>Agenda for Friday</strong>");
  expect(html).toMatch(/<ul class="o_checklist">\s*<li>(<p>)?Book the room/);
  expect(html).toContain("<em>note</em>");
  expect(html).not.toMatch(/onerror|javascript:|<script|<img/i);
}

test("edit a to-do's description: Odoo stores it cleaned", async ({ page }) => {
  const id = await rpc<number>(MARC, "project.task", "create", [{ name: `e2e rich text ${Date.now()}`, user_ids: [[6, 0, [MARC.uid]]] }]);
  try {
    await signInAsDemo(page);
    await page.goto(`/todo/${id}`);
    const box = page.getByRole("textbox", { name: "Description" });
    await write(page, box);
    await page.getByRole("button", { name: "Save" }).click();
    await saved(page);

    const html = await stored("project.task", id);
    expectClean(html);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();

    // Odoo's stored row, shown again after a reload.
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Description" }).locator("strong")).toHaveText("Agenda for Friday");
    await expect(page.getByRole("checkbox", { name: "To do: Book the room" })).toBeVisible();
  } finally {
    await rpc(MARC, "project.task", "unlink", [[id]]);
  }
});

test("edit an opportunity's notes: Odoo stores them cleaned", async ({ page }) => {
  const id = await rpc<number>(ADMIN, "crm.lead", "create", [{ name: `e2e rich notes ${Date.now()}`, type: "opportunity", user_id: MARC.uid }]);
  try {
    await signInAsDemo(page);
    await page.goto(`/crm/${id}`);
    const box = page.getByRole("textbox", { name: "Notes" });
    await write(page, box);
    await page.getByRole("button", { name: "Save" }).click();
    await saved(page);
    expectClean(await stored("crm.lead", id));
  } finally {
    await rpc(ADMIN, "crm.lead", "unlink", [[id]]);
  }
});
