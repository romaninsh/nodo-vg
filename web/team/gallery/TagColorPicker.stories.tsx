import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor } from "storybook/test";
import { TagColorPicker } from "../src/ui";

type Args = Parameters<typeof TagColorPicker>[0];

function Live(args: Args) {
  const [color, setColor] = useState(args.color);
  return <TagColorPicker {...args} color={color} onChange={(c) => { setColor(c); args.onChange(c); }} />;
}

const meta = {
  title: "Controls/TagColorPicker",
  component: TagColorPicker,
  args: { name: "Consulting", color: 7, onChange: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof TagColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const pill = () => screen.getByRole("button", { name: /Consulting/ });

export const Closed: Story = {
  play: async () => { await expect(pill()).toHaveAttribute("aria-expanded", "false"); },
};

/** The twelve colours, the tag's own ticked. */
export const Open: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(pill());
    await expect(await screen.findAllByRole("option")).toHaveLength(12);
    await expect(screen.getByRole("option", { name: "Teal" })).toHaveAttribute("aria-selected", "true");
  },
};

export const PickWithMouse: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(pill());
    await userEvent.click(await screen.findByRole("option", { name: "Green" }));
    await expect(args.onChange).toHaveBeenCalledWith(10);
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
  },
};

/** Picking the colour it already has changes nothing. */
export const SameColourIsNoChange: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(pill());
    await userEvent.click(await screen.findByRole("option", { name: "Teal" }));
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};
