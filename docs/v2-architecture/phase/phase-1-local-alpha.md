# Phase 1：Local Alpha

Status: proposed

## Goal

在 Phase 0 闭环上补齐日常使用能力，使多个 Workspace 和 Session 可以被稳定管理和并行使用。

## Dependencies

- Phase 0 Exit Criteria 全部满足。

## In Scope

- 多 Workspace 注册、预览、确认和取消 Workspace Access。
- Session 分页、重命名和安全删除。
- 展示 Pi Runtime 实际可用的模型与 thinking level。
- Run admission 时冻结模型和 thinking level。
- 同一 Session 的 Run FIFO 串行。
- 不同 Session 的 Run 有界并行。
- 取消 queued 或 active Run。
- 向当前 running Run 发送 Steer。
- 客户端按 Session 隔离草稿和实时状态。
- 基础错误代码、关联信息和可操作提示。
- Phase 0 Repository 的 SQLite 实现保存 Local Identity、Workspace Access、必要元数据和可重建的 Session 列表索引。
- 在 Windows 上对 npm packed artifact 执行安装和启动 smoke test。

## UI Scope

本阶段是核心 UI/UX 的主要打磨阶段：

- 完成 Workspace、Session 和 Run 的工作台布局与导航。
- 明确 Prompt、回复、思考、工具活动和工具结果的信息层级。
- 展示 queued、running、cancelling 及各终态，并提供对应操作。
- 完成 Steer、Cancel、模型和 thinking level 选择交互。
- Session 切换时保留并隔离草稿、滚动位置和实时状态。
- 用户阅读历史时不强制滚动，并提供“跳转到最新”。
- 补齐确认对话框、内联错误和非阻塞通知。
- 形成一致的颜色、间距、字体、状态和控件规范。
- 核心工作台在桌面和窄屏下达到日常可用。

## Required Invariants

- 继承 Phase 0 的 Required Invariants。
- 每个 Session 同时最多一个 active Run。
- Steer 只作用于当前 running Run。
- SQLite 不得成为 Message Store。
- 已取消 Workspace Access 的资源不得继续被新请求访问。

## Deferred

- 跨 Gateway 重启的 durable mutation 幂等和资源 revision。
- durable Run ledger 与崩溃后 Interrupted 收敛。
- Unavailable Session 完整状态模型。
- 搜索索引和索引重建。
- 完整 SSE 断线恢复。
- migration backup、跨平台发布及完整可访问性门禁。

## Acceptance Scenarios

1. 用户可以注册并切换多个 Workspace，资源不会跨 Workspace Access 边界泄漏。
2. Session 可以分页、重命名和删除，重启后结果保持一致。
3. 同一 Session 的多个 Run 按 FIFO 执行，不同 Session 可在配置上限内并行。
4. queued Run 和 active Run 均可取消。
5. Steer 只发送给当前 running Run，不创建普通后续 Run。
6. 切换 Session 后，草稿、流式内容和运行状态不会混淆。
7. 模型与 thinking level 在 admission 后不会被后续界面选择改变。
8. Windows 可以从 npm packed artifact 安装并启动 Gateway 和构建后的 SPA。

## Exit Criteria

- 核心工作台可用于本地日常开发。
- 并发和取消场景具有确定性测试。
- SQLite 中不存在 Pi 会话记录副本。
- packed artifact smoke test 可重复执行，完整跨平台发布矩阵仍留给 Phase 3。
