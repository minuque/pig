# no-pi-no-gang v2 目标架构

Status: target-architecture

本文件是 v2 目标架构的唯一规范入口，用于生成和评审实现 Issues。目标架构通过 [`phase/`](phase/) 中的 Phase 0 至 Phase 3 增量实施；阶段文档规定当期范围，但不得改变本文件的数据所有权、组件边界和安全底线。Issue 记录实现切片与当前状态；研究材料和旧规格仅提供历史证据。现有架构图是非规范历史视图，不得覆盖本文件中的决策。

## 1. Problem and Release Boundary

Pi 已提供 coding-agent Runtime 与原生 Session 持久化，但缺少一个适合同时管理多个 Session 的本地图形工作台。客户端不应直接承担 Pi Runtime 生命周期、并发、恢复、安全授权或持久化协调，应用也不能复制 Pi Session 内容形成第二份事实源。

v2 目标交付一个通过 npm 安装的本地单用户公开 Beta：Vue 客户端通过版本化 REST 与 Gateway 级 SSE 连接一个本地 Node Agent Gateway，Gateway 嵌入项目固定的 Pi 版本。

发布范围：

- 支持 Windows 和 Linux；macOS 不作 v2 发布承诺。
- Gateway 只监听随机 loopback 端口，不提供远程访问或任意 host 绑定。
- 支持多个 Workspace、多个可恢复 Session，以及不同 Session 的有界并行 Run。
- 默认复用 Pi Agent Root 中已有的模型和认证配置。
- 已有 Provider Auth Flow 可以保留为 Beta 附加能力，但不是核心旅程或发布门禁。
- v2 发布包固定 Pi 版本，只支持应用 SQLite 的前向迁移，不承诺二进制降级或跨 Pi 版本回滚。

## 2. Release Capabilities

### 2.1 Secure local launch

- 用户可以从打包后的 npm artifact 启动 Gateway 和构建后的 SPA。
- CLI 使用随机 loopback 端口，并通过短生命周期、单次使用的 fragment bootstrap 建立浏览器访问凭证。
- 浏览器 bootstrap、Cookie 和 CSRF 等凭证机制必须映射为 Local Identity；核心授权逻辑不得直接依赖某一种客户端凭证传输方式。
- Gateway 校验本地 authority、请求来源、客户端凭证和 Workspace Access。
- 每个 Application Data Root 同时最多由一个 Gateway 进程拥有；不同 data root 可以并行运行。

### 2.2 Workspace authorization

- Workspace 是用户显式授权的 canonical 目录根，注册必须经过规范化路径预览和确认。
- Session、Run 和查询只能通过有效 Workspace Access 访问。
- 取消 Workspace Access 时不得让仍在执行的 Run 失去归属。
- 产品必须明确说明 Workspace Access 不是操作系统沙箱，不限制 Pi 工具或子进程的文件权限。

### 2.3 Durable Session workbench

- 用户可以发现、创建、恢复、分页、重命名、搜索和删除已授权 Workspace 中的 Pi Session。
- 用户可以安全查看会话记录（Transcript），包括 Markdown、代码、思考和工具活动，并浏览较早历史。
- Session 对用户只呈现 Available 或 Unavailable 两类语义；具体损坏、脏尾或身份冲突是不可用原因。
- Unavailable Session 可以显示最后验证的信息，但拒绝新 Run 和会改变 Session 的操作。
- 删除必须在中断或重启后得到一致结果，不能把 Pi JSONL 复制进应用数据库。

### 2.4 Parallel Runs

- 每个普通 prompt 创建独立 Run，并在 admission 时冻结模型与 thinking level。
- 同一 Session 的 Run 按 FIFO 串行；不同 Session 的 Run 在有界并发下执行。
- 用户可以向当前 running Run 发送 Steer，也可以取消 queued 或 active Run。
- Run 只有在 Pi 已 settled 且终态已持久化后才完成。
- 无法证明正常完成或取消的 Run 成为 Interrupted Run；系统绝不自动重放，显式重试必须创建新 Run。
- 客户端按 Session 保留草稿和实时活动，切换 Session 不得混淆状态。

