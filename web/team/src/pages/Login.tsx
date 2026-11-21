import { useState, type FormEvent } from "react";
import { auth, call, useDb, type Me } from "../lib";

/** Sign in with your Odoo login and password. */
export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const db = useDb();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const out = await call<{ login: string; password: string }, Me & { token: string }>(db.run.sign_in, { login, password });
    if (!out.ok) {
      setBusy(false);
      setError(out.message);
      return;
    }
    const { token, uid, name } = out.value;
    auth.save(token, { uid, name, login: out.value.login });
    const conn = await db.reconnect();
    setBusy(false);
    if (conn.halted) {
      auth.clear();
      setError(conn.error ?? "Sign-in refused");
      return;
    }
    onSignedIn();
  };

  return (
    <div className="login">
      <form onSubmit={(e) => void submit(e)}>
        <h1>nodo</h1>
        <p>Sign in with your Odoo login.</p>
        <label htmlFor="login">Login</label>
        <input id="login" autoFocus autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !login || !password}>{busy ? "Signing in…" : "Log in"}</button>
        {error && <div className="err" role="alert">{error}</div>}
      </form>
    </div>
  );
}
