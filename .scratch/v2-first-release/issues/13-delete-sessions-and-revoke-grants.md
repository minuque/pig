# 13 — 安全删除 Session 和撤销 Grant

**What to build:** 用户可通过可恢复流程删除 Session，并撤销不再需要的 Workspace Grant；进行中的 Run 不会失去归属，撤销后相关 Gateway 资源立即不可访问。

**Blocked by:** 05 — 保证 Run 幂等与崩溃恢复；12 — 重命名和搜索 Session

**Status:** ready-for-agent

- [ ] Session 删除按 prepare、源文件操作、commit 与 recovery 协调，SQLite tombstone 与文件回收均可幂等重试。
- [ ] 任一删除阶段崩溃后，Gateway 重启可完成或安全报告恢复状态，不会把 Pi JSONL 复制进 SQLite。
- [ ] Workspace 存在 queued、starting 或 running Run 时拒绝撤销 Grant，并给出可操作问题。
- [ ] Grant 撤销成功后，相关 Session、Run 和 mutation 对该 Principal 不再可见或可操作。
- [ ] 删除及撤销竞态由真实文件、SQLite、进程重启和公开契约测试覆盖。
