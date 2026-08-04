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

// Start listening immediately so the port is open (workflow health-check passes)
// then run additive migrations in the background.  All migrations are
// idempotent ADD COLUMN / CREATE TABLE IF NOT EXISTS — safe to run while the
// server is already serving requests.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  runStartupMigrations()
    .then(() => logger.info("Startup migrations completed"))
    .catch((err) => logger.error({ err }, "Startup migrations failed (non-fatal)"));
});
