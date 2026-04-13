import { buildApp } from "./app";
import { pool } from "./config/db";
import { env } from "./config/env";
import { logError, logInfo } from "./shared/utils/logger";

async function start(): Promise<void> {
  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    logInfo(`KB API listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal}, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

start().catch((err) => {
  logError("Failed to start server", err);
  process.exit(1);
});
