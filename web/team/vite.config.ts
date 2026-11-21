import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import optimizeLocales from "@react-aria/optimize-locales-plugin";

export default defineConfig({
  plugins: [
    react(),
    // nodo is in English: React Aria's built-in strings (calendar, combobox, …) for the other
    // 30-odd languages would otherwise ship in the bundle. Dates still format in the browser's locale.
    { ...optimizeLocales.vite({ locales: ["en-US"] }), enforce: "pre" },
  ],
});
