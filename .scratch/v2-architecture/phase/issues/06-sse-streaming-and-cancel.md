# 06 — Gateway SSE Streaming 与 Cancel

**阶段：** Phase 0  
**父级场景：** AS-4、AS-5、AS-9  
**前置阻塞：** 05  
**状态：** 未满足

## 交付范围

通过一个 Gateway 级 SSE 输出 Run 在线增量，并支持取消当前 active Run；事件始终按稳定 Session/Run 身份归属。

## 验收标准

- [ ] 一个受鉴权的 Gateway SSE 端点使用 contracts 中的统一事件信封；Run 事件均携带正确的 `type`、`sessionId` 和 `runId`。
- [ ] Prompt 执行的增量内容实时发送，多个 Run/Session 的事件不会因当前页面或订阅视图而改变归属。
- [ ] Cancel mutation 携带客户端 `commandId`，等价重试返回原结果，不同 payload 复用被拒绝。
- [ ] Cancel 使当前 Run 收敛到 `cancelled`，释放 admission 槽位，随后可以创建新 Run。
- [ ] 自动化测试覆盖流结束、执行失败、Cancel 与自然完成竞态，并证明终态后晚到事件不能复活 Run。

## 不在本票

SSE replay、epoch、连续性判断、snapshot 合并、跨重启恢复、队列和 Steer。

## 当前实现证据

- 当前 `/sse` 只写入一个 `connected` 字符串后立即 `end()`，没有 contracts 事件信封、Run 增量或持久连接。
- `cancelRun()` 只记录日志，没有 Cancel Route、状态收敛、幂等或竞态测试；无验收项可勾选。
