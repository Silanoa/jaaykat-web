import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 360, height: 640 },
    locale: "fr-FR",
  },
  webServer: {
    // Direct vite binary — avoids corepack/pnpm PATH issues on Windows CI/dev machines.
    command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
