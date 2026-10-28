import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    server: { deps: { external: ["node:sqlite"] } },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      sqlite: fileURLToPath(new URL("./tests/sqlite-shim.ts", import.meta.url)),
    },
  },
});
