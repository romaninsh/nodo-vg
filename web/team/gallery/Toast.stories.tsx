import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, waitFor } from "storybook/test";
import { Toaster, toast } from "../src/ui";

const meta = {
  title: "Controls/Toast",
  component: Toaster,
  args: { duration: 60_000 },
  render: (args) => (
    <>
      <button className="btn" onClick={() => toast("Saved")}>Save</button>
      <button className="btn" style={{ marginLeft: 8 }} onClick={() => toast("Could not save: the to-do was archived in the meantime")}>Fail</button>
      <Toaster {...args} />
    </>
  ),
} satisfies Meta<typeof Toaster>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Nothing: Story = {
  play: async () => { await expect(screen.queryByRole("status")).toBeNull(); },
};

export const Message: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  },
};

/** A new message replaces the one showing. */
export const Replaced: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Fail" }));
    await expect(screen.getByRole("status")).toHaveTextContent(/Could not save/);
  },
};

export const GoesAway: Story = {
  args: { duration: 300 },
  play: async ({ userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await expect(await screen.findByRole("status")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull(), { timeout: 2000 });
  },
};
