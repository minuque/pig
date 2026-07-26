# 03 — 创建和恢复 Session

**What to build:** 用户可在获授权 Workspace 中创建 Pi 原生 Session、分页查看 Session 列表，并在浏览器或 Gateway 重启后重新打开 Session。Pi JSONL 保持事实源，SQLite 仅提供可重建 Session Projection。

**Blocked by:** 02 — 注册并授权 Workspace

**Status:** ready-for-agent

- [ ] 用户可创建由 Pi 原生 Session ID 标识并写入 Pi Agent Root 的 Session。
- [ ] Session 列表使用有界不透明游标分页，且只返回当前 Workspace Grant 可见的 Session。
- [ ] Gateway 重启后可从 Pi JSONL 恢复 Session，并重建缺失的 Session Projection。
- [ ] 应用 SQLite 不保存完整 Transcript、Pi credential、模型设置或 Pi Agent Root 内容。
- [ ] 真实 SQLite、临时 Application Data Root/Pi Agent Root 和真实 loopback 契约测试覆盖创建与重开旅程。
