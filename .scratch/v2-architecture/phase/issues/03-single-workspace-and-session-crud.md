# 03 — Single Workspace Authorization and Session CRUD

**What to build:** Canonical Workspace authorization UI and enforcement (directory preview + explicit confirmation); create/list/open Sessions within the Workspace; Workspace Access gate applied (post-bootstrap).

**Blocked by:** 02 — Pi Runtime Adapter and Session Discovery from JSONL

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: /workspaces POST creates canonical Workspace with path preview and confirmation
- [ ] Acceptance criterion 2: /sessions, /runs, /transcript require both Local Identity and matching Workspace Access
- [ ] Acceptance criterion 3: max 1 Workspace enforced as policy (not singleton model)