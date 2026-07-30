# 06 — Gateway SSE Streaming 与 Cancel

**阶段：** Phase 0  
**父级场景：** AS-4、AS-5、AS-9  
**前置阻塞：** 05  
**状态：** 已满足

## 交付范围

通过一个 Gateway 级 SSE 输出 Run 在线增量，并支持取消当前 active Run；事件始终按稳定 Session/Run 身份归属。

## 验收标准

- [x] 一个受鉴权的 Gateway SSE 端点使用 contracts 中的统一事件信封；Run 事件均携带正确的 `type`、`sessionId` 和 `runId`。
- [x] Prompt 执行的增量内容实时发送，多个 Run/Session 的事件不会因当前页面或订阅视图而改变归属。
- [x] Cancel mutation 携带客户端 `commandId`，等价重试返回原结果，不同 payload 复用被拒绝。
- [x] Cancel 使当前 Run 收敛到 `cancelled`，释放 admission 槽位，随后可以创建新 Run。
- [x] 自动化测试覆盖流结束、执行失败、Cancel 与自然完成竞态，并证明终态后晚到事件不能复活 Run。

## 不在本票

SSE replay、epoch、连续性判断、snapshot 合并、跨重启恢复、队列和 Steer。

## 实现证据

- `packages/contracts/src/index.ts`：`PiRuntimeAdapter.createRun()` 通过 `PiRunEvent` 回调暴露在线增量，Gateway 继续使用共享 `SSEEventEnvelope`。
- `packages/gateway/src/index.ts`：提供受 Bearer 鉴权的单一 `GET /api/v1/events` 长连接；按 Workspace Access 广播带稳定 `sessionId`/`runId` 的 Pi 增量和 Run 终态，并在连接关闭或 Gateway stop 时清理客户端。`POST .../runs/:runId/cancel` 复用 Command Executor，实现幂等/冲突、终态竞态保护、槽位释放及晚到增量丢弃。
- `packages/gateway/src/streaming-cancel.test.ts`：覆盖 SSE 鉴权、跨 Session 稳定事件归属、流完成、执行失败、Cancel 幂等/冲突、Cancel 后新 Run、Cancel/自然完成竞态、单一终态事件和晚到增量/settled 不复活。
- 验证：`pnpm --filter @no-pi-no-gang/gateway test`（4 files、9 tests passed）；`pnpm typecheck`（4 workspace packages passed）；`git diff --check` 通过。
