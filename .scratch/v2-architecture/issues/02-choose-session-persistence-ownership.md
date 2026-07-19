# Choose Session persistence ownership

Type: research
Status: resolved
Blocked by:

## Question

Which store should own durable Session truth, application metadata, searchable projections, and live execution events when Pi is the Agent foundation?

## Answer

Pi's native JSONL Session tree is the sole source of truth for messages, tool results, model changes, compaction, branch structure, and extension entries. Application SQLite owns only v2-native metadata and rebuildable Session/search projections. Runtime deltas use an in-memory event bus and bounded replay buffer; they are not a second durable event log.

Projection writes occur after Pi reaches a durable entry boundary, are idempotent by native Session/entry identity, and can be dropped and rebuilt. Remote compatibility later uses native JSONL mirroring and a single-writer lease rather than replacing Pi persistence.

Research asset: [AI coding agent Session persistence best practices](../research/session-persistence.md).
