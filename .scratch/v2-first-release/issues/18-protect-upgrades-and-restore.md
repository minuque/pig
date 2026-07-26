# 18 — 保护升级和显式恢复

**What to build:** Gateway 在修改数据库前验证所有权、schema 和迁移历史；存在 SQL migration 时先生成可信 Upgrade Backup。升级失败不会静默破坏数据，用户可列出并显式恢复已验证备份。

**Blocked by:** 03 — 创建和恢复 Session；17 — 提供安全诊断和可靠进程生命周期

**Status:** ready-for-agent

- [ ] foreign/newer/corrupt database、错误 application ID、断裂 migration history 或 checksum mismatch 均在 domain work 前 fail closed。
- [ ] immutable numbered migration 各自在独立 `BEGIN IMMEDIATE` 事务中运行，并在提交时更新 authoritative schema version。
- [ ] 仅有待执行 SQL migration 时使用 SQLite Online Backup API 创建备份，并验证 integrity、所有权、schema、history 与 SHA-256。
- [ ] 成功升级后最多保留三个正常 Upgrade Backup；失败升级可保留额外恢复证据且不自动 restore。
- [ ] 显式 restore 在独占 data root 后重新验证、隔离当前 database/WAL/SHM、原子安装并再次验证，且不修改 Pi Agent Root 或启动 Gateway。
