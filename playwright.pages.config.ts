import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages.spec.ts",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:4174/mahal-pages-test/",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && node scripts/serve-pages-test.mjs",
    url: "http://127.0.0.1:4174/mahal-pages-test/",
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      PAGES_BASE_PATH: "/mahal-pages-test/",
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_PROJECT_ID: "",
      VITE_USE_EMULATORS: "false",
    },
  },
  reporter: "list",
});
