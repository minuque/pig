# Phase 2：Public Beta

Status: proposed

## Goal

补齐重试、断线、进程崩溃和数据异常下的一致性，使系统具备公开 Beta 所需的恢复能力。

## Dependencies

- Phase 1 Exit Criteria 全部满足。

## In Scope

- 将 Phase 0 的进程内 `commandId` 幂等升级为跨 Gateway 重启的 durable 幂等。
- 可变 durable resource revision。
- durable Run ledger 和终态持久化。
- Gateway 重启后将遗留非终态 Run 收敛为 Interrupted。
- Interrupted Run 不自动重放；显式重试创建新 Run。
- Available/Unavailable Session 状态及不可用原因。
- Gateway epoch、断线连续性判断和有界 Session snapshot。
- snapshot 替换临时实时状态，并保护更新的 durable revision。
- Session 可见文本搜索和索引重建。
- 每个 Application Data Root 的单实例锁。
- 有界 shutdown 顺序。
- SQLite 前向 migration 和已验证的 Upgrade Backup。
- 敏感数据 canary 测试。

## UI Scope

本阶段重点打磨异常、恢复和一致性状态：

- 展示 reconnecting/offline，并说明是否需要用户操作。
- Interrupted Run 提供明确说明和显式重试入口。
- Unavailable Session 显示可用的最后验证信息、原因和操作限制。
- Workspace Access 失效后退出受保护视图，避免继续展示过期实时状态。
- snapshot 恢复不得造成 durable 内容倒退或明显界面闪烁。
- migration、实例冲突、启动失败和 shutdown 状态提供可操作提示。
- 稳定错误代码和关联信息可被复制用于诊断，且不包含敏感数据。

## Required Invariants

- 继承此前阶段全部 Required Invariants。
- 等价 `commandId` 重试返回原结果，不同 payload 复用同一 `commandId` 必须拒绝。
- Run 仅在 Pi settled 且终态 durable 后完成。
- 晚到事件不得复活终态 Run。
- Unavailable Session 拒绝新 Run 和修改操作。
- 断线恢复依赖 snapshot，不承诺 SSE replay。
- migration 或 backup 验证失败时停止启动。

## Deferred

- Windows/Linux 完整 packed artifact 发布矩阵。
- 完整无障碍、主题、窄屏和发布测试矩阵。
- Provider Auth Flow 仍为可选附加能力。

## Acceptance Scenarios

1. Gateway 重启前后的等价 `commandId` 重试都不会创建重复资源或执行重复 Run。
2. Gateway 崩溃后，非终态 Run 变为 Interrupted 且不自动重放。
3. SSE 断线或 Gateway epoch 改变后，客户端通过 snapshot 恢复一致状态。
4. 无法安全读取的 Session 显示为 Unavailable，并拒绝修改。
5. 搜索结果只包含当前用户有权查看的可见文本。
6. 同一 data root 无法同时启动两个 Gateway owner。
7. migration 前存在已验证 Backup；迁移失败不会继续写入。
8. 数据库、日志和 health 输出不包含敏感 canary。

## Exit Criteria

- 故障注入覆盖重试、断线、崩溃、损坏 Session 和 migration 失败。
- 恢复场景不会重复执行 Agent，也不会丢失已确认的 durable 终态。
- 达到公开 Beta 的数据安全和一致性要求。
