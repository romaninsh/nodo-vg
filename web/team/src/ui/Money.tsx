import { useEffect, useState } from "react";
import { Input, TextField } from "react-aria-components";

/** How a company writes money: its currency symbol, before or after the amount, decimals. */
export type Currency = { symbol: string; position: "before" | "after"; decimals: number };

export const USD: Currency = { symbol: "$", position: "before", decimals: 2 };

/** An amount the way Odoo shows it: "$ 40,000.00"; `whole` drops the decimals (column totals). */
export function formatMoney(value: number | null | undefined, currency: Currency, whole = false) {
  const digits = whole ? 0 : currency.decimals;
  const n = (value ?? 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency.position === "after" ? `${n} ${currency.symbol}` : `${currency.symbol} ${n}`;
}

/** Text typed into an amount field as a number: "40,000.50" → 40000.5, "" → 0, junk → null. */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[,\s]/g, "");
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * An amount field: the currency symbol beside a text box that shows the amount with grouping
 * while it isn't being edited. `onChange` gets the number on every keystroke that parses.
 */
export function MoneyField({ value, onChange, currency, label, disabled }: {
  value: number;
  onChange: (value: number) => void;
  currency: Currency;
  label: string;
  disabled?: boolean;
}) {
  const shown = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals });
  const [text, setText] = useState(shown(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(shown(value)); }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <TextField className={`money${currency.position === "after" ? " after" : ""}`} aria-label={label} value={text} isDisabled={disabled}
      inputMode="decimal" isInvalid={parseMoney(text) === null}
      onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
      onChange={(t) => { setText(t); const n = parseMoney(t); if (n !== null) onChange(n); }}>
      <span className="money-symbol" aria-hidden="true">{currency.symbol}</span>
      <Input className="money-input" />
    </TextField>
  );
}
