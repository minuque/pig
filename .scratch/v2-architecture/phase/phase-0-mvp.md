# Phase 0：MVP

Status: proposed

## Goal

完成 `Workspace → Session → Prompt → Streaming` 的最小端到端闭环，证明 Vue、Gateway 和固定版本 Pi Runtime 可以协同工作。

## In Scope

- Windows 本地开发启动 Gateway 和 SPA。
- Gateway 绑定随机 `127.0.0.1` 端口。
- 浏览器通过最小的进程级凭证访问 Gateway，并映射到固定的 Local Identity。
- 用户通过本机 Gateway 触发 Windows 原生文件夹选择器，预览并显式确认一个 canonical Workspace，形成 Workspace Access；这不是浏览器 File System Access API。
- 创建、列出和打开该 Workspace 中的 Pi Session。
- 每个 prompt 创建具有独立 `runId` 的 Run；全局同时最多运行一个 Run。
- mutation 携带客户端生成的 `commandId`，Gateway 至少在当前进程内拒绝不同 payload 复用并返回等价重试的原结果。
- 发送 prompt，并通过一个 Gateway SSE 实时显示输出。
- 取消当前 active Run。
- Gateway 重启后从 Pi JSONL 重新发现 Session。
- 安全渲染 Markdown、代码和链接。

## Foundation Constraints

本阶段允许实现较薄，但不得使用需要在后续阶段推翻的临时边界：

- `web`、`gateway`、`contracts` 和 `testkit` 保持独立；`contracts` 不依赖 Vue、DOM、Node 或 Pi SDK。
- Workspace、Session、Run 和 Local Identity 从第一天使用稳定标识；单 Workspace 只是产品限制，不是全局单例数据模型。
- Run 保持 `admission → running → terminal` 生命周期；全局并发数 1 只是调度策略。
- Gateway 通过集中 Pi Runtime Adapter 调用 Pi，Route 和客户端不得直接操作 Pi SDK。
- 业务逻辑依赖 Workspace Repository、Run Repository 和 Session Index 边界；Phase 0 实现可以最小化，Phase 2 再增强 durability。
- 客户端凭证适配与 Local Identity 授权分离，核心授权不得依赖 Cookie 等单一传输方式。
- SSE 使用可扩展的统一事件信封，至少包含 `type` 及相关的 `sessionId`、`runId`；不得发送仅服务当前页面的私有事件结构。
- UI 使用正式的 Workspace、Session 和 Run 状态，不创建只适用于单页面演示的替代状态模型。
- 文件路径和 Application Data Root 通过平台边界处理，不把 Windows 路径规则散落到业务逻辑。

## UI Scope

遵循 [`ui-guidelines.md`](ui-guidelines.md)，本阶段只确定可延续的信息架构和最小界面骨架：

- Workspace 授权界面。
- Session 列表、创建入口和当前 Session 页面。
- 会话记录（Transcript）、Prompt 输入、发送和 Cancel。
- Run 的基础 running/completed/failed/cancelled 状态。
- Loading、Empty 和 Error 基础反馈。
- 最小宽屏与窄屏布局，不要求视觉精修。
- 建立基础颜色、间距、字体和焦点变量，不建设完整组件库。

## Required Invariants

- Pi JSONL 是 Session 和会话记录的唯一事实源。
- 客户端不得导入、保存或直接操作 Pi 对象。
- Gateway 是 Pi Runtime 生命周期的唯一协调者。
- Gateway 不监听非 loopback 地址。
- credential、完整 prompt、会话记录和工具 payload 不得写入应用日志。
- Workspace Access 不得描述为操作系统 sandbox。
- 发布使用固定 Pi 版本。

## Deferred

推迟到 Phase 1：

- 多 Workspace 管理。
- Session 重命名、删除和分页。
- 多 Run 队列、跨 Session 并行和 Steer。
- 模型及 thinking level 工作台。
- 完整客户端草稿和实时状态隔离。

推迟到 Phase 2：

- 跨 Gateway 重启的 durable mutation 幂等、revision 和 durable Run ledger。
- Session 搜索、搜索索引和索引重建。
- Interrupted Run、Unavailable Session 和完整重启恢复。
- SSE epoch、连续性判断和 snapshot 合并。
- SQLite migration backup、实例锁和完整 shutdown 状态机。

推迟到 Phase 3：

- Windows/Linux 完整 packed artifact 验证和发布门禁。

## Acceptance Scenarios

1. Windows 开发环境可以启动 Gateway 和 SPA，Gateway 仅监听随机 loopback 端口。
2. 未完成浏览器凭证建立的请求无法访问 API；建立成功后凭证映射到 Local Identity。
3. 用户从 Gateway 打开的 Windows 原生文件夹选择器选择目录（取消后可重试），确认 canonical Workspace 并形成 Workspace Access 后，可以创建并重新打开 Pi Session。
4. 用户发送 prompt 后，可以看到流式内容，并在结束后重新读取已持久化的会话记录。
5. 用户可以取消当前 Run；取消后可以发起新 Run。
6. active Run 存在时，第二个 prompt 被明确拒绝或禁用，不产生隐式并发。
7. Gateway 重启后，已完成的 Session 仍可被发现和打开。
8. 等价 `commandId` 重试在当前 Gateway 进程内不产生重复 Run；不同 payload 复用同一 `commandId` 被拒绝。
9. SSE Run 事件携带对应的 `sessionId` 和 `runId`，切换页面不改变事件归属。
10. 模型生成的 HTML 不会作为受信任 HTML 执行。

## Exit Criteria

- 所有 Acceptance Scenarios 通过自动化测试或有记录的可重复验证。
- 已形成明确的 `web`、`gateway`、`contracts` 边界，以及 Pi Adapter 和 Repository 边界。
- 单 Workspace、单 active Run 限制由配置或策略表达，而不是全局单例契约。
- 不依赖 Phase 1 及以后能力即可完成核心旅程。
