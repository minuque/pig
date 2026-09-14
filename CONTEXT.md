# Pig

Pig 是用户操作和观察 Pi Agent 的 GUI。Pi 拥有 Agent 行为和 Session 历史；pig 拥有它们的呈现和控制方式。

## 领域语言

**pig**：
遵循 Pi 设计哲学的 Pi Agent GUI。
_避免使用_：Agent Runtime、Platform、Framework

**Pi**：
拥有 Session 生命周期、Session 历史和 Agent Runtime 的系统。

**Agent**：
为 Session 执行工作的 Pi Agent Runtime。它是执行角色，不是具有独立身份或跨 Session 状态的持久实体。
_避免使用_：Assistant Message、助手、Agent 档案

**Session（会话）**：
由 Pi 拥有、记录 Agent 交互的持久对象，为一个 Working Directory 创建。关闭并重新打开 Pig Workbench 不会创建新 Session。
_避免使用_：聊天、对话、运行

**Session Name（会话名称）**：
Session 的可选、可编辑显示标签。它不是 Session 的身份标识。
_避免使用_：Session ID、标题 ID

**Delete Session（删除会话）**：
永久删除 Pi Session 及其 Transcript。
_避免使用_：关闭、隐藏、Abort

**Working Directory（工作目录）**：
限定 Session 工作范围的本地目录。一个 Working Directory 可以包含多个 Session，这些 Session 不共享状态。
_避免使用_：工作区、Workspace

**Prompt（提示）**：
用户提交的、用于开始一个 Turn 的动作与正文。它不是 Transcript 条目本身。
_避免使用_：User Message、查询

**Turn（轮次）**：
Agent 从接受 Prompt 到 Session 恢复空闲期间的一段工作。
_避免使用_：运行、请求

**Idle（空闲）**：
Session 没有正在进行的 Turn、Retry 或 Compaction。
_避免使用_：停止、完成、Abort

**Running（进行中）**：
Session 未空闲，或一段 Turn / 一次 Tool Call 已开始且尚未结束。不是 Assistant Message 或 Thinking 的进行态。
_避免使用_：live、streaming、运行

**Retry（重试）**：
Pi 在遇到可恢复问题后自动重复 Agent 工作的 Session 阶段。
_避免使用_：新 Turn、手动重试

**Compaction（压缩）**：
Pi 缩减其保留上下文，使 Agent 可以继续工作的 Session 阶段。
_避免使用_：删除 Transcript、摘要请求

**Steering（引导）**：
在活动 Turn 中提交，并在 Agent 可以处理时生效的指令。待处理的 Steering 仍属于同一个 Turn。
_避免使用_：后续 Prompt、排队消息

**Abort（中止）**：
用户提前结束活动 Turn；Session 与已写入的 Transcript 保留。被中止的条目不是 Error。
_避免使用_：取消 Session、删除、Error、停止

**Error（出错）**：
Turn、Assistant Message 或 Tool Call 因失败而结束，不是 Abort。
_避免使用_：Abort、中止、异常

**User Message（用户句）**：
Transcript 中 `role` 为 `user` 的条目，含文字与图片。
_避免使用_：Prompt、消息

**Assistant Message（助手句）**：
Transcript 中 `role` 为 `assistant` 的条目，含正文与思考。思考不是独立条目。调用本身在 Tool Call 上。
_避免使用_：Agent、Agent 输出

**Thinking（思考）**：
Assistant Message 里的推理内容，不是 Transcript 条目，也不是 Tool Call。
_避免使用_：reasoning、Activity、思考行

**Streaming（流式）**：
Assistant Message 或 Thinking 仍在接收内容。Session、Turn、Tool Call 的进行态是 Running。
_避免使用_：running、live、打字

**Tool Call（工具调用）**：
Transcript 中 `role` 为 `tool` 的条目：一次调用的入参、输出与状态。
_避免使用_：Tool、函数

**Transcript（交互记录）**：
Session 中 User Message、Assistant Message 和 Tool Call 的有序历史。它不是底层全部运行时事件的完整日志。
_避免使用_：聊天记录、事件日志

**Model（模型）**：
为 Agent 在 Session 中的后续工作选择的 Pi 模型。更换 Model 不会创建新 Session，也不会改变已有 Transcript。
_避免使用_：ModelRef、引擎

**Thinking Level（思考级别）**：
Session 为当前 Model 请求的推理投入程度。
_避免使用_：思考模式、智能级别

**Tool（工具）**：
Agent 可以在 Turn 中调用的外部能力。一次具体调用是 Tool Call。
_避免使用_：Tool Call、函数、Extension

**Extension（扩展）**：
通过 Pi Extension API 接入、可动态拔插的能力单元。Git、Terminal、Browser、MCP、Custom Tool 以 Extension 存在，不是 pig 内置工具。
_避免使用_：内置工具、插件

**Skill（技能）**：
Pi 按 Working Directory 加载、写入 Agent prompt 的能力说明。它不是 Tool，也不是 Extension。
_避免使用_：插件、提示模板、Tool

**设置（Settings）**：
pig 拥有的 UI 偏好与资源查看弹框。不是 Pi SettingsManager，也不是 Session。
_避免使用_：账号设置、Pi 配置编辑器

**用量（Usage）**：
跨时间窗的 Token 统计视图。不是当前 Session 的上下文占用。
_避免使用_：上下文占用、配额、账单
