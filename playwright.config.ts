import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: "pages.spec.ts",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    browserName: "chromium",
    viewport: { width: 1440, height: 1050 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    env: {
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_PROJECT_ID: "",
      VITE_USE_EMULATORS: "false",
    },
  },
  reporter: "list",
});
