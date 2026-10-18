/**
 * Vitest configuration for frontend unit and component tests.
 * Tests live next to the code they cover as *.test.ts(x) and run in a
 * simulated browser (jsdom). Run with `npm test`.
 */
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same "@/..." import alias as tsconfig.json
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    css: false,
  },
});
