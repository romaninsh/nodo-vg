import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen } from "storybook/test";
import { ColumnProgress, type Segment } from "../src/ui";

const SEGMENTS: Segment[] = [
  { key: "planned", label: "planned", count: 2, tone: "ok" },
  { key: "today", label: "due today", count: 1, tone: "warn" },
  { key: "overdue", label: "overdue", count: 2, tone: "danger" },
  { key: "none", label: "without activities scheduled", count: 1, tone: "none" },
];

type Args = Parameters<typeof ColumnProgress>[0];

function Live(args: Args) {
  const [selected, setSelected] = useState(args.selected);
  return (
    <div style={{ width: 260 }}>
      <ColumnProgress {...args} selected={selected} onSelect={(k) => { setSelected(k); args.onSelect(k); }} />
    </div>
  );
}

const meta = {
  title: "Controls/ColumnProgress",
  component: ColumnProgress,
  args: { segments: SEGMENTS, selected: null, onSelect: fn(), label: "Activities in Proposition" },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof ColumnProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

const segment = (name: RegExp) => screen.getByRole("button", { name });

export const AllKinds: Story = {
  play: async () => {
    await expect(segment(/2 planned/)).toHaveAttribute("aria-pressed", "false");
    await expect(screen.getAllByRole("button")).toHaveLength(4);
  },
};

/** A kind with no cards draws no segment. */
export const OnlyOverdue: Story = {
  args: { segments: SEGMENTS.map((s) => ({ ...s, count: s.key === "overdue" ? 3 : 0 })) },
  play: async () => { await expect(screen.getAllByRole("button")).toHaveLength(1); },
};

/** An empty column: a grey bar, nothing to press. */
export const Empty: Story = {
  args: { segments: SEGMENTS.map((s) => ({ ...s, count: 0 })) },
  play: async () => { await expect(screen.queryAllByRole("button")).toHaveLength(0); },
};

export const PickAndClear: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(segment(/overdue/));
    await expect(args.onSelect).toHaveBeenLastCalledWith("overdue");
    await expect(segment(/overdue/)).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(segment(/overdue/));
    await expect(args.onSelect).toHaveBeenLastCalledWith(null);
  },
};
