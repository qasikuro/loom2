---
name: API server startup order
description: app.listen() must be called before runStartupMigrations() or a blocked ALTER TABLE causes a silent zero-output hang
---

## Rule
Always call `app.listen(port, callback)` **first**, then run `runStartupMigrations()` inside the callback (or fire-and-forget after listen).

## Why
`runStartupMigrations()` contains `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. If another DB connection holds a lock on that table (e.g. a long-running query from the previous server instance), the ALTER TABLE waits indefinitely. Since `app.listen()` was previously called only *after* the migration promise resolved, the port was never opened and the workflow health-check timed out. pino logs nothing until after `app.listen()` fires, so the hang produced zero output — making it look like a crash or import error.

## How to apply
Current `src/index.ts` pattern (correct):
```ts
app.listen(port, (err) => {
  if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
  logger.info({ port }, "Server listening");
  runStartupMigrations()
    .then(() => logger.info("Startup migrations completed"))
    .catch((err) => logger.error({ err }, "Startup migrations failed (non-fatal)"));
});
```

Never revert to the old pattern:
```ts
// BAD — hangs silently if any migration query blocks on a lock
runStartupMigrations().then(() => app.listen(port, ...));
```
