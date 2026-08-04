# 04 — Session 资源与 Transcript

**阶段：** Phase 0  
**父级场景：** AS-3、AS-4、AS-7  
**前置阻塞：** 02、03  
**状态：** 满足

## 交付范围

在已授权 Workspace 内创建、列出和打开 Pi Session，并从 Pi JSONL 读取 Transcript；Gateway 重启后仍能重新发现和打开已有 Session。

## 验收标准

- [x] `/api/v1` 提供 Session 创建、列表、打开和 Transcript 查询；所有操作同时验证 Local Identity 与匹配的 Workspace Access。
- [x] Session 创建使用客户端 `commandId`；等价重试不重复创建 Session，不同 payload 复用被拒绝。
- [x] 创建和重新打开使用稳定的 `workspaceId`/`sessionId`，客户端响应不暴露或保存 Pi 对象。
- [x] Transcript 每次从 Pi JSONL 事实源读取，不从应用数据库或瞬时 SSE 内容伪造 durable 会话记录。
- [x] 集成测试证明 Gateway 重启后已完成 Session 仍可列出、打开并读取相同 Transcript。

## 不在本票

Session 重命名、删除、分页、搜索、Unavailable Session、完整索引恢复。
