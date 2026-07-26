# 15 — 并行操作多 Session

**What to build:** 用户可在 Workbench Shell 中切换 Workspace 和 Session，同时保留每个 Session 的实时活动、滚动位置和 composer draft；durable facts 与 Live Overlay 各有唯一所有者，不会相互覆盖或形成第二份事实源。

**Blocked by:** 06 — 调度多 Session Run；08 — 恢复断线的实时状态；09 — 安全渲染 Transcript；10 — 选择并冻结 Execution Profile

**Status:** ready-for-agent

- [ ] Router 独占选中的 Workspace/Session ID，Query 独占可由 REST 重取的 durable facts。
- [ ] 一个按 Session/Run 分区的 Live Overlay 保存实时状态，并只由唯一 Sync Controller 消费 SSE。
- [ ] composer draft 按 Session ID 保存在内存中，切换 Session 不丢失也不串写草稿。
- [ ] 多 Session 同时 queued/running/streaming 时，各自 Transcript、Run 状态与滚动行为保持隔离。
- [ ] Mutation Result 不伪造 durable domain change；只有 REST 资源或验证后的 snapshot 可替换相应事实。
