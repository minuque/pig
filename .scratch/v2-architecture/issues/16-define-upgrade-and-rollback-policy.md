# Define upgrade and rollback policy

Type: grilling
Status: resolved
Blocked by: 13

## Question

What npm release compatibility, pre-migration backup, forward-schema detection, projection rebuild, failed-upgrade recovery, downgrade refusal, and manual rollback workflow should protect application-owned SQLite and independently Pi-owned data across v2 upgrades?

## Answer

V1 adopts the smallest safe policy: **forward-only SQLite migrations, up to three verified pre-migration backups, fail-closed version checks, and one explicit CLI restore command**. There are no down migrations, automatic updater, automatic restore, read-only downgrade mode, rollback UI, delta backup, or Pi Agent Root backup.

### Release and schema gate

The published package uses an exact Pi dependency version and declares Node >=22.19.0. The CLI also checks Node at runtime because npm `engines` is advisory. npm semver describes the package/API release; it does not promise that installing an older package can read a newer application database.

`app.sqlite3` has a fixed nonzero `PRAGMA application_id`. `PRAGMA user_version` is the authoritative application schema number, while a small migration-history table stores each immutable migration number and build-time checksum. Every binary declares the schema range it understands and its target schema.

After acquiring the Application Data Root instance lock and before starting HTTP, Pi, watchers, or reconciliation, the CLI reads only this metadata:

- wrong `application_id`: refuse as `database_not_owned`;
- `user_version` above the binary maximum: refuse as `database_newer_than_binary`;
- missing/reordered migration history or checksum mismatch: refuse as `migration_history_invalid`;
- known older version with a complete migration chain: enter maintenance startup and upgrade.

A refused old binary does not open a UI, start a read-only server, mutate the database, or attempt an implicit downgrade. It prints the safe code, detected/maximum schema numbers, log location, and `backups restore` guidance.

### Pre-migration backup

Create a backup only when pending SQL migrations exist. With all application writers still stopped, use Node's `sqlite.backup()` Online Backup API to write a new temporary database; never copy a live `app.sqlite3` separately from its WAL.

A backup becomes usable only after an independent connection passes `PRAGMA integrity_check`, expected `application_id`, source `user_version`, and migration-history verification. Then compute SHA-256 and atomically publish:

```text
data/backups/<backup-id>/
  app.sqlite3
  manifest.json
```

The bounded manifest contains backup ID, creation time, exact app/Pi/Node versions, source schema, migration checksum digest, database byte size, and database SHA-256. It contains no path, Principal credential, prompt, Pi data, environment value, or log content. Files use the same private permissions as the application database.

If backup creation, validation, or free-space allocation fails, migration does not begin. Keep the three most recent completed pre-migration backups. Prune an older fourth backup only after the new migration and post-migration validation succeed; a failed upgrade may temporarily retain the new recovery backup rather than deleting safety evidence.

### Migration and projection behavior

Apply each immutable numbered SQL migration in its existing `BEGIN IMMEDIATE` transaction and update `user_version` only with that migration's commit. After all pending migrations, verify integrity, foreign keys, migration history, and required application read paths before readiness.

A migration failure rolls back its transaction and leaves Gateway unavailable. Earlier migrations from the same attempt may already be committed, so the CLI neither claims the original schema remains nor automatically overwrites it from backup. Restarting the same version may continue only when the stored history is an exact valid prefix; otherwise the user restores the pre-migration backup.

Projection parser/schema changes do not require another database backup: Pi JSONL remains authoritative and **Define Session projection and reconciliation** already requires a shadow generation, validation, and atomic generation flip. Failed projection rebuild keeps the Gateway unready without rolling back application-owned tables.

### Explicit rollback workflow

The same executable adds only two maintenance commands; `--data-dir` follows the normal directory precedence:

```text
no-pi-no-gang backups list [--data-dir <absolute-path>]
no-pi-no-gang backups restore <backup-id> --confirm [--data-dir <absolute-path>]
```

`list` reads and validates bounded manifests. `restore` refuses if another Gateway owns the data root, verifies the selected database checksum/integrity/application/schema, and creates one best-effort emergency snapshot of the current database when it is readable. It then closes SQLite, isolates current `app.sqlite3`/WAL/SHM files, copies the selected snapshot to a temporary file in the database directory, verifies it again, and atomically installs it.

After restore, the command prints the exact recorded package version to install/run. It never invokes npm, starts Gateway, edits logs/recycle files, or touches the Pi Agent Root. The next chosen binary still performs its normal ownership/schema gate. Manual filesystem copying of a live WAL database is unsupported.

### Pi-owned data boundary

Application upgrades never back up, rewrite, restore, or downgrade Pi `auth.json`, models/settings, or Session JSONL. Each application release pins one exact Pi version. Before publishing a release that changes Pi, acceptance must prove on isolated Session fixtures that the previous supported application/Pi combination can still open JSONL after the new Pi version writes it.

If that backward-read test fails, the Pi change is a **rollback barrier** and cannot ship as an ordinary v1 update. It requires a separately scoped migration/export and user-backup decision. Changing a JSONL version number, relying on Pi's forward migration, or copying the entire secret-bearing Pi Agent Root is not an acceptable implicit rollback strategy.

### Deliberately excluded from v1

Automatic updates/restores, down migrations, in-app backup browsing, scheduled backups, compression/encryption/cloud upload, per-table or delta backups, read-only compatibility servers, Pi Agent Root snapshots, and rollback across an unapproved Pi barrier are out of scope. The three backups protect schema-changing application upgrades only; users remain responsible for their independently owned Pi corpus.

Research asset: [SQLite, npm, and Pi upgrade/rollback facts](../research/upgrade-and-rollback-policy.md).
