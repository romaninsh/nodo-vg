import { Handshake, ListTodo, type LucideIcon } from "lucide-react";

/** One nodo app in the shell: its tile in the app switcher and its menu in the top bar. */
export type NodoApp = {
  id: string;
  name: string;
  icon: LucideIcon;
  /** The tile's colour (Odoo-like app colours, white icon on top). */
  colour: string;
  /** Where the app starts; every path under it belongs to the app. */
  home: string;
  menu: { to: string; label: string; end?: boolean }[];
  /** An app that isn't built yet shows in the switcher, greyed out. */
  ready: boolean;
};

export const APPS: NodoApp[] = [
  {
    id: "todo", name: "To-do", icon: ListTodo, colour: "#9c5789", home: "/", ready: true,
    menu: [{ to: "/", label: "My to-dos", end: true }, { to: "/list", label: "List" }],
  },
  { id: "crm", name: "CRM", icon: Handshake, colour: "#2a7e91", home: "/crm", ready: true, menu: [{ to: "/crm", label: "Pipeline" }] },
];

/** The app a path belongs to: the one with the longest matching home, To-do otherwise. */
export function appAt(path: string): NodoApp {
  const match = APPS.filter((a) => a.ready && a.home !== "/" && (path === a.home || path.startsWith(`${a.home}/`)))
    .sort((a, b) => b.home.length - a.home.length)[0];
  return match ?? APPS[0]!;
}
