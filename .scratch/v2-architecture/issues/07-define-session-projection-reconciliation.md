# Define Session projection and reconciliation

Type: grilling
Status: resolved
Blocked by:

## Question

What application-owned metadata, rebuildable Session projections, indexing cursors, idempotency keys, dirty detection, quarantine behavior, delete orchestration, and rebuild workflow should sit between Pi JSONL and SQLite?

## Answer

A single deep **Session Projection Coordinator** owns discovery, validation, incremental indexing, full rebuild, source health, and deletion recovery behind one seam. REST handlers, Run actors, file watchers, and startup code do not parse Pi JSONL or write projection tables directly. They submit durable-source changes or reconciliation hints; query modules read only the Coordinator-owned active projection generation.

Pi JSONL remains the sole Session truth. In particular, Session rename uses Pi's native `session_info` entry through `SessionManager.appendSessionInfo()`; SQLite does not own a competing title, archive, pin, transcript, model, compaction, or branch state.

### Durable SQLite ownership

SQLite owns only state that is native to the application or coordinates work around the source:

- Workspace registration and authorization facts, as finalized by the authorization decision;
- the durable Run ledger and `(principalId, commandId)` command ledger already defined by the Runtime and Gateway contracts;
- resource revisions and safe result references needed for optimistic concurrency and permanent command replay;
- projection schema/parser version, active generation, per-source indexing checkpoints, source-health diagnostics, and rebuild progress;
- delete-operation records and permanent deletion tombstones so a moved source is not rediscovered;
- rebuildable Session, entry, active-path, aggregate, and FTS rows.

Command idempotency is not reimplemented by the projector. Mutations use the global command ledger. Projection ingestion is independently idempotent by `(piSessionId, nativeEntryId)` plus a safe payload digest: the same identity and digest is a no-op; the same identity with different content is an integrity conflict and quarantines the Session.

### Discovery and Workspace association

Startup reconciliation and advisory filesystem notifications enumerate Pi Session files. An unknown valid Session is automatically discovered when its header `cwd`, after the canonicalization rules from **Define local authentication and Workspace authorization**, lies inside an authorized Workspace. The most-specific matching Workspace root wins. Sessions outside every authorized Workspace are ignored, not imported.

The header's Pi Session UUID is identity; the pathname is only a mutable source location. A rename with the same validated identity updates the source binding. Duplicate UUIDs, conflicting headers, or ambiguous canonical ownership are quarantined rather than merged. Unknown future entry types are not corruption: they become safe `unsupported` Transcript items and preserve cursor advancement.

### Rebuildable projection

The active projection generation contains:

- one Session summary/detail row with Workspace identity, validated source location, Pi format version, source health, created/updated times, native name or first-user-message fallback, current leaf, current model/thinking state, counts, token/cost aggregates, and public resource revision;
- one normalized row per Pi entry keyed by Session and native entry identity, including parent identity, source order/offset, timestamp, normalized public Transcript item, and a safe content digest;
- a materialized current active path derived from the latest valid leaf; abandoned branches remain internally sufficient to reconstruct that path but are not exposed in v1;
- FTS5 content for the native Session name and visible user/assistant text on the active path. Thinking, hidden/custom payloads, tool arguments/results, and unsupported raw data are excluded from first-release search;
- aggregate and pagination values required by bounded Session lists, Transcript pages, and Session snapshots.

Raw Pi objects and arbitrary extension payloads are never copied into public or search tables. Normalization passes through the project-owned contract schemas. A branch-changing append recomputes active-path membership and affected FTS rows transactionally; it does not mutate Pi history.

### Indexing cursor and durable boundary

Each source checkpoint records at least: Pi Session ID, validated source path and filesystem identity where available, header fingerprint/version, observed size and high-resolution modification time, next byte offset, next line number, last native entry ID, a bounded checkpoint-window digest, parser version, and projection generation.

