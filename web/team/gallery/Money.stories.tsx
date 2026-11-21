import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen } from "storybook/test";
import { MoneyField, USD, formatMoney } from "../src/ui";

type Args = Parameters<typeof MoneyField>[0];

function Live(args: Args) {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <MoneyField {...args} value={value} onChange={(v) => { setValue(v); args.onChange(v); }} />
      <span data-testid="shown">{formatMoney(value, args.currency)}</span>
    </div>
  );
}

const meta = {
  title: "Controls/Money",
  component: MoneyField,
  args: { value: 40000, currency: USD, label: "Expected revenue", onChange: fn() },
  render: (args) => <Live {...args} />,
} satisfies Meta<typeof MoneyField>;
export default meta;
type Story = StoryObj<typeof meta>;

const box = () => screen.getByRole("textbox", { name: "Expected revenue" });

export const Amount: Story = {
  play: async () => {
    await expect(box()).toHaveValue("40,000.00");
    await expect(screen.getByTestId("shown")).toHaveTextContent("$ 40,000.00");
  },
};

/** A currency written after the amount (as Odoo's euro). */
export const SymbolAfter: Story = {
  args: { currency: { symbol: "€", position: "after", decimals: 2 }, value: 1234.5 },
  play: async () => { await expect(screen.getByTestId("shown")).toHaveTextContent("1,234.50 €"); },
};

export const Type: Story = {
  args: { value: 0 },
  play: async ({ args, userEvent }) => {
    await userEvent.clear(box());
    await userEvent.type(box(), "1,250.5");
    await expect(args.onChange).toHaveBeenLastCalledWith(1250.5);
  },
};

/** Text that isn't a number marks the field invalid and changes nothing. */
export const NotANumber: Story = {
  play: async ({ args, userEvent }) => {
    await userEvent.clear(box());
    await userEvent.type(box(), "abc");
    await expect(box()).toHaveAttribute("aria-invalid", "true");
    await expect(args.onChange).not.toHaveBeenCalledWith(Number.NaN);
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  play: async () => { await expect(box()).toBeDisabled(); },
};
