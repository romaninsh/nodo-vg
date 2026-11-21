import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor, within } from "storybook/test";
import { RichText } from "../src/ui/RichText";

// A description as Odoo stores it: a heading, colours (inline and Odoo's theme class), a
// checklist, a quote, a link and a small table.
const ODOO_HTML = [
  "<h3>Offsite plan</h3>",
  '<p>Book the <strong>venue</strong> and <font style="color: rgb(201, 42, 42)">confirm numbers</font> by <span class="text-o-color-1">Friday</span>.</p>',
  '<ul class="o_checklist"><li class="o_checked">Shortlist venues</li><li>Ask for quotes</li></ul>',
  "<blockquote><p>Budget is tight this year.</p></blockquote>",
  '<p>Venue list: <a href="https://example.com/venues">example.com/venues</a></p>',
  "<table><tbody><tr><th><p>Venue</p></th><th><p>Seats</p></th></tr><tr><td><p>Hall A</p></td><td><p>40</p></td></tr></tbody></table>",
].join("");

type Args = Parameters<typeof RichText>[0];

function Field(args: Args) {
  const [value, setValue] = useState(args.value);
  return <RichText {...args} value={value} onChange={args.onChange ? (html) => { setValue(html); args.onChange?.(html); } : undefined} />;
}

const meta = {
  title: "Controls/RichText",
  component: RichText,
  args: { label: "Description", value: ODOO_HTML, placeholder: "Add details about this to-do… Type / for commands." },
  render: (args) => <Field {...args} />,
} satisfies Meta<typeof RichText>;
export default meta;
type Story = StoryObj<typeof meta>;

const editor = () => screen.findByRole("textbox", { name: "Description" }, { timeout: 5000 });

/** Read-only: Odoo's HTML, cleaned and laid out (checklist ticks, colours, the table). */
export const View: Story = {
  args: { readOnly: true },
  play: async () => {
    const region = screen.getByRole("region", { name: "Description" });
    await expect(within(region).getByRole("heading", { name: "Offsite plan" })).toBeVisible();
    await expect(within(region).getByRole("link", { name: "example.com/venues" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
    await expect(within(region).getByRole("table")).toBeVisible();
  },
};

/** Whatever is stored, only safe markup reaches the page: no script, handler or javascript: link. */
export const Cleaned: Story = {
  args: {
    readOnly: true,
    value: '<p>Hello <b onclick="alert(1)">there</b><script>alert(2)</script> <a href="javascript:alert(3)">link</a></p><p style="position: fixed; color: #c92a2a">red</p>',
  },
  play: async () => {
    const region = screen.getByRole("region", { name: "Description" });
    await expect(region.innerHTML).not.toMatch(/script|onclick|javascript:|position/);
    await expect(within(region).getByText("red")).toHaveStyle({ color: "rgb(201, 42, 42)" });
  },
};

export const Empty: Story = {
  args: { readOnly: true, value: "" },
  play: async () => { await expect(screen.getByRole("region", { name: "Description" })).toHaveTextContent("Nothing written yet."); },
};

/** The editor: the same HTML, editable, with checklists as checkboxes. */
export const Edit: Story = {
  args: { onChange: fn() },
  play: async () => {
    const box = await editor();
    await expect(within(box).getByRole("heading", { name: "Offsite plan" })).toBeVisible();
    await expect(within(box).getByRole("checkbox", { name: "Done: Shortlist venues" })).toBeChecked();
  },
};

/** "/" opens the command menu; the arrow keys pick, Enter runs it. */
export const SlashMenu: Story = {
  args: { value: "", onChange: fn() },
  play: async ({ args, userEvent }) => {
    const box = await editor();
    await userEvent.click(box);
    await userEvent.keyboard("/check");
    const list = await screen.findByRole("listbox", { name: "Commands" });
    await expect(within(list).getByRole("option", { name: /Checklist/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Enter}Call the supplier");
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith('<ul class="o_checklist"><li><p>Call the supplier</p></li></ul>'));
  },
};

/** A selection shows the toolbar; Alt+F10 reaches it from the keyboard, Escape goes back. */
export const SelectionToolbar: Story = {
  args: { value: "<p>Call the supplier</p>", onChange: fn() },
  play: async ({ args, userEvent }) => {
    const box = await editor();
    await userEvent.click(box);
    await userEvent.keyboard(/Mac/.test(navigator.platform) ? "{Meta>}a{/Meta}" : "{Control>}a{/Control}");
    const bar = await screen.findByRole("toolbar", { name: "Formatting" });
    await userEvent.keyboard("{Alt>}{F10}{/Alt}");
    await waitFor(() => expect(within(bar).getByRole("button", { name: "Bold" })).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onChange).toHaveBeenLastCalledWith("<p><strong>Call the supplier</strong></p>"));
  },
};

/** What nodo can't edit yet (images, columns, banners) keeps the field read-only, and says so. */
export const NotEditableHere: Story = {
  args: { value: '<p>Floor plan:</p><img src="/web/image/12">', onChange: fn() },
  play: async () => {
    await expect(screen.getByRole("region", { name: "Description" })).toHaveTextContent("Floor plan:");
    await expect(screen.getByText(/has images or media, which nodo can't edit yet/)).toBeVisible();
    await expect(screen.queryByRole("textbox")).toBeNull();
  },
};
