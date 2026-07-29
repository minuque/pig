# 04 — Run Lifecycle with SSE Streaming and CommandId Idempotency

**What to build:** Prompt creates independent `runId` Run (global admission slot 1); Gateway SSE shows real-time output with sessionId/runId envelope; Cancel active Run supported; commandId makes mutations idempotent (reject reuse, return equivalent retry result).

**Blocked by:** 03 — Single Workspace Authorization and Session CRUD

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: /runs creates Run with commandId; second prompt rejected when active Run exists
- [ ] Acceptance criterion 2: SSE events carry sessionId/runId; cancel releases slot and allows new Run
- [ ] Acceptance criterion 3: same commandId retry returns existing Run result; different payload rejected