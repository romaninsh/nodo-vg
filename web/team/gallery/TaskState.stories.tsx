import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, within } from "storybook/test";
import { TaskState } from "../src/ui";

type Args = Parameters<typeof TaskState>[0];

function Live(args: Args) {
  const [value, setValue] = useState(args.value);
  return <TaskState {...args} value={value} onChange={(s) => { setValue(s); args.onChange(s); }} />;
}

const meta = {
  title: "Controls/TaskState",
  component: TaskState,
  args: { value: "01_in_progress", onChange: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof TaskState>;
export default meta;
type Story = StoryObj<typeof meta>;

const bubble = () => screen.getByRole("button", { name: /State/ });

export const InProgress: Story = {
  play: async () => { await expect(bubble()).toHaveTextContent("In Progress"); },
};

export const EveryState: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      {["01_in_progress", "02_changes_requested", "03_approved", "04_waiting_normal", "1_done", "1_canceled"].map((s) => (
        <TaskState key={s} value={s} onChange={() => {}} />
      ))}
    </div>
  ),
  // Waiting is a plain icon on a card; the other five open a menu.
  play: async () => {
    await expect(screen.getAllByRole("button")).toHaveLength(5);
    await expect(screen.getByRole("img", { name: "State: Waiting" })).toBeVisible();
  },
};

/** The five states a person can pick; Waiting is Odoo's to set. */
export const PickApproved: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(bubble());
    const menu = await screen.findByRole("listbox");
    await expect(within(menu).getAllByRole("option")).toHaveLength(5);
    await userEvent.click(within(menu).getByRole("option", { name: "Approved" }));
    await expect(args.onChange).toHaveBeenCalledWith("03_approved");
    await expect(bubble()).toHaveTextContent("Approved");
  },
};

/** On a card a waiting task shows a plain hourglass, no menu (as Odoo's card). */
export const WaitingOnACard: Story = {
  args: { value: "04_waiting_normal" },
  play: async () => {
    await expect(screen.queryByRole("button")).toBeNull();
    await expect(screen.getByRole("img", { name: "State: Waiting" })).toBeVisible();
  },
};

/** On the form a waiting task offers only Cancelled and Done, Waiting greyed out first. */
export const WaitingOnTheForm: Story = {
  args: { value: "04_waiting_normal", waitingMenu: true },
  play: async ({ args, userEvent }) => {
    await userEvent.click(bubble());
    const menu = await screen.findByRole("listbox");
    const options = within(menu).getAllByRole("option");
    await expect(options.map((o) => o.textContent)).toEqual(["Waiting", "Cancelled", "Done"]);
    await expect(options[0]).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(within(menu).getByRole("option", { name: "Done" }));
    await expect(args.onChange).toHaveBeenCalledWith("1_done");
  },
};

export const WithKeyboard: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("02_changes_requested");
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async () => { await expect(bubble()).toBeDisabled(); },
};
