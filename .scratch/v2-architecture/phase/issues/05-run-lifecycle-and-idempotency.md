# 05 — Run 生命周期、Admission 与幂等

**阶段：** Phase 0  
**父级场景：** AS-6、AS-8  
**前置阻塞：** 04  
**状态：** 未满足

## 交付范围

每个 prompt 创建独立 Run，遵循 `admission → running → terminal` 生命周期；Phase 0 通过策略将全局并发限制为 1，并对 Run 创建执行进程内幂等。

## 验收标准

- [ ] 每次成功 admission 创建稳定且独立的 `runId`；Run 归属于明确的 `workspaceId` 和 `sessionId`。
- [ ] Run Repository 保存正式的 admission、running、completed、failed、cancelled 状态；终态不可被晚到事件复活。
- [ ] 全局槽位为 1 时，已有 active Run 的第二个 prompt 被明确拒绝且不调用 Pi；限制由调度策略表达。
- [ ] Run 创建携带客户端 `commandId`；等价重试返回同一 Run，不同 payload 复用返回稳定冲突。
- [ ] 只有 Pi settled 后 Run 才进入终态并释放槽位；终态后可以创建新 Run。

## 不在本票

SSE 输出、Cancel、队列、跨 Session 并行、Steer、Execution Profile 工作台、durable Run ledger、Interrupted Run。

## 当前实现证据

- contracts 中已有 Run 形状，Adapter 中已有 `createRun()`/`cancelRun()` 存根。
- 缺失 Run Route、Repository、状态机、admission 槽位、Pi settled 判定和 `commandId` 去重/冲突处理；无验收项可勾选。
- 当前 Adapter 会把 prompt 片段写入日志，必须在本票实现前移除。
