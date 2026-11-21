import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

const preview: Preview = {
  // The controls sit on white in the app (cards, the form sheet), not on the grey page.
  decorators: [(Story) => <div style={{ background: "var(--surface)", padding: "var(--sp-3)" }}><Story /></div>],
  parameters: {
    layout: "padded",
    // Every story is checked with axe when the Vitest addon runs it; a violation fails the test.
    a11y: { test: "error" },
    // The widths the visual snapshots use (gallery/visual.spec.ts).
    viewport: {
      options: {
        phone: { name: "Phone", styles: { width: "375px", height: "667px" } },
        tablet: { name: "Tablet", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop", styles: { width: "1280px", height: "800px" } },
      },
    },
  },
};

export default preview;
