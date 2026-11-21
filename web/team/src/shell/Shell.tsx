import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useHref, useLocation, useNavigate } from "react-router";
import { RouterProvider } from "react-aria-components";
import { useConnection } from "@vantage-ui/client/react";
import { Info, LogOut } from "lucide-react";
import { auth, call, useDb } from "../lib";
import { Avatar, Toaster } from "../ui";
import { Splash, openAbout } from "../Splash";
import { Login } from "./Login";
import { AppSwitcher } from "./AppSwitcher";
import { appAt } from "./apps";

/**
 * What every nodo app shares: signing in, the connection to the server, the top bar with the app
 * switcher, toasts and the about splash. The app's own pages are the children.
 */
export function Shell({ children }: { children: ReactNode }) {
  const db = useDb();
  const navigate = useNavigate();
  const { status, halted, error } = useConnection();
  const [signedIn, setSignedIn] = useState(() => !!auth.token());

  // A stored token the server no longer knows (expired, signed out elsewhere, server restarted):
  // forget it and go back to the sign-in page.
  useEffect(() => {
    if (status === "refused" && auth.token()) {
      auth.clear();
      setSignedIn(false);
      void db.reconnect();
    }
  }, [status, db]);

  if (status === "protocol_mismatch") return <p className="alert">This page is out of date. Reload it. ({error})</p>;
  if (!signedIn || !auth.token()) return <><Login onSignedIn={() => setSignedIn(true)} /><Splash /></>;
  if (halted) return <p className="alert">{error}</p>;

  return (
    // React Aria links (the app switcher's items) navigate through the router, without a reload.
    <RouterProvider navigate={navigate} useHref={useHref}>
      <TopBar onSignedOut={() => setSignedIn(false)} />
      {status === "closed" && <p className="alert">Connection lost; reconnecting…</p>}
      {children}
      <Toaster />
      <Splash />
    </RouterProvider>
  );
}

function TopBar({ onSignedOut }: { onSignedOut: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const app = appAt(useLocation().pathname);
  const me = auth.me();
  const signOut = async () => {
    await call(db.run.sign_out, {});
    auth.clear();
    onSignedOut();
    navigate("/");
    await db.reconnect();
  };
  return (
    <nav className="navbar" aria-label={app.name}>
      <AppSwitcher current={app} />
      <span className="app">{app.name}</span>
      <span className="menu">
        {app.menu.map((m) => <NavLink key={m.to} to={m.to} end={m.end}>{m.label}</NavLink>)}
      </span>
      <span className="spacer" />
      {/* On a phone the labels hide and the icons stay; the labels still name the buttons. */}
      <button className="about" onClick={openAbout}><Info size={16} aria-hidden="true" /><span className="label">About</span></button>
      {me && (
        <span className="user" title={me.login}>
          <Avatar name={me.name} large />
          <span className="label">{me.name}</span>
        </span>
      )}
      <button className="signout" onClick={() => void signOut()}><LogOut size={16} aria-hidden="true" /><span className="label">Sign out</span></button>
    </nav>
  );
}
