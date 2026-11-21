import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor } from "storybook/test";
import { CRM_PRIORITY_LABELS, Priority, PriorityStar, PRIORITY_LABELS, type Level } from "../src/ui";

type Args = Parameters<typeof Priority>[0];

/** Priority keeps its own value here, so a pick shows the new star like it does on a card. */
function Live(args: Args) {
  const [value, setValue] = useState(args.value);
  return <Priority {...args} value={value} onChange={(l: Level) => { setValue(l); args.onChange(l); }} />;
}

const meta = {
  title: "Controls/Priority",
  component: Priority,
  args: { value: "0", onChange: fn() },
  argTypes: { value: { control: "inline-radio", options: ["0", "1", "2", "3"] } },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof Priority>;
export default meta;
type Story = StoryObj<typeof meta>;

const star = (name: RegExp) => screen.getByRole("button", { name });

export const Low: Story = {
  args: { value: "0" },
  play: async () => { await expect(star(/Low/)).toBeVisible(); },
};
export const Medium: Story = { args: { value: "1" }, play: async () => { await expect(star(/Medium/)).toBeVisible(); } };
export const High: Story = { args: { value: "2" }, play: async () => { await expect(star(/High/)).toBeVisible(); } };
export const Urgent: Story = { args: { value: "3" }, play: async () => { await expect(star(/Urgent/)).toBeVisible(); } };

/** All four stars side by side, at the card size and the list size. */
export const Stars: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 16, justifyContent: "start", alignItems: "center" }}>
      {PRIORITY_LABELS.map((label, n) => (
        <span key={label} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <PriorityStar level={n} size={18} /><PriorityStar level={n} size={24} />{label}
        </span>
      ))}
    </div>
  ),
};

/** CRM names the top level "Very High" (Odoo's three stars); the same star style. */
export const CrmLevels: Story = {
  args: { value: "3", labels: CRM_PRIORITY_LABELS },
  play: async ({ userEvent }) => {
    await expect(star(/Very High/)).toBeVisible();
    await userEvent.click(star(/Very High/));
    await expect(await screen.findByRole("option", { name: "Very High" })).toHaveAttribute("aria-selected", "true");
  },
};

export const Disabled: Story = {
  args: { value: "2", disabled: true },
  play: async () => { await expect(star(/High/)).toBeDisabled(); },
};

/** The levels open under the star, the current one ticked. */
export const Open: Story = {
  args: { value: "2" },
  play: async ({ userEvent }) => {
    await userEvent.click(star(/High/));
    const list = await screen.findByRole("listbox");
    await expect(list).toBeVisible();
    await expect(screen.getByRole("option", { name: "High" })).toHaveAttribute("aria-selected", "true");
  },
};

export const PickWithMouse: Story = {
  args: { value: "0" },
  play: async ({ args, userEvent }) => {
    await userEvent.click(star(/Low/));
    await userEvent.click(await screen.findByRole("option", { name: "Urgent" }));
    await expect(args.onChange).toHaveBeenCalledWith("3");
    await waitFor(() => expect(star(/Urgent/)).toBeVisible());
  },
};

export const PickWithKeyboard: Story = {
  args: { value: "1" },
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await expect(star(/Medium/)).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("2");
  },
};

/** Picking the level it already has changes nothing. */
export const SameLevelIsNoChange: Story = {
  args: { value: "2" },
  play: async ({ args, userEvent }) => {
    await userEvent.click(star(/High/));
    await userEvent.click(await screen.findByRole("option", { name: "High" }));
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
