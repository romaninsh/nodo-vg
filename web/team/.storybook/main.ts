import type { StorybookConfig } from "@storybook/react-vite";

// The gallery of the shared controls in src/ui. Stories live in gallery/, outside src/, so the
// app's own code counts (scripts/stats.py) stay the app's.
const config: StorybookConfig = {
  stories: ["../gallery/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
};

export default config;