Only a newline-terminated, successfully parsed and structurally validated JSONL record is a durable indexing boundary. Projection rows and the advanced checkpoint commit in the same SQLite transaction. An incomplete final record is never indexed and leaves the byte cursor at that record's start.

Filesystem watches are hints only. Startup and periodic reconciliation are authoritative:

1. unchanged identity, size, timestamp, and checkpoint require no work;
2. stable identity plus growth and a matching header/checkpoint window permits tail parsing;
3. truncation, replacement, same-size modification, changed header, or any ambiguous fingerprint forces a full rebuild of that Session;
4. a missing externally-managed source removes its projection only after a complete reconciliation pass; an application deletion is instead recognized by its durable delete record/tombstone.

This optimization assumes ordinary filesystem writes, not adversarial timestamp-preserving mutation. Any detected ambiguity chooses rebuild over attempting to splice rewritten history.

### Dirty and quarantine behavior

Source health is explicit and never inferred by clients from a missing row:

- `healthy`: the complete source validates and may accept Runs;
- `dirty_tail`: the final record is incomplete. The transcript remains readable through the last validated boundary, but new Runs and Session mutations fail with `session.unavailable`; reconciliation retries if the tail later completes;
- `quarantined`: invalid header, malformed interior record, duplicate/conflicting identity, broken parent graph, duplicate entry identity with changed content, or failed normalization invariant. Normal listing exposes a bounded unavailable summary; detail exposes only safe diagnostic codes. Run and rename admission are denied, while diagnosis and delete remain possible;
- `rebuilding` or `deleting`: transient coordinated states that deny Session commands.

The Gateway never skips a malformed interior line, silently truncates Pi JSONL, guesses a parent, or rewrites source history. Quarantine is logical isolation, not an automatic filesystem move. Raw lines, canonical paths, prompts, tool payloads, and stack traces stay out of errors and events; detailed local diagnostics are delegated to **Define diagnostics and operational visibility**.

### Delete orchestration

Delete is an explicit recoverable move, not UI-only hiding or immediate unlink:

1. validate authorization, `expectedRevision`, and the global `commandId`;
2. reject with a state conflict if any Run for the Session is nonterminal—the user must explicitly cancel first;
3. serialize through the Session actor, deny new admission, settle/dispose any resident Pi Runtime, and persist a `prepared` delete operation;
4. atomically rename the JSONL source to an application recycle location on the same filesystem, with a non-`.jsonl` name and a manifest containing only identity, original location, command ID, and deletion time;
5. transactionally mark the delete operation complete, retain the permanent tombstone/idempotency result, remove active projection/FTS rows, bump revisions, and emit `session.removed`.

A crash before the rename leaves the source discoverable and the operation retryable. A crash after the rename is completed from the manifest and prepared operation at startup. The exact recycle directory, retention policy, and cross-platform same-filesystem layout are finalized by **Define package and data layout**; no first-release restore interface is implied, but manual recovery remains possible.

### Full rebuild workflow

Projection migrations and parser-version changes do not destroy the last usable generation. Startup closes Session command admission and reports Gateway readiness as `rebuilding`, preserves all application-owned tables, builds a shadow projection generation from every eligible JSONL source, validates row counts, graph integrity, FTS integrity, and source checkpoints, then flips the active-generation pointer in one transaction. Only after the flip may commands and bootstrap Session data become available; the old generation is pruned afterward.

If rebuilding fails, the previous generation remains intact for diagnosis but is not served as current truth, and Gateway startup remains unavailable rather than mixing generations. A single dirty source is represented by its health state and does not abort an otherwise valid full generation. Explicit rebuild, startup reconciliation, post-durable-entry updates, and watcher-triggered reconciliation all exercise the same Coordinator interface and invariants.

Pi documentation support: `docs/session-format.md`, `docs/sessions.md`, and `docs/sdk.md` confirm native Session UUID/header/cwd, tree entries, `session_info`, `appendSessionInfo()`, listing/opening APIs, and JSONL deletion behavior.