### 2.5 Models and credentials

- 工作台展示固定 Pi Runtime 实际可用的模型和 thinking level。
- 缺少认证时，核心路径提示用户先通过 Pi 完成配置。
- 如保留内置 Provider Auth Flow，敏感输入必须短暂、write-only，不能进入持久状态、客户端缓存、日志或 API 响应。

### 2.6 Realtime synchronization and recovery

- REST 提供 durable resources、commands 和有界 Session snapshot；一个 Gateway 级 SSE 提供所有 Session 的在线增量。
- SSE 断线、Gateway epoch 变化或客户端无法证明连续性时，客户端重新获取 snapshot；v2 不承诺补发断线期间的每个增量事件。
- Snapshot 可以整体替换客户端临时实时状态，durable Session 内容不得依赖瞬时事件恢复。
- Gateway 重启后恢复 Session，并把遗留的非终态 Run 收敛为 Interrupted Run。

### 2.7 Safe operation

- 用户可以区分进程存活与服务就绪，并从错误中获得稳定关联信息和可操作提示。
- 诊断输出不得持久化 prompt、会话记录、工具 payload、credential、Cookie、token、环境值或原始路径。
- SQLite schema 只前向迁移；存在 migration 时先创建并验证 Upgrade Backup，失败必须停止启动而不是继续写入。
- Gateway 有界关闭：停止准入，收敛 Run，关闭实时连接、Pi Runtime 和 SQLite，最后释放实例锁。

### 2.8 Usable client

- 核心旅程支持键盘操作、可见焦点、合理语义名称和不过度播报 token 的实时状态。
- 界面支持窄屏、浅色、深色和系统主题。
- 流式内容在原位置更新；用户阅读历史时不被强制滚动，并可主动跳转到最新内容。
- Markdown、代码和链接必须安全渲染；不信任 Pi 或模型生成的 HTML。

## 3. Architecture

```text
Vue SPA
  └─ versioned REST + one Gateway SSE
       └─ Node Agent Gateway
            ├─ Access and Workspace authorization
            ├─ Session indexing and recovery
            ├─ Run coordination
            ├─ Application SQLite
            └─ pinned Pi SDK → Pi Agent Root / Workspace
```

代码保持 coarse-grained `web`、`gateway`、`contracts` 和 `testkit` workspace。`web` 与 `gateway` 只能通过 browser-safe `contracts` 相交；生产代码不得依赖 `testkit`，客户端不得导入或感知 Pi 对象。

公共 API 位于 `/api/v1`。REST 负责查询与 mutation，Gateway 级 SSE 只负责在线实时通知。契约必须为资源、命令、事件和错误提供稳定、可验证的 schema；可变资源携带 revision，错误使用稳定问题代码。

Gateway 是以下职责的唯一协调者：访问控制、Workspace 归属、Run admission、每 Session 串行、跨 Session 并发、Pi Runtime 生命周期、终态持久化、Session 查询索引、恢复和关闭。

数据所有权：

- Pi Session JSONL：Session、会话记录、工具结果、模型变化、压缩及 Pi 扩展内容的唯一事实源。
- Application SQLite：Local Identity、Workspace Access、Run 账本、命令幂等、资源 revision，以及可从 Pi JSONL 重建的列表和搜索索引。
- 客户端内存：尚未被 durable 状态取代的流式增量、草稿、展开状态和敏感表单输入。
- Application Data Root、Pi Agent Root 与 Workspace 内容彼此独立；应用不得备份、恢复或改写整个 Pi Agent Root。

Session 查询索引必须可由已授权的 Pi JSONL 重建，但本规格不规定 cursor、parser、generation 或切换算法。搜索只可暴露用户有权查看的可见文本，不索引 credential、思考或工具参数。

