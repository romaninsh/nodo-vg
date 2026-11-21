import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { createVantage } from "@vantage-ui/client";
import { VantageProvider } from "@vantage-ui/client/react";
import { schema, type Schema } from "./vantage.gen";
import { auth } from "./lib";
import { App } from "./App";
import "./styles.css";

// No URL: the page talks to /v1/ws on the origin that served it (the `team` API).
const db = createVantage<Schema>({ schema, token: () => auth.token() });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <VantageProvider db={db} fallback={<p className="muted" style={{ padding: 20 }}>Connecting…</p>}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </VantageProvider>
  </StrictMode>,
);
