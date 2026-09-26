import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: process.env.PAGES_BASE_PATH || "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/@zxing/")) return "qr-scanner";
          if (
            id.includes("/node_modules/@firebase/") ||
            id.includes("/node_modules/firebase/")
          )
            return "firebase";
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react-router")
          )
            return "react";
        },
      },
    },
  },
});
