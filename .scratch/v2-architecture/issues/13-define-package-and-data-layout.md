# Define package and data layout

Type: grilling
Status: resolved
Blocked by: 07, 08, 09

## Question

What monorepo package graph, npm CLI startup contract, build output, application data directories, Pi data relationship, SQLite location, static-asset layout, shutdown sequence, and future sidecar boundary should v2 standardize?

## Answer

Adopt a private npm-workspaces monorepo with four deliberately coarse workspaces, one publishable CLI artifact, platform-native application directories separate from Pi, and one Gateway instance per Application Data Root. Packages follow runtime and release boundaries; Gateway internals remain deep modules rather than becoming a package per domain.

The effective production engine floor is **Node >=22.19.0** because the selected Pi coding-agent package requires it. `node:sqlite` itself remains valid from the previously established 22.16 baseline, but the product must advertise and enforce the stricter transitive runtime requirement.

### Workspace graph

```text
/package.json                 private; scripts and workspace declaration only
/scripts/                     cross-platform Node build/release scripts
/apps/web                     private Vue/Vite browser application
/apps/gateway                 publishable npm CLI and Node composition root
/packages/contracts           private browser-safe Zod schemas and typed client
/packages/testkit             private protocol fixtures, fakes, and test builders
```

Production dependency direction is `web -> contracts` and `gateway -> contracts`. `testkit -> contracts`; production modules never import testkit. Web never imports Gateway source, Node built-ins, Pi, or SQLite. Gateway never imports Web source: its release assembly consumes only the completed static build.

Auth, Runtime, Session Projection, SQLite, diagnostics, and HTTP adapters stay internal to `apps/gateway`. Query features, Sync Controller, Pinia adapter, rendering, and UI components stay internal to `apps/web`. A new package requires an actual independent runtime, publication, or shared stable contract—not a desire to mirror source folders.

The root pins one lockfile and provides `dev`, `build`, `test`, and package-validation commands. Build order is explicit in a cross-platform Node orchestration script; it does not rely on npm workspace lifecycle concurrency, shell-specific `cp`/`rm`, cwd-relative production lookup, or implicit `prepare` ordering.

### CLI and startup contract

The installed package exposes one ESM executable through `package.json#bin`:

```text
no-pi-no-gang [workspace-path] [--no-open] [--data-dir <absolute-path>]
no-pi-no-gang backups list [--data-dir <absolute-path>]
no-pi-no-gang backups restore <backup-id> --confirm [--data-dir <absolute-path>]
no-pi-no-gang --help | --version
```

The optional Workspace path defaults to the launch cwd. It is only a short-lived registration proposal and never creates a Workspace Grant from the terminal. After acquiring the instance lock and reaching readiness, the Gateway binds a random `127.0.0.1` port, creates the one-time fragment bootstrap URL, and best-effort opens the default browser. `--no-open`, headless operation, or open failure prints the URL for the user. The CLI is otherwise non-interactive.

No v1 option enables a non-loopback host or fixed public listener. The bootstrap URL is printed only as an immediate startup instruction and is excluded from structured logs and later diagnostics. Argument errors, unsupported Node/Pi environment, lock conflict, migration failure, or inability to reach readiness exit nonzero before opening a browser.

Application directory precedence is `--data-dir`, then `NO_PI_NO_GANG_DATA_DIR`, then platform defaults. An override must resolve to an absolute canonical user-writable path and places `data`, `state`, `cache`, and `logs` beneath it; this is the supported test/isolation mechanism, not a portable Workspace mode.

### Build and published artifact

The release build performs these explicit stages: validate/generate contracts, build the Vite SPA, compile/bundle Gateway plus repository-internal contracts, copy immutable SQL migrations, assemble the npm package, then run `npm pack --dry-run`/installed smoke tests. Third-party Node dependencies—including Pi—remain normal package dependencies rather than being blindly bundled; repository-internal runtime code is self-contained in the CLI artifact.

The publishable Gateway package contains only declared runtime material:

```text
dist/cli.mjs                 shebang/bin entry and thin process adapter
dist/server/                 Gateway runtime chunks and source maps
dist/public/index.html       SPA entry
dist/public/assets/*         Vite content-hashed assets
dist/migrations/*.sql        immutable numbered migration assets
package.json, README, LICENSE
```

`package.json#files` explicitly includes those paths; workspace links and source trees are never required after installation. `cli.mjs` parses argv, resolves directories, installs process handlers, invokes the internal `createGateway(options)`, opens/prints the browser URL, and maps shutdown to an exit code. `createGateway()` is an internal composition/test seam, not a public semver SDK export.

Static serving is owned by Gateway. `/api/v1` and the SSE endpoint never fall through to SPA history routing. Content-hashed assets are immutable-cacheable; `index.html` and Bootstrap-bearing navigation are no-cache. Startup verifies required static and migration assets before binding.

### Application-owned directories

A single directory resolver returns semantic `data`, `state`, `cache`, and `logs` roots:

