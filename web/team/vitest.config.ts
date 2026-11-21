import { defineConfig, mergeConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      // Plain unit tests, in jsdom.
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.{ts,tsx}"], environment: "jsdom", setupFiles: ["test/setup.ts"] },
      },
      // Every story in gallery/ as a test in a real Chromium: it renders, its play function's
      // interactions pass, and axe finds no accessibility violation.
      {
        extends: true,
        plugins: [storybookTest({ configDir: ".storybook" })],
        // Bundled up front: a dependency Vite finds mid-run reloads the page and leaves a second
        // copy of React behind ("Cannot read properties of null (reading 'useState')").
        optimizeDeps: {
          include: [
            "react", "react-dom", "react-router", "react-aria-components", "lucide-react", "@internationalized/date", "@vantage-ui/client/react",
            "dompurify", "@tiptap/react", "@tiptap/react/menus", "@tiptap/starter-kit", "@tiptap/extension-list", "@tiptap/extension-table",
            "@tiptap/extension-text-style", "@tiptap/extensions", "@tiptap/suggestion",
          ],
        },
        test: {
          name: "gallery",
          browser: {
            enabled: true,
            headless: true,
            // Fixed so dates and names read the same on every machine.
            provider: playwright({ contextOptions: { locale: "en-US", timezoneId: "UTC" } }),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
}));
