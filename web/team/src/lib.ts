import { useVantage } from "@vantage-ui/client/react";
import type { Schema } from "./vantage.gen";

export const useDb = () => useVantage<Schema>();

// ---- who is signed in (this browser tab only) ----
const TOKEN = "nodo.token";
const USER = "nodo.user";
// The Odoo password is not kept here: the server keeps it with your sign-in (in memory) for
// tag saves through Odoo. Clear what an older version of this page left behind.
sessionStorage.removeItem("nodo.pw");

export type Me = { uid: number; name: string; login: string };

export const auth = {
  token: () => sessionStorage.getItem(TOKEN) ?? undefined,
  me: (): Me | null => {
    const raw = sessionStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as Me) : null;
  },
  save(token: string, me: Me) {
    sessionStorage.setItem(TOKEN, token);
    sessionStorage.setItem(USER, JSON.stringify(me));
  },
  clear() {
    sessionStorage.removeItem(TOKEN);
    sessionStorage.removeItem(USER);
  },
};

// ---- running an action and waiting for its end ----
type Startable<A> = { start(args: A): { done: Promise<unknown> } };
export type Outcome<T = Record<string, unknown>> = { ok: true; value: T } | { ok: false; message: string };

export async function call<A, T = Record<string, unknown>>(action: Startable<A>, args: A): Promise<Outcome<T>> {
  const run = action.start(args);
  const out = (await run.done) as { ok: boolean; value?: unknown; error?: { message?: string } };
  if (out.ok) return { ok: true, value: (out.value ?? {}) as T };
  return { ok: false, message: out.error?.message ?? "Something went wrong" };
}

// ---- display helpers ----
// Odoo's twelve tag colours live with the shared controls (the tag colour picker uses them).
export { tagColor, tagText } from "./ui/tagColors";

export const ids = (s: string | null | undefined) =>
  (s ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "");

/**
 * A UTC instant from the API, in this browser's time zone, the way Odoo's relative date shows a
 * deadline: in days up to 13 days away ("Today", "In 13 days", "2 days ago"), then in calendar
 * weeks within the month before or after ("Next week", "In 3 weeks"), then in months up to
 * about two years ("In 5 months"), then in years.
 */
export function deadlineLabel(iso: string | null | undefined, now: Date = new Date()) {
  if (!iso) return "";
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const v = start(d);
  const today = start(now);
  const days = Math.round((v.getTime() - today.getTime()) / 86400000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (Math.floor(Math.abs(days) / 7) <= 1) return cap(rtf.format(days, "day"));
  const months = (v.getFullYear() - today.getFullYear()) * 12 + v.getMonth() - today.getMonth();
  if (Math.abs(months) <= 1) {
    const monday = (x: Date) => { const m = new Date(x); m.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return m; };
    const weeks = Math.round((monday(v).getTime() - monday(today).getTime()) / (7 * 86400000));
    return cap(rtf.format(weeks, "week"));
  }
  if (Math.floor(Math.abs(days) / 365.25) <= 1) return cap(rtf.format(months, "month"));
  return cap(rtf.format(v.getFullYear() - today.getFullYear(), "year"));
}

export const fullDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

/** UTC instant → value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → UTC instant text for the API. */
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString().replace(/\.\d{3}Z$/, "Z") : "");

export const isDone = (state: string | null | undefined) => state === "1_done";
