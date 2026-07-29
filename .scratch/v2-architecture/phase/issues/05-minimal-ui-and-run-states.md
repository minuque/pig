# 05 — Minimal UI Skeleton and Run State Management

**What to build:** Production Vue flow consumes contracts/SSE; formal Workspace/Session/Run state keyed by stable IDs; disabled-send while Run slot occupied; narrow/wide layouts + accessibility (no prototype Steer/queue).

**Blocked by:** 04 — Run Lifecycle with SSE Streaming and CommandId Idempotency

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: UI state updates from /sessions + SSE; send disabled during active Run
- [ ] Acceptance criterion 2: Transcript reloads from Session read API after completion; no deferred behaviors
- [ ] Acceptance criterion 3: keyboard focus, accessible names, non-token-by-token announcements