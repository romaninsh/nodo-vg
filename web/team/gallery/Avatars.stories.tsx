import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen } from "storybook/test";
import { Avatar, Avatars } from "../src/ui";

const meta = {
  title: "Controls/Avatars",
  component: Avatars,
  // On a card the avatars sit at the right of the bottom row.
  decorators: [(Story) => <div style={{ display: "flex", width: 240, padding: 8, background: "var(--surface)" }}><Story /></div>],
} satisfies Meta<typeof Avatars>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Nobody: Story = {
  args: { names: "" },
  play: async () => { await expect(screen.queryByRole("img")).toBeNull(); },
};

export const One: Story = {
  args: { names: "Mitchell Admin" },
  play: async () => {
    await expect(screen.getByRole("img", { name: "Assigned to Mitchell Admin" })).toHaveTextContent("MA");
  },
};

export const Several: Story = {
  args: { names: "Mitchell Admin, Marc Demo, Joel Willis" },
  play: async () => {
    const img = screen.getByRole("img", { name: "Assigned to Mitchell Admin, Marc Demo, Joel Willis" });
    await expect(img).toHaveTextContent("MAMDJW");
  },
};

/** One name gives one letter; the colour comes from the name, so a person keeps theirs. */
export const Initials: Story = {
  args: { names: "" },
  render: () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {["Mitchell Admin", "Marc Demo", "Joel Willis", "admin", "Abigail Peterson"].map((n) => <Avatar key={n} name={n} />)}
      <Avatar name="Mitchell Admin" large />
    </div>
  ),
};
