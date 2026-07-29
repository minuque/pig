# 06 — Security Invariants and Acceptance Verification

**What to build:** Safe rendering of Markdown/code/links, no sensitive data in logs, Gateway only loopback, Pi JSONL only fact source, all 10 Acceptance Scenarios pass.

**Blocked by:** 05 — Minimal UI Skeleton and Run State Management

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: prompt/tool/Transcript never logged; safe render for Markdown/代码/链接
- [ ] Acceptance criterion 2: all 10 spec scenarios verified (restart discovery, no implicit concurrency, no trusted HTML, pinned Pi version)