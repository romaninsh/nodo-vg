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
// Odoo's twelve tag colours (index = project_tags.color).
const TAG_COLORS = [
  "#e9ecef", "#F06050", "#F4A460", "#F7CD1F", "#6CC1ED", "#814968",
  "#EB7E7F", "#2C8397", "#475577", "#D6145F", "#30C381", "#9365B8",
];
export const TAG_COLOR_COUNT = TAG_COLORS.length;
export const tagColor = (c: number | null | undefined) => TAG_COLORS[(c ?? 0) % 12] ?? TAG_COLORS[0]!;
// White text where it reads at 4.5:1 (WCAG AA) on the tag's colour, dark text elsewhere.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const tagText = (c: number | null | undefined) => (1.05 / (luminance(tagColor(c)) + 0.05) >= 4.5 ? "#fff" : "#212529");

export const ids = (s: string | null | undefined) =>
  (s ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "");

/** A UTC instant from the API, shown in this browser's time zone, the way Odoo shows a deadline. */
export function deadlineLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(today)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0 && diff > -7) return `${-diff} days ago`;
  if (diff > 0 && diff < 7) return `In ${diff} days`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
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

// ---- the to-do form's pager (Odoo's "2 / 7" with arrows) ----
// The board or list a to-do was opened from remembers its order for this tab; the form steps
// through it.
const ORDER_KEY = "nodo.order";

export function rememberOrder(ids: string[]) {
  try { sessionStorage.setItem(ORDER_KEY, JSON.stringify(ids)); } catch { /* storage off: no pager */ }
}

/** Where `id` sits in the remembered order: 1-based position, total, and its neighbours. */
export function orderAround(id: string): { pos: number; total: number; prev?: string; next?: string } | null {
  let ids: string[] = [];
  try { ids = JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? "[]"); } catch { return null; }
  const i = ids.indexOf(id);
  if (i < 0) return null;
  return { pos: i + 1, total: ids.length, prev: ids[i - 1], next: ids[i + 1] };
}