## 4. Invariants

1. Gateway 只绑定随机 `127.0.0.1` 端口。
2. 每个 Application Data Root 同时只有一个 Gateway owner。
3. Workspace 必须显式授权，且 Workspace Access 不得被描述为 sandbox。
4. Pi JSONL 是 Session 与会话记录的唯一事实源；SQLite 不是 Message Store。
5. 应用数据库和日志不得保存 credential、完整 prompt、会话记录或工具 payload。
6. 每个 Session 同时最多一个 active Run；同 Session FIFO，不同 Session 有界并行。
7. Execution Profile 在 Run admission 时冻结。
8. 每个 mutation 都有客户端生成的 `commandId`；等价重试返回原结果，不同 payload 复用同一 `commandId` 必须拒绝。
9. Steer 只作用于当前 running Run，不创建普通后续 Run。
10. Run 终态要求 Pi settled 且 durable；晚到事件不能复活终态 Run。
11. Interrupted Run 永不自动重放；重试创建新的 Run 身份。
12. Unavailable Session 拒绝新 Run 和 Session mutation。
13. 断线后的正确性来自重新获取 snapshot，而不是依赖 SSE replay。
14. Snapshot 可以替换临时实时状态，但不能覆盖更新的 durable revision。
15. 浏览器 credential 只在当前 Gateway 进程有效；Provider credential 不得进入浏览器持久状态。
16. 发布包固定 Pi 版本；v2 普通更新不改变该版本。
17. shutdown 必须先停止准入，最后释放实例锁。

## 5. Release Scenarios

v2 发布候选至少证明以下公开行为：

1. 同一 packed artifact 可在受支持 Node 版本的 Windows 和 Linux 上安装、启动并提供 SPA。
2. Gateway 只监听随机 loopback；bootstrap 单次、限时且不进入请求日志或浏览器历史。
3. Workspace preview/confirm 使用 canonical 路径，未授权或被撤销的 Workspace 资源不可访问。
4. Pi Session 可创建、重开、分页、搜索和安全删除，Gateway 重启后结果保持一致。
5. 同 Session Run 保持 FIFO，不同 Session 可并行；Steer、cancel 和队列容量行为明确。
6. 重复 mutation 不产生重复资源或重复 Agent 执行。
7. SSE 断线或 Gateway 重启后，客户端通过 snapshot 恢复一致状态。
8. 进程崩溃后的非终态 Run 变为 Interrupted Run，且不会自动重放。
9. 无法安全读取的 Session 显示为 Unavailable，并拒绝进一步修改。
10. SQLite migration 失败不会继续启动；迁移前存在已验证的 Upgrade Backup。
11. 使用敏感 canary 执行失败、认证和工具场景后，数据库、日志和 health 输出不包含禁止内容。
12. 核心 Workspace、Session 和 Run 旅程可通过键盘完成，并在窄屏与浅/深主题下可用。

## 6. Out of Scope

- Session fork、树导航、import、附件、多模态输入、Skills 管理、文件浏览器、PTY 和终端模拟。
- 桌面应用、远程 Gateway、多用户、tenant、relay、cloud control plane 和任意网络 host 绑定。
- 多 Agent provider 或 provider-neutral durable Session；Pi 是唯一 Agent 基础。
- 操作系统级文件或进程 sandbox。
- 永久 token-delta event store、SSE replay 保证、客户端事件 acknowledgement 和工具步骤重放。
- Interrupted Run 自动 replay。
- 跨 Pi 版本升级、普通二进制降级、down migration、自动 restore 和 Pi Agent Root snapshot。
- 会话记录虚拟化、raw HTML、专用文件 diff/图片展示和未验证的性能优化。
- 完整 observability 平台、support bundle、遥测导出、分布式追踪和浏览器 telemetry。
- macOS 发布保证、三平台完整测试矩阵、pixel-perfect screenshot 门禁和 credential-backed Provider 调用作为确定性 CI blocker。
