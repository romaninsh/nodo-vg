import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Shell } from "./shell/Shell";
import { Board } from "./pages/Board";
import { TodoList } from "./pages/TodoList";

// The forms need the date picker, the comboboxes and the tag group: loaded when first opened.
// CRM is its own chunk, loaded when someone opens it.
const TodoForm = lazy(() => import("./pages/TodoForm").then((m) => ({ default: m.TodoForm })));
const Pipeline = lazy(() => import("./crm/Pipeline").then((m) => ({ default: m.Pipeline })));
const OpportunityForm = lazy(() => import("./crm/OpportunityForm").then((m) => ({ default: m.OpportunityForm })));
const NewOpportunityForm = lazy(() => import("./crm/OpportunityForm").then((m) => ({ default: m.NewOpportunityForm })));
// Project is its own chunk too.
const ProjectsOverview = lazy(() => import("./project/Projects").then((m) => ({ default: m.ProjectsOverview })));
const TaskBoard = lazy(() => import("./project/TaskBoard").then((m) => ({ default: m.TaskBoard })));
const ProjectTaskForm = lazy(() => import("./project/TaskForm").then((m) => ({ default: m.ProjectTaskForm })));

const loading = <p className="muted pad">Loading…</p>;

/** nodo: the shell, and the apps inside it: To-do at the root, CRM under /crm. */
export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Board />} />
        {/* the splash shows over the board at /about (a refresh or a shared link) */}
        <Route path="/about" element={<Board />} />
        <Route path="/list" element={<TodoList />} />
        <Route path="/todo/:id" element={<Suspense fallback={loading}><TodoForm /></Suspense>} />
        <Route path="/crm" element={<Suspense fallback={loading}><Pipeline /></Suspense>} />
        <Route path="/crm/new" element={<Suspense fallback={loading}><NewOpportunityForm /></Suspense>} />
        <Route path="/crm/:id" element={<Suspense fallback={loading}><OpportunityForm /></Suspense>} />
        <Route path="/project" element={<Suspense fallback={loading}><ProjectsOverview /></Suspense>} />
        <Route path="/project/:pid/tasks" element={<Suspense fallback={loading}><TaskBoard /></Suspense>} />
        <Route path="/project/:pid/tasks/:id" element={<Suspense fallback={loading}><ProjectTaskForm /></Suspense>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
