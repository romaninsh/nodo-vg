import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, waitFor, within } from "storybook/test";
import { DateTimePicker } from "../src/ui";

type Args = Parameters<typeof DateTimePicker>[0];

function Field(args: Args) {
  const [value, setValue] = useState(args.value);
  return (
    <div className="fields" style={{ margin: 0 }}>
      <span id={args.labelId} className="flabel">Deadline</span>
      <span><DateTimePicker {...args} value={value} onChange={(v) => { setValue(v); args.onChange(v); }} /></span>
    </div>
  );
}

const meta = {
  title: "Controls/DateTimePicker",
  component: DateTimePicker,
  args: { value: "2026-03-17T14:30", labelId: "deadline", onChange: fn() },
  render: (args) => <Field {...args} />,
} satisfies Meta<typeof DateTimePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const group = () => screen.getByRole("group", { name: "Deadline" });
const calendarButton = () => screen.getByRole("button", { name: /Calendar/ });

export const Empty: Story = {
  args: { value: "" },
  play: async () => { await expect(screen.getAllByRole("spinbutton").length).toBeGreaterThanOrEqual(5); },
};

export const WithValue: Story = {
  play: async () => {
    await expect(screen.getByRole("spinbutton", { name: /hour/i })).toHaveAttribute("aria-valuenow", "14");
    await expect(screen.getByRole("spinbutton", { name: /minute/i })).toHaveAttribute("aria-valuenow", "30");
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async () => { await expect(calendarButton()).toBeDisabled(); },
};

/** The calendar opens on the deadline's month, the day picked. */
export const CalendarOpen: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(calendarButton());
    const dialog = await screen.findByRole("dialog");
    await expect(dialog).toHaveTextContent("March 2026");
    await expect(screen.getByRole("gridcell", { selected: true })).toHaveTextContent("17");
  },
};

/** A day from the calendar keeps the time. */
export const PickADay: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(calendarButton());
    await userEvent.click(await screen.findByRole("button", { name: /March 20, 2026/ }));
    await expect(args.onChange).toHaveBeenCalledWith("2026-03-20T14:30");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const NextMonth: Story = {
  play: async ({ userEvent }) => {
    await userEvent.click(calendarButton());
    const dialog = await screen.findByRole("dialog");
    // The first "Next" is the header's; React Aria adds a hidden one after the grid for screen readers.
    await userEvent.click(within(dialog).getAllByRole("button", { name: "Next" })[0]!);
    await expect(dialog).toHaveTextContent("April 2026");
  },
};

/** Typed segments: the hour goes up with the arrow key. */
export const TypeTheTime: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.click(screen.getByRole("spinbutton", { name: /hour/i }));
    await userEvent.keyboard("{ArrowUp}");
    await expect(args.onChange).toHaveBeenCalledWith("2026-03-17T15:30");
    await expect(group()).toBeVisible();
  },
};
