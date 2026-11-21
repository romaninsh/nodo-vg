import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router";
import { useConnection } from "@vantage-ui/client/react";
import { auth, avatarColor, call, initials, useDb } from "./lib";
import { Login } from "./pages/Login";
import { Board } from "./pages/Board";
import { TodoList } from "./pages/TodoList";
import { TodoForm } from "./pages/TodoForm";
import { Toaster } from "./components";
import { Splash, openAbout } from "./Splash";

export function App() {
  const db = useDb();
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
    <>
      <TopBar onSignedOut={() => setSignedIn(false)} />
      {status === "closed" && <p className="alert">Connection lost; reconnecting…</p>}
      <Routes>
        <Route path="/" element={<Board />} />
        {/* the splash shows over the board at /about (a refresh or a shared link) */}
        <Route path="/about" element={<Board />} />
        <Route path="/list" element={<TodoList />} />
        <Route path="/todo/:id" element={<TodoForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
      <Splash />
    </>
  );
}

function TopBar({ onSignedOut }: { onSignedOut: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const me = auth.me();
  const signOut = async () => {
    await call(db.run.sign_out, {});
    auth.clear();
    onSignedOut();
    navigate("/");
    await db.reconnect();
  };
  return (
    <nav className="navbar">
      <span className="apps" title="nodo">▦</span>
      <span className="app">To-do</span>
      <span className="menu">
        <NavLink to="/" end>My to-dos</NavLink>
        <NavLink to="/list">List</NavLink>
      </span>
      <span className="spacer" />
      <button className="about" onClick={openAbout}>About</button>
      {me && (
        <span className="user" title={me.login}>
          <span className="avatar lg" style={{ background: avatarColor(me.name) }}>{initials(me.name)}</span>
          {me.name}
        </span>
      )}
      <button className="signout" onClick={() => void signOut()}>Sign out</button>
    </nav>
  );
}
