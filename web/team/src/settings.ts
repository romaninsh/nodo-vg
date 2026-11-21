import { useEffect, useState } from "react";

// Per-environment settings from /config/settings.json, read at startup. The repo ships
// public/config/settings.json for local use and the public demo; a real deployment mounts its
// own /config folder over it. No file means the defaults below.

export type Settings = {
  /** Show one-click demo accounts on the sign-in page. Only for demo data. */
  demoLogins?: boolean;
};

let loaded: Promise<Settings> | null = null;

export function loadSettings(): Promise<Settings> {
  loaded ??= (async () => {
    try {
      const res = await fetch("/config/settings.json", { cache: "no-store" });
      // With no file, the server answers with index.html (status 200): check the type.
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return {};
      return (await res.json()) as Settings;
    } catch {
      return {};
    }
  })();
  return loaded;
}

export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>({});
  useEffect(() => {
    let live = true;
    void loadSettings().then((s) => live && setSettings(s));
    return () => {
      live = false;
    };
  }, []);
  return settings;
}
