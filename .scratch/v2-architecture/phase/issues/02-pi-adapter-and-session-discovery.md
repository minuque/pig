# 02 — Pi Runtime Adapter and Session Discovery from JSONL

**What to build:** Pi Runtime Adapter routes calls to fixed Pi version; Gateway restart discovers Sessions from Pi JSONL; Session list and open operations work (scoped to authorized Workspace).

**Blocked by:** 01 — Credential Bootstrap and Loopback Gateway Startup

**Status:** ready-for-agent

- [ ] Acceptance criterion 1: discoverSessions() reads stable IDs from Pi JSONL (scoped to workspace)
- [ ] Acceptance criterion 2: /sessions endpoint returns list of discovered Sessions after restart
- [ ] Acceptance criterion 3: opened Session reloads persisted transcript from JSONL (no new IDs)