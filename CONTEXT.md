# no-pi-no-gang v2

一个以 Pi 为 Agent 底座的本地优先工作台。Agent Gateway 拥有执行与持久化协调，客户端只消费版本化契约。

## Language

**Agent Gateway**:
本地 Node 进程，拥有 Pi Runtime、Session 并发、实时事件、应用持久化和客户端契约。
_Avoid_: Web BFF, AgentHost, Backend（泛指时）

**Workspace**:
用户显式授权给 Agent Gateway 的规范化目录根，拥有稳定标识；Session 必须归属一个 Workspace。
_Avoid_: cwd（当指产品概念时）, Project（未定义代码仓库语义时）

**Session**:
由 Pi 原生 Session ID 标识并持久化为 JSONL 的对话聚合；可以在不同客户端或 Gateway 生命周期之间恢复。
_Avoid_: Chat, Conversation, Thread

**Run**:
一次被 Agent Gateway 接受的用户 prompt 执行，拥有独立标识与终态；同一 Session 的 Run 按 FIFO 串行，不同 Session 的 Run 可并行。
_Avoid_: Execution, Turn, Prompt（当指执行生命周期时）

**Interrupted Run**:
Agent Gateway 无法证明已正常完成或取消的终态 Run；它保留诊断与重试上下文，但绝不自动重放。
_Avoid_: Failed Run, Cancelled Run, Paused Run

**Steer**:
仅指向当前 running Run 的纠偏输入，不创建新 Run，也不充当普通 prompt 的忙时降级行为。
_Avoid_: Queued Prompt, Follow-up Run

**Execution Profile**:
Run 在 admission 时冻结的模型与 thinking level；后续界面选择或 Session 状态变化不能改变已排队 Run 的执行语义。
_Avoid_: Current Model, Runtime Settings

**Auth Flow**:
为 Pi 模型 provider 建立 credential 的短生命周期交互，可能包含浏览器 OAuth、device code、选择或敏感输入；它不同于访问 Agent Gateway 的用户认证。
_Avoid_: Login（未区分 provider 与 Gateway 时）, Credential

**Session Projection**:
从 Pi Session JSONL 重建的 SQLite 查询视图，用于列表、分组、搜索和统计，不是会话事实源。
_Avoid_: Session Database, Message Store

**Unavailable Session**:
持久 Session 源当前无法被 Agent Gateway 安全恢复或修改的 Session；界面可以展示最后验证的只读状态，但必须拒绝新的 Run 和 Session mutation。
_Avoid_: Broken Session, Failed Session

**Quarantined Session**:
因结构损坏、身份冲突或授权归属歧义而被逻辑隔离的 Unavailable Session；仅允许安全诊断与删除，不自动改写或跳过其持久历史。
_Avoid_: Deleted Session, Hidden Session

**Principal**:
通过 Agent Gateway 认证、可被授予 Workspace 访问权的稳定身份；Local Principal 跨 Gateway 重启保持身份，但浏览器 credential 不保持。
_Avoid_: Provider Account, Auth Flow, Cookie Session

**Workspace Grant**:
Principal 对一个 canonical Workspace 根的显式资源访问授权；它控制 Gateway 中的 Workspace、Session 和 Run 可见性与操作权，不限制 Pi 工具的操作系统文件权限。
_Avoid_: Sandbox, Filesystem Jail, cwd Allowlist

**Live Overlay**:
客户端从 Gateway 实时事件归约出的、尚未由 durable Session/Run/Transcript 状态取代的临时 Run 视图；按 Session 和 Run 隔离，可被 snapshot 整体替换，绝不是第二份持久事实。
_Avoid_: Live Session, Client Projection, Optimistic Transcript

**Application Data Root**:
no-pi-no-gang 独占的、按操作系统规范解析的数据层级；包含 SQLite、实例状态与应用日志，但不包含 Workspace 内容或 Pi Agent Root 中的认证、模型和 Session JSONL。
_Avoid_: Pi Home, Workspace Metadata Directory, Project Database

**Minimum Safe Diagnostic Surface**:
首版唯一承诺的运维可见性边界：类型化白名单日志、请求关联、最小 health probes、崩溃标记和可操作恢复状态；它不采集对话/工具内容，也不等同于完整 observability 平台。
_Avoid_: Debug Dump, Support Bundle, Telemetry Platform

**Upgrade Backup**:
仅在应用 SQLite schema 变更前，由 Online Backup API 生成并通过完整性、所有权、schema 与 checksum 校验的版本化快照；不包含 Pi Agent Root。
_Avoid_: Database Copy, Pi Backup, WAL Copy

**Rollback Barrier**:
新的 Pi 版本写入后，上一受支持版本无法可靠读取该 Session JSONL 的兼容边界；它禁止普通版本回滚，必须先另行决定迁移、导出与用户备份方案。
_Avoid_: Breaking Update, Schema Bump, Forced Downgrade
