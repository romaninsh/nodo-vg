import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen } from "storybook/test";
import { FavoriteStar } from "../src/ui";

type Args = Parameters<typeof FavoriteStar>[0];

function Live(args: Args) {
  const [on, setOn] = useState(args.on);
  return <FavoriteStar {...args} on={on} onToggle={() => { setOn(!on); args.onToggle(); }} />;
}

const meta = {
  title: "Controls/FavoriteStar",
  component: FavoriteStar,
  args: { on: false, onToggle: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof FavoriteStar>;
export default meta;
type Story = StoryObj<typeof meta>;

const star = () => screen.getByRole("button", { name: "Favorite" });

export const NotAFavorite: Story = {
  play: async () => { await expect(star()).toHaveAttribute("aria-pressed", "false"); },
};

export const AFavorite: Story = {
  args: { on: true },
  play: async () => { await expect(star()).toHaveAttribute("aria-pressed", "true"); },
};

export const ToggleWithMouse: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(star());
    await expect(args.onToggle).toHaveBeenCalledOnce();
    await expect(star()).toHaveAttribute("aria-pressed", "true");
  },
};

export const ToggleWithKeyboard: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard(" ");
    await expect(args.onToggle).toHaveBeenCalledOnce();
  },
};

/** A click on the star doesn't reach the card under it (which would open the project). */
const cardOpened = fn();
export const InsideACard: Story = {
  render: (args) => <div role="article" onClick={cardOpened}><Live {...args} /></div>,
  play: async ({ args, userEvent }) => {
    cardOpened.mockClear();
    await userEvent.click(star());
    await expect(args.onToggle).toHaveBeenCalledOnce();
    await expect(cardOpened).not.toHaveBeenCalled();
  },
};
