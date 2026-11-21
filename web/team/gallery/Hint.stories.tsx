import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "react-aria-components";
import { Archive } from "lucide-react";
import { expect, screen } from "storybook/test";
import { Hint } from "../src/ui";

const meta = {
  title: "Controls/Hint",
  component: Hint,
  args: { text: "Archive this to-do", children: null },
  render: ({ text }) => (
    <Hint text={text}>
      <Button className="btn icon" aria-label="Archive"><Archive size={16} aria-hidden="true" /></Button>
    </Hint>
  ),
  // Room for the tooltip above the button.
  decorators: [(Story) => <div style={{ paddingTop: 40 }}><Story /></div>],
} satisfies Meta<typeof Hint>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  play: async () => { await expect(screen.queryByRole("tooltip")).toBeNull(); },
};

export const OnKeyboardFocus: Story = {
  play: async ({ userEvent }) => {
    await userEvent.tab();
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Archive this to-do");
  },
};

export const LongText: Story = {
  args: { text: "Archived to-dos leave the board and the list. Open the Archived filter to find them again." },
  play: async ({ userEvent }) => {
    await userEvent.tab();
    await expect(await screen.findByRole("tooltip")).toBeVisible();
  },
};
