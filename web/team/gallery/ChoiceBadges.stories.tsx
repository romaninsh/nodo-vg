import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen } from "storybook/test";
import { ChoiceBadges } from "../src/ui";

const REASONS = [
  { id: "1", name: "Too expensive" }, { id: "2", name: "We don't have people/skills" }, { id: "3", name: "Not enough stock" },
];

type Args = Parameters<typeof ChoiceBadges>[0];

function Live(args: Args) {
  const [value, setValue] = useState(args.value);
  return <ChoiceBadges {...args} value={value} onChange={(v) => { setValue(v); args.onChange(v); }} />;
}

const meta = {
  title: "Controls/ChoiceBadges",
  component: ChoiceBadges,
  args: { label: "Lost reason", choices: REASONS, value: null, onChange: fn(), clearable: true },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof ChoiceBadges>;
export default meta;
type Story = StoryObj<typeof meta>;

const badge = (name: string) => screen.getByRole("radio", { name });

export const NonePicked: Story = {
  play: async () => { await expect(badge("Too expensive")).not.toBeChecked(); },
};

export const Picked: Story = {
  args: { value: "3" },
  play: async () => { await expect(badge("Not enough stock")).toBeChecked(); },
};

export const PickWithMouse: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByText("Too expensive"));
    await expect(args.onChange).toHaveBeenCalledWith("1");
    await expect(badge("Too expensive")).toBeChecked();
  },
};

/** Arrow keys move between badges, as in any radio group. */
export const PickWithKeyboard: Story = {
  args: { value: "1" },
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await expect(args.onChange).toHaveBeenCalledWith("2");
  },
};

/** Picking the chosen badge again clears it (a lost reason is optional). */
export const ClearAgain: Story = {
  args: { value: "1" },
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByText("Too expensive"));
    await expect(args.onChange).toHaveBeenCalledWith(null);
  },
};
