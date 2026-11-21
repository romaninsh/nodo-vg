import { defineConfig } from "@playwright/test";

// Visual snapshots of every gallery story at a phone, a tablet and a desktop width, against the
// built Storybook (npm run build-storybook). The snapshots are CI's: the gallery job runs in the
// Playwright Docker image on linux/amd64, and fonts render differently anywhere else. When a
// change moves pixels on purpose, the job uploads a fresh set as the `gallery-snapshots`
// artifact; check the pictures and commit them:
//   gh run download <run id> -n gallery-snapshots -D web/team/playwright/snapshots
export default defineConfig({
  testDir: ".",
  testMatch: "gallery.spec.ts",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}-{projectName}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "../test-results/gallery-visual.xml" }]] : "list",
  outputDir: "../test-results/gallery",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  use: {
    baseURL: "http://127.0.0.1:6007",
    locale: "en-US",
    timezoneId: "UTC",
  },
  projects: [
    { name: "phone", use: { viewport: { width: 375, height: 667 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "node playwright/serve.mjs storybook-static 6007",
    cwd: "..",
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: !process.env.CI,
  },
});
