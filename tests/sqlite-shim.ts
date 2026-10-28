import { createRequire } from "node:module";

// Vitest 2's vite-node build predates node:sqlite and strips the node: prefix
// before resolving, so tests alias that request to this runtime-only shim.
const require = createRequire(import.meta.url);
const sqlite = require("node:sqlite") as typeof import("node:sqlite");

export const DatabaseSync = sqlite.DatabaseSync;
