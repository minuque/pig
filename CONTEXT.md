# no-pi-no-gang v2

一个以 Pi 为 Agent 底座的本地优先工作台。Agent Gateway 拥有执行与持久化协调，客户端只消费版本化契约。

## Language

**Agent Gateway**:
本地 Node 进程，拥有 Pi Runtime、Session 并发、应用持久化和客户端契约。
_Avoid_: Web BFF, AgentHost, Backend（泛指时）

**Workspace**:
用户显式授权给 Agent Gateway 的规范化目录根，拥有稳定标识；Session 必须归属一个 Workspace。
_Avoid_: cwd（当指产品概念时）, Project（未定义代码仓库语义时）

**Session**:
由 Pi 原生 Session ID 标识并持久化为 JSONL 的对话聚合；可以在不同客户端或 Gateway 生命周期之间恢复。
_Avoid_: Chat, Conversation, Thread

**Transcript**:
从 Pi Session JSONL 读取并向用户呈现的已持久化历史内容，包括用户 prompt、Agent 回复，以及按可见性规则展示的思考、工具活动和工具结果。它不是原始 JSONL、SQLite 中的消息副本或当前 Run 尚未持久化的实时增量；实时活动在 Pi 持久化后才成为会话记录的一部分。文档首次出现时使用“会话记录（Transcript）”，后续使用“会话记录”。
_Avoid_: Chat History, Message Store, Raw JSONL, 实时活动

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

**Unavailable Session**:
持久 Session 源无法被 Agent Gateway 安全恢复或修改的 Session；损坏、脏尾和身份冲突是原因而不是并列的用户状态。界面可以展示最后验证的信息，但必须拒绝新的 Run 和 Session mutation。
_Avoid_: Broken Session, Failed Session, Quarantined Session

**Local Identity**:
Agent Gateway 识别的稳定本地身份，可被授予 Workspace 访问权。Local Identity 跨 Gateway 重启保持不变，但浏览器、桌面端或 CLI 的临时访问凭证可以变化；多个本地客户端可以映射到同一个 Local Identity。它不是用户账号或模型 provider 身份。
_Avoid_: Principal, Client, User Account, Provider Account, Auth Flow, Cookie Session

**Workspace Access**:
Local Identity 对一个 canonical Workspace 根的显式资源访问授权；它控制 Gateway 中 Workspace、Session 和 Run 的可见性与操作权，可以被取消，但不限制 Pi 工具或子进程的操作系统文件权限。
_Avoid_: Workspace Grant, Permission, Owner, Sandbox, Filesystem Jail, cwd Allowlist

**Active Workspace**:
用户当前操作上下文所属的 Workspace；选择一个 Session 时，其所属 Workspace 随之成为 Active Workspace。导航中的展开状态不改变 Active Workspace。
_Avoid_: Current Project, Expanded Workspace, Selected Folder

**Expanded Workspace**:
导航树中已展开、可浏览其 Session 的 Workspace；可以同时存在多个，但不代表它们是 Active Workspace。
_Avoid_: Active Workspace, Open Project

**Target Workspace**:
欢迎页提交首个 prompt 时选定的 Workspace；新 Session 和首个 Run 在其中创建，创建成功后它才成为 Active Workspace。
_Avoid_: Active Workspace（提交前）, Default Project, cwd
