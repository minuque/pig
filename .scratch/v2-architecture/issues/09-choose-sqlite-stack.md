# Choose the SQLite stack

Type: research
Status: resolved
Blocked by:

## Question

Which Node-compatible SQLite driver and migration approach best fit an npm-distributed Hono Gateway that needs application-owned metadata, rebuildable FTS projections, transactional migrations, Windows/macOS/Linux support, and future desktop sidecar packaging?

## Answer

Adopt **built-in `node:sqlite` and an application-owned numbered SQL migration runner**. SQLite requires the verified Node >=22.16.0 capability baseline; the product-level engine floor is raised to **Node >=22.19.0** because the selected Pi coding-agent package requires the stricter version. This avoids native addon downloads, `node-gyp`, Electron ABI rebuilding, and platform-specific prebuild failures while retaining transactions and FTS5 in official Node binaries.

Migrations are immutable ordered `.sql` files. Startup reads `PRAGMA user_version` and applies each next migration inside `BEGIN IMMEDIATE` / `COMMIT`, rolling back and refusing to serve on failure. Do not introduce an ORM or migration framework. Long FTS rebuilds run as explicit controlled work rather than inside request handlers because `DatabaseSync` is synchronous.

If Node 20 support later becomes a hard requirement, reopen the decision and evaluate `better-sqlite3`; do not maintain two production drivers. Detailed facts, tradeoffs, tests, and source links: [SQLite stack research](../research/sqlite-stack.md).
