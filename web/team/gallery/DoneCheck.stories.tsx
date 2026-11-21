import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen } from "storybook/test";
import { DoneCheck } from "../src/ui";

type Args = Parameters<typeof DoneCheck>[0];

function Live(args: Args) {
  const [done, setDone] = useState(args.done);
  return <DoneCheck {...args} done={done} onToggle={() => { setDone(!done); args.onToggle(); }} />;
}

const meta = {
  title: "Controls/DoneCheck",
  component: DoneCheck,
  args: { done: false, onToggle: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof DoneCheck>;
export default meta;
type Story = StoryObj<typeof meta>;

const check = () => screen.getByRole("button", { name: "Done" });

export const Open: Story = {
  play: async () => { await expect(check()).toHaveAttribute("aria-pressed", "false"); },
};

export const Done: Story = {
  args: { done: true },
  play: async () => { await expect(check()).toHaveAttribute("aria-pressed", "true"); },
};

export const Disabled: Story = {
  args: { done: true, disabled: true },
  play: async () => { await expect(check()).toBeDisabled(); },
};

export const ToggleWithMouse: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(check());
    await expect(args.onToggle).toHaveBeenCalledOnce();
    await expect(check()).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(check());
    await expect(check()).toHaveAttribute("aria-pressed", "false");
  },
};

export const ToggleWithKeyboard: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await expect(args.onToggle).toHaveBeenCalledOnce();
    await expect(check()).toHaveAttribute("aria-pressed", "true");
  },
};

/** Keyboard focus shows what a press will do. */
export const Hint: Story = {
  play: async ({ userEvent }) => {
    await userEvent.tab();
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Mark as done");
  },
};