| Platform | Data | State / logs | Cache |
|---|---|---|---|
| Linux | `${XDG_DATA_HOME:-~/.local/share}/no-pi-no-gang` | `${XDG_STATE_HOME:-~/.local/state}/no-pi-no-gang` | `${XDG_CACHE_HOME:-~/.cache}/no-pi-no-gang` |
| macOS | `~/Library/Application Support/no-pi-no-gang` | `Application Support/no-pi-no-gang/State`; logs under `~/Library/Logs/no-pi-no-gang` | `~/Library/Caches/no-pi-no-gang` |
| Windows | `%LOCALAPPDATA%\no-pi-no-gang\Data` | sibling `State` and `Logs` | sibling `Cache` |

No Roaming AppData or Workspace-local metadata is used in v1. POSIX directories/files are created with user-only modes where supported; Windows relies on the current user's inherited ACL and must not claim POSIX-equivalent secrecy.

The data tree begins as:

```text
data/
  app.sqlite3               application tables, idempotency, grants, projections, FTS
  app.sqlite3-wal/-shm      SQLite-managed adjacent files when present
  backups/<backup-id>/      verified pre-migration snapshots; three retained after success
state/
  run/instance.lock         owner metadata for the data-root singleton
  logs/                     where the platform does not supply a separate logs root
cache/                      wholly rebuildable artifacts only
```

Migrations ship read-only with the package and never copy into the mutable data tree. All application tables and generation-switched projections share `app.sqlite3`; there is no SQLite database per Workspace or Session. Cache deletion must not lose Grants, command results, tombstones, or projections' rebuild coordination. Exact log files/retention belong to **Define diagnostics and operational visibility**; migration backup and rollback belong to **Define upgrade and rollback policy**.

### Relationship to Pi data

The Pi Agent Root remains Pi-owned—normally `~/.pi/agent`, or the effective `PI_CODING_AGENT_DIR`. Gateway resolves that location once and passes explicit Pi SDK managers/options so all Runtime, AuthStorage, model settings, and Session discovery agree on it. The application does not copy `auth.json`, `models.json`, settings, or Session JSONL into its own data root, and never treats SQLite projections as a backup.

Application SQLite stores only opaque IDs, necessary canonical references, coordination state, and rebuildable normalized projections. Secrets continue to use Pi AuthStorage. Changing Application Data Root does not silently move or fork Pi data; changing Pi Agent Root intentionally selects another Pi-owned corpus and triggers normal discovery/reconciliation.

Recoverable Session deletion must rename on the source filesystem. Each source Session directory uses a hidden sibling recycle area conceptually shaped as:

```text
<source-session-dir>/.no-pi-no-gang-recycle/
  <sessionId>--<commandId>/
    session.pi-session      renamed JSONL with a non-.jsonl extension
    manifest.json           bounded identity/original-path/delete metadata
```

This guarantees same-filesystem atomic rename and prevents Pi discovery from treating recycled content as active JSONL. SQLite retains the prepared/completed operation and permanent tombstone. Per the chosen policy, v1 performs **no automatic purge**: recycled files remain until explicit manual/future product action. Startup/reconciliation emits one bounded safe diagnostic event with recycle count and total bytes; no diagnostics dashboard is required. Routine cache cleanup must never touch it.

### Single-instance and startup order

Exactly one Gateway may own an Application Data Root. Different explicit data roots may run concurrently. Before migration, watchers, Pi Runtime creation, or HTTP bind, Gateway acquires an exclusive instance lock containing bounded PID/start/owner metadata. A conflict exits with actionable local information. Stale recovery verifies owner liveness and uses an atomic takeover; uncertain ownership refuses to start rather than risking two Pi writers.

Startup order is: resolve/secure directories; acquire instance lock; initialize diagnostics; open and migrate SQLite; reconcile incomplete delete/migration state; initialize projection and auth/runtime coordinators; bind the random loopback listener; mark readiness; create the one-time browser bootstrap; open or print the URL. Readiness and browser launch never precede successful migration/reconciliation.

### Bounded shutdown

SIGINT and SIGTERM initiate one idempotent shutdown promise; Windows also handles the supported console events on a best-effort basis. The sequence is:

1. mark readiness `shutting_down`, close command admission, and stop accepting new HTTP work;
2. close SSE/idle connections and begin `server.close()`;
3. call `SessionRuntimeCoordinator.shutdown()`, which interrupts queued Runs and concurrently aborts active Runs with its fixed ten-second settled/durable limit;
4. stop AuthFlows, projection watchers, schedulers, and background reconciliation;
5. finish/checkpoint application transactions, close SQLite and diagnostics, then release the instance lock;
6. set the process exit code only after cleanup completes.

The whole drain has a 15-second hard deadline. A second termination signal or expiry forces remaining connections/resources closed and exits nonzero; startup recovery then marks uncertain work interrupted and reconciles prepared operations. No shutdown path claims an unconfirmed Run completed.

### Future sidecar boundary

The future desktop shell spawns the same CLI process and talks through the same versioned REST/SSE contracts and generated GatewayClient. It does not import Gateway internals or receive a second IPC business protocol. The thin CLI/process adapter and internal `createGateway()` handle keep process concerns outside domain modules and permit integration tests, but are not a public embedding API.

A future supervisor may add a machine-readable startup handoff around origin/bootstrap and bundle a pinned Node runtime; that is a new adapter around the existing process boundary. It must not change Session ownership, bypass local authentication, or couple the web client to inherited cwd, TTY, workspace paths, or Pi objects.

Research asset: [Package, platform-directory, Pi-data, and shutdown facts](../research/package-and-data-layout.md).
