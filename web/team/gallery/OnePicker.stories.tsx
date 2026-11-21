import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor } from "storybook/test";
import { Avatar, OnePicker } from "../src/ui";

const PEOPLE = [
  { id: "2", name: "Mitchell Admin" }, { id: "5", name: "Marc Demo" }, { id: "6", name: "Monica Light" },
];

type Args = Parameters<typeof OnePicker>[0];

function Field(args: Args) {
  const [selected, setSelected] = useState(args.selected);
  return (
    <div className="fields" style={{ margin: 0 }}>
      <span id={args.labelId} className="flabel">Salesperson</span>
      <OnePicker {...args} selected={selected} onChange={(v) => { setSelected(v); args.onChange(v); }} />
    </div>
  );
}

const meta = {
  title: "Controls/OnePicker",
  component: OnePicker,
  args: { labelId: "salesperson", options: PEOPLE, selected: "2", onChange: fn(), clearable: true, placeholder: "Unassigned" },
  render: (args) => <Field {...args} />,
} satisfies Meta<typeof OnePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const box = () => screen.getByRole("combobox", { name: "Salesperson" });

export const Chosen: Story = {
  play: async () => { await expect(box()).toHaveValue("Mitchell Admin"); },
};

/** With an avatar in front, as the salesperson field draws it. */
export const WithAvatar: Story = {
  args: { before: (o) => <Avatar name={o.name} large /> },
  play: async () => { await expect(box()).toHaveValue("Mitchell Admin"); },
};

export const Empty: Story = {
  args: { selected: null },
  play: async () => { await expect(box()).toHaveAttribute("placeholder", "Unassigned"); },
};

export const PickByTyping: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.clear(box());
    await userEvent.type(box(), "mon");
    await userEvent.click(await screen.findByRole("option", { name: "Monica Light" }));
    await expect(args.onChange).toHaveBeenCalledWith("6");
    await waitFor(() => expect(box()).toHaveValue("Monica Light"));
  },
};

export const Clear: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    await expect(args.onChange).toHaveBeenCalledWith(null);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async () => { await expect(box()).toBeDisabled(); },
};
