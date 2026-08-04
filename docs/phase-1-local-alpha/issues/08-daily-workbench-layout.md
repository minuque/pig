# 08 — 落地日常可用工作台

**What to build:** 按 UI 原型 A 落地 Workspace/Session 导航、会话记录（Transcript）与 Run 上下文三栏工作台，并建立后续 Run 操作复用的状态、确认和错误反馈体验。

**Blocked by:** 01 — 持久化多 Workspace Access；02 — 可管理的 Session 列表；07 — 隔离 Session 客户端状态

**Status:** ready-for-agent

- [ ] 桌面端采用三栏布局：左侧 Workspace/Session 导航、中间 Transcript 与 Composer、右侧 Run/Session/Gateway 上下文。
- [ ] 左右侧栏可独立折叠，并可通过边框拖拽调整宽度；尺寸受合理上下限约束且不会挤坏主内容。
- [ ] 窄屏使用抽屉或分层视图呈现侧栏，当前 Session、Run 状态和 Composer 始终可访问。
- [ ] Session 卡片、Prompt、回复、思考、工具活动、工具结果及 Run 状态遵循原型的信息层级和既有安全渲染约束。
- [ ] 破坏性操作使用明确确认；普通成功反馈采用非阻塞通知；失败反馈包含发生事项、可执行建议和稳定关联信息。
- [ ] 状态不只依赖颜色表达，核心操作可通过键盘访问且焦点清晰。
- [ ] 不提前实现 Phase 2 的 Unavailable Session、Interrupted Run 或完整恢复能力。
