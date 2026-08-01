import app from "./app";
import { logger } from "./lib/logger";
import { runStartupMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Apply any additive schema changes (e.g. new nullable columns) that Drizzle
// push may not have applied to the deployed database yet.  Each statement is
// idempotent — safe to run on every server start.
runStartupMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup migrations failed — aborting");
    process.exit(1);
  });
