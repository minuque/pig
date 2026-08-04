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
