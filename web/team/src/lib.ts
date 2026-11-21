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
export const tagColor = (c: number | null | undefined) => TAG_COLORS[(c ?? 0) % 12] ?? TAG_COLORS[0]!;
export const tagText = (c: number | null | undefined) => ((c ?? 0) === 0 || c === 3 ? "#374151" : "#fff");

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
