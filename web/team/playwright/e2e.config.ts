import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the real stack: the seeded demo database, vantage-server and the built
// web app, started by e2e/stack.sh (CI's e2e job does it). Each run needs a fresh stack: the tests
// change the demo data.
//   npm run build && e2e/stack.sh up && npm run test:e2e && e2e/stack.sh down
export default defineConfig({
  testDir: "../e2e",
  outputDir: "../test-results/e2e",
  forbidOnly: !!process.env.CI,
  // One browser at a time: the tests sign in as the same people and change the same rows.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "../test-results/e2e.xml" }]] : "list",
  use: {
    baseURL: process.env.NODO_URL ?? "http://127.0.0.1:8090",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } }],
});
