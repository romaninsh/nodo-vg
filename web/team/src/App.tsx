import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Shell } from "./shell/Shell";
import { Board } from "./pages/Board";
import { TodoList } from "./pages/TodoList";

// The form alone needs the date picker, the comboboxes and the tag group: loaded when first opened.
const TodoForm = lazy(() => import("./pages/TodoForm").then((m) => ({ default: m.TodoForm })));

/** nodo: the shell, and the apps inside it. To-do is the only one so far, at the root. */
export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Board />} />
        {/* the splash shows over the board at /about (a refresh or a shared link) */}
        <Route path="/about" element={<Board />} />
        <Route path="/list" element={<TodoList />} />
        <Route path="/todo/:id" element={<Suspense fallback={<p className="muted pad">Loading…</p>}><TodoForm /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
