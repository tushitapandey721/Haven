// Load environment variables from .env before anything else
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const require = createRequire(import.meta.url);
  try {
    const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
    dotenv.config({ path: envPath });
  } catch {
    // dotenv not installed — fall through, env already set by shell
  }
}

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env.PORT || process.env.API_PORT || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, "0.0.0.0", () => {
  logger.info(
    { port, env: process.env.NODE_ENV || "development" },
    "Sentinel API server started",
  );
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "Gracefully shutting down Sentinel API server...");
  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
