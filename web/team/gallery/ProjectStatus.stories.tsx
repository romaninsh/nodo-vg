import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, within } from "storybook/test";
import { ProjectStatus } from "../src/ui";

type Args = Parameters<typeof ProjectStatus>[0];

function Live(args: Args) {
  const [value, setValue] = useState(args.value);
  return <ProjectStatus {...args} value={value} onChange={args.onChange && ((s) => { setValue(s); args.onChange?.(s); })} />;
}

const meta = {
  title: "Controls/ProjectStatus",
  component: ProjectStatus,
  args: { value: "to_define", onChange: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof ProjectStatus>;
export default meta;
type Story = StoryObj<typeof meta>;

const dot = () => screen.getByRole("button", { name: /Status/ });

/** Before any status update: an empty ring, "Set Status". */
export const SetStatus: Story = {
  play: async () => { await expect(dot()).toHaveTextContent("Set Status"); },
};

export const EveryStatus: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      {["on_track", "at_risk", "off_track", "on_hold", "done", "to_define"].map((s) => <ProjectStatus key={s} value={s} />)}
    </div>
  ),
  play: async () => { await expect(screen.getAllByRole("img")).toHaveLength(6); },
};

export const PickAtRisk: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(dot());
    const menu = await screen.findByRole("listbox");
    await expect(within(menu).getAllByRole("option")).toHaveLength(5);
    await userEvent.click(within(menu).getByRole("option", { name: "At Risk" }));
    await expect(args.onChange).toHaveBeenCalledWith("at_risk");
    await expect(dot()).toHaveTextContent("At Risk");
  },
};

/** Without onChange the dot only shows the status (someone who may not set it). */
export const ReadOnly: Story = {
  args: { value: "off_track", onChange: undefined },
  play: async () => {
    await expect(screen.queryByRole("button")).toBeNull();
    await expect(screen.getByRole("img", { name: "Status: Off Track" })).toBeVisible();
  },
};
