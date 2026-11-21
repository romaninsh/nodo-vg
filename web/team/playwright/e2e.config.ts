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
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "../test-results/e2e.xml" }]] : "list",
  use: {
    baseURL: process.env.NODO_URL ?? "http://127.0.0.1:8090",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // The phone's pictures are CI's, like the gallery's: a failed run uploads a fresh set as the
  // `e2e-snapshots` artifact (gh run download <run id> -n e2e-snapshots -D web/team/e2e/snapshots).
  snapshotPathTemplate: "{testDir}/snapshots/{arg}-{projectName}{ext}",
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
  projects: [
    // First, on the untouched demo data.
    {
      name: "phone",
      testMatch: "phone.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    },
    {
      name: "desktop",
      testMatch: "todo.spec.ts",
      dependencies: ["phone"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "crm",
      testMatch: "crm.spec.ts",
      dependencies: ["desktop"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "project",
      testMatch: "project.spec.ts",
      dependencies: ["crm"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    // Saves through Odoo itself, so it needs a running Odoo beside the server (the dev stack:
    // NODO_URL=<the team API's URL> npx playwright test -c playwright/e2e.config.ts e2e/richtext.spec.ts).
    // Skipped when there is none, as on e2e/stack.sh.
    {
      name: "richtext",
      testMatch: "richtext.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
