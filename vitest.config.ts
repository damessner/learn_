import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    fileParallelism: false,
    env: {
      SESSION_SECRET: "test-secret-key-min-32-chars-long!!",
      DATABASE_URL: "file:./test.db",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
