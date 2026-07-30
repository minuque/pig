# 05 — Run 生命周期、Admission 与幂等

**阶段：** Phase 0  
**父级场景：** AS-6、AS-8  
**前置阻塞：** 04  
**状态：** 已满足

## 交付范围

每个 prompt 创建独立 Run，遵循 `admission → running → terminal` 生命周期；Phase 0 通过策略将全局并发限制为 1，并对 Run 创建执行进程内幂等。

## 验收标准

- [x] 每次成功 admission 创建稳定且独立的 `runId`；Run 归属于明确的 `workspaceId` 和 `sessionId`。
- [x] Run Repository 保存正式的 admission、running、completed、failed、cancelled 状态；终态不可被晚到事件复活。
- [x] 全局槽位为 1 时，已有 active Run 的第二个 prompt 被明确拒绝且不调用 Pi；限制由调度策略表达。
- [x] Run 创建携带客户端 `commandId`；等价重试返回同一 Run，不同 payload 复用返回稳定冲突。
- [x] 只有 Pi settled 后 Run 才进入终态并释放槽位；终态后可以创建新 Run。

## 不在本票

SSE 输出、Cancel、队列、跨 Session 并行、Steer、Execution Profile 工作台、durable Run ledger、Interrupted Run。

## 实现证据

- `packages/contracts/src/index.ts`：Run 明确携带 `workspaceId`、`sessionId`、`commandId`，并定义 Run Repository、原子槽位获取/释放策略及 Pi settled 返回契约。
- `packages/gateway/src/index.ts`：Run Route 统一执行 admission → running → terminal；`InMemoryCommandExecutor` 处理等价重试/冲突，Repository 拒绝终态复活，全局策略在 Pi settled 后释放槽位；Adapter 不记录 prompt 内容。
- `packages/gateway/src/run-lifecycle.test.ts`：覆盖并发 admission 仅一次调用 Pi、稳定/独立 runId、幂等与冲突、running/failed/completed、终态保护和 settled 后槽位释放。
- 验证：`pnpm --filter @no-pi-no-gang/gateway test`（3 files、6 tests 通过）；`pnpm typecheck` 通过；`git diff --check` 通过。
