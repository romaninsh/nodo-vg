import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, within } from "storybook/test";
import { StageBar, type Stage } from "../src/ui";

const STAGES: Stage[] = [
  { id: "1", name: "New" }, { id: "2", name: "Qualified" }, { id: "3", name: "Proposition" }, { id: "4", name: "Won" },
];

type Args = Parameters<typeof StageBar>[0];

/** The bar keeps its own current stage here, so a click moves the highlight as on the form. */
function Live(args: Args) {
  const [current, setCurrent] = useState(args.current);
  return <StageBar {...args} current={current} onSelect={(s) => { setCurrent(s.id); args.onSelect(s); }} />;
}

const meta = {
  title: "Controls/StageBar",
  component: StageBar,
  args: { stages: STAGES, current: "2", label: "Stage", onSelect: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof StageBar>;
export default meta;
type Story = StoryObj<typeof meta>;

// The arrows (the phone's one-button form of the bar is hidden at this width).
const stage = (name: string | RegExp) => within(screen.getByRole("navigation", { name: "Stage" })).getByRole("button", { name });

export const Current: Story = {
  play: async () => {
    await expect(stage("Qualified")).toHaveAttribute("aria-current", "step");
    await expect(stage("New")).not.toHaveAttribute("aria-current");
  },
};

export const MoveWithMouse: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(stage("Proposition"));
    await expect(args.onSelect).toHaveBeenCalledWith(STAGES[2]);
    await expect(stage("Proposition")).toHaveAttribute("aria-current", "step");
  },
};

/** A click on the current stage changes nothing. */
export const SameStageIsNoChange: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(stage("Qualified"));
    await expect(args.onSelect).not.toHaveBeenCalled();
  },
};

/** Folded stages are greyed but still take a click. */
export const Folded: Story = {
  args: { stages: [...STAGES.slice(0, 3), { id: "4", name: "Won", folded: true }, { id: "5", name: "Cancelled", folded: true }] },
  play: async () => { await expect(stage("Cancelled")).toBeEnabled(); },
};

/** An opportunity rotting in its stage: the red days pill on the current stage. */
export const Rotting: Story = {
  args: { current: "3", badge: "8d" },
  play: async () => { await expect(stage(/Proposition/)).toHaveTextContent("8d"); },
};

/** A lost opportunity's bar can't be clicked. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async () => { await expect(stage("Won")).toBeDisabled(); },
};
