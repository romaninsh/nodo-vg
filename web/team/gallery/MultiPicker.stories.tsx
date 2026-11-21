import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor } from "storybook/test";
import { Avatar, MultiPicker, type PickerOption } from "../src/ui";
import { tagColor, tagText } from "../src/lib";

const PEOPLE: PickerOption[] = [
  { id: "2", name: "Mitchell Admin" },
  { id: "6", name: "Marc Demo" },
  { id: "7", name: "Joel Willis" },
  { id: "8", name: "Abigail Peterson" },
];
// Tags with their Odoo colour index, coloured the way the form does it.
const TAGS: (PickerOption & { color: number })[] = [
  { id: "1", name: "Bug", color: 1 },
  { id: "2", name: "Experiment", color: 4 },
  { id: "3", name: "Usability", color: 10 },
  { id: "4", name: "Internal", color: 0 },
  { id: "5", name: "Feedback", color: 9 },
];
const tagStyle = (o: PickerOption) => {
  const color = TAGS.find((t) => t.id === o.id)?.color;
  return { background: tagColor(color), color: tagText(color) };
};
// While a picker's list is open, React Aria hides the rest of the page from screen readers
// (aria-hidden). The list closes, and the page comes back, as soon as focus leaves the box, so
// the chips can't be reached while hidden; axe only sees them focusable inside aria-hidden.
const LIST_OPEN = { a11y: { config: { rules: [{ id: "aria-hidden-focus", enabled: false }] } } };

type Args = Parameters<typeof MultiPicker>[0];

/** The picker with its label, keeping its own selection. */
function Field(args: Args) {
  const [selected, setSelected] = useState(args.selected);
  return (
    <div className="fields" style={{ margin: 0 }}>
      <span id={args.labelId} className="flabel">{args.labelId === "assignees" ? "Assignees" : "Tags"}</span>
      <MultiPicker {...args} selected={selected} onChange={(ids) => { setSelected(ids); args.onChange(ids); }} />
    </div>
  );
}

const meta = {
  title: "Controls/MultiPicker",
  component: MultiPicker,
  args: {
    labelId: "assignees",
    addLabel: "Assign someone",
    placeholder: "Add someone…",
    options: PEOPLE,
    selected: ["2"],
    onChange: fn(),
    chip: (o: PickerOption) => <><Avatar name={o.name} />{o.name}</>,
  },
  render: (args) => <Field {...args} />,
} satisfies Meta<typeof MultiPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const box = (name = "Assign someone") => screen.getByRole("combobox", { name });

export const Empty: Story = {
  args: { selected: [] },
  play: async () => { await expect(box()).toHaveValue(""); },
};

export const People: Story = {
  args: { selected: ["2", "6"] },
  play: async () => {
    await expect(screen.getByRole("row", { name: /Mitchell Admin/ })).toBeVisible();
    await expect(screen.getByRole("row", { name: /Marc Demo/ })).toBeVisible();
  },
};

export const Tags: Story = {
  args: {
    labelId: "tags", addLabel: "Add a tag", placeholder: "Add a tag…", options: TAGS, selected: ["1", "3", "4"],
    chip: undefined, chipStyle: tagStyle,
  },
};

/** You can't take yourself off your own to-do: your chip has no ×. */
export const LockedChip: Story = {
  args: { selected: ["2", "6"], removable: (id) => id !== "2" },
  play: async () => {
    await expect(screen.getAllByRole("button", { name: /Remove/ })).toHaveLength(1);
  },
};

export const Disabled: Story = {
  args: { selected: ["2", "6"], disabled: true },
  play: async () => {
    await expect(box()).toBeDisabled();
    await expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  },
};

/** Focus opens the rest of the people. */
export const Open: Story = {
  parameters: LIST_OPEN,
  play: async ({ userEvent }) => {
    await userEvent.click(box());
    const list = await screen.findByRole("listbox");
    await expect(list).toBeVisible();
    await expect(screen.queryByRole("option", { name: "Mitchell Admin" })).toBeNull();
    await expect(screen.getAllByRole("option")).toHaveLength(3);
  },
};

export const NothingLeft: Story = {
  args: { selected: PEOPLE.map((p) => p.id) },
  parameters: LIST_OPEN,
  play: async ({ userEvent }) => {
    await userEvent.click(box());
    await expect(await screen.findByText("Nothing to add")).toBeVisible();
  },
};

/** Typing filters; a pick adds a chip and leaves the box empty and open for the next. */
export const TypeAndPick: Story = {
  parameters: LIST_OPEN,
  play: async ({ args, userEvent }) => {
    await userEvent.type(box(), "joe");
    await expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.click(screen.getByRole("option", { name: "Joel Willis" }));
    await expect(args.onChange).toHaveBeenCalledWith(["2", "7"]);
    await waitFor(() => expect(box()).toHaveFocus());
    await expect(box()).toHaveValue("");
    // The list is open again for the next pick, so the chips are aria-hidden for now.
    await expect(screen.getByRole("row", { name: /Joel Willis/, hidden: true })).toBeVisible();
  },
};

export const RemoveWithMouse: Story = {
  args: { selected: ["2", "6"] },
  play: async ({ args, userEvent }) => {
    const [, second] = screen.getAllByRole("button", { name: /Remove/ });
    await userEvent.click(second!);
    await expect(args.onChange).toHaveBeenCalledWith(["2"]);
  },
};

export const RemoveWithKeyboard: Story = {
  args: { selected: ["2", "6"] },
  play: async ({ args, userEvent }) => {
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}{Backspace}");
    await expect(args.onChange).toHaveBeenCalledWith(["2"]);
  },
};
