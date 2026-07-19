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
