import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve the "@/..." path alias from tsconfig.json natively (Vite 6+).
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    isolate: true,
  },
});
