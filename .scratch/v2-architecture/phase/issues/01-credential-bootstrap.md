# 01 — Credential Bootstrap and Loopback Gateway Startup

**What to build:** Gateway starts on random loopback port; browser credential bootstrap succeeds and maps to fixed Local Identity; requests without credential are rejected.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: /credential endpoint accepts fragment and returns stable identity ID
- [ ] Acceptance criterion 2: requests to /health, /sse, /sessions, /workspaces without valid credential return 401 Unauthorized
- [ ] Acceptance criterion 3: bootstrap is short-lived and single-use (process-scoped)