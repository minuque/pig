# no-pi-no-gang v2 首发规格

Status: ready-for-agent

## Problem Statement

Pi 已提供强大的 coding-agent Runtime 与原生 Session 持久化，但用户缺少一个安全、可恢复、可并行操作多个 Session 的本地图形工作台。直接暴露 Pi Runtime 会让客户端承担执行协调、并发、持久化恢复和敏感认证状态；自行复制 Session 内容又会制造第二份事实源，并在崩溃、升级或 Pi 格式变化后产生不一致。

用户需要一个本地优先、单用户、可通过 npm 安装的工作台：它应明确授权 Workspace，管理基础 Session 生命周期，在不同 Session 间并行运行 Agent，持续展示文本、思考与工具活动，支持 Pi 原生模型和 Auth Flow，并在断线、崩溃、数据损坏、协议不兼容和升级失败时给出安全且可操作的恢复路径。产品不能暗示 Workspace 是操作系统沙箱，也不能把 prompt、工具内容、credential 或 Pi Agent Root 泄漏到应用日志和应用数据库中。

## Solution

交付一个 Vue 3 本地工作台及单进程 Node Agent Gateway。浏览器仅通过版本化 REST 与一个 Gateway 级 SSE 连接消费契约；Agent Gateway 嵌入固定版本的 Pi SDK，独占 Run 调度、Session 恢复、应用持久化、实时事件、Workspace 授权与安全诊断。

Pi Session JSONL 继续作为 Transcript 与 Pi 状态的唯一事实源。应用 SQLite 只保存 Workspace Grant、Run 账本、命令幂等记录、资源 revision，以及可随时从 Pi JSONL 重建的 Session Projection 和搜索索引。每个 Session 同时最多运行一个 Run，并按 FIFO 处理队列；不同 Session 在有界公平并发下执行。任何无法证明正常完成或取消的 Run 都成为 Interrupted Run，绝不自动重放。

首发通过 npm CLI 在随机 loopback 端口启动，使用一次性 fragment bootstrap 建立进程级浏览器 credential，并严格校验 authority、Origin、Fetch Metadata、Cookie、CSRF 和 Workspace Grant。界面提供 Workspace、Session、Transcript、composer、模型及 Auth Flow 的完整首发旅程，并对断线、Unavailable Session、Quarantined Session、Interrupted Run、迁移失败和协议不兼容提供明确恢复操作。

## User Stories

1. As a Pi 用户, I want 通过一个本地图形工作台使用 Pi, so that 我无需直接操作底层 Runtime 也能完成日常 Agent 工作。
2. As a 首次使用者, I want 通过 npm 安装并启动工作台, so that 我不需要安装桌面应用或手工组装前后端服务。
3. As a 本地用户, I want CLI 自动在随机 loopback 端口启动并打开浏览器, so that 服务不会暴露到局域网且启动过程简单。
4. As a 本地用户, I want 可通过参数禁止自动打开浏览器或选择独立 Application Data Root, so that 我能适配终端工作流并隔离多个实例的数据。
5. As a 安全敏感用户, I want 浏览器通过短生命周期的一次性 bootstrap secret 建立访问凭证, so that 其他网页或本机未授权进程不能轻易接管 Agent Gateway。
6. As a 安全敏感用户, I want bootstrap secret 不进入 HTTP 请求、日志或浏览器历史, so that 敏感引导材料不会被常规诊断表面泄漏。
7. As a 本地用户, I want 浏览器 credential 在 Gateway 重启后失效, so that 新进程不会错误信任旧浏览器会话。
8. As a Workspace 所有者, I want 在注册前预览规范化后的真实目录, so that 我能确认符号链接和路径别名最终授权的是哪个根目录。
9. As a Workspace 所有者, I want 显式确认 Workspace Grant, so that 当前目录不会在我不知情时自动成为受信任资源。
10. As a Workspace 所有者, I want 取消不再需要的 Workspace Grant, so that 相关 Session 和 Run 不再可通过 Gateway 访问。
11. As a Workspace 所有者, I want 在存在未结束 Run 时阻止取消注册, so that 正在执行的工作不会失去明确归属。
12. As a 用户, I want 清楚看到 Workspace Grant 不是文件系统沙箱, so that 我不会误以为 Pi 工具受限于 Workspace 根目录。
13. As a 用户, I want 在 Workspace 中创建 Pi 原生 Session, so that 新工作以 Pi 可恢复的格式持久化。
14. As a 用户, I want 查看并分页浏览已授权 Workspace 下的 Session, so that 大量历史记录仍可管理。
15. As a 用户, I want 恢复已有 Pi Session, so that 我能跨浏览器标签页和 Gateway 生命周期继续工作。
16. As a 用户, I want 重命名 Session, so that 列表可以使用符合任务语义的名称。
17. As a 用户, I want 搜索活跃路径中的可见用户与助理文本, so that 我能快速定位历史 Session 而不会索引敏感工具参数或思考内容。
18. As a 用户, I want 以可恢复方式删除 Session, so that 文件操作中断后 Gateway 能协调 tombstone 和回收状态而不是静默丢失历史。
19. As a 用户, I want 对结构损坏或归属歧义的 Session 看到 Quarantined Session 状态, so that 产品不会跳过损坏内容并继续写入。
20. As a 用户, I want 对暂时无法安全恢复的 Session 看到最后验证的只读摘要, so that 我仍能理解问题范围而不会进一步损坏来源。
21. As a 用户, I want Unavailable Session 拒绝新 Run 和 mutation, so that 不安全状态不会被误当作正常 Session。
22. As a 用户, I want 查看安全、稳定的 Transcript 项目, so that Pi 原生消息、工具、压缩和模型变化能以一致界面呈现。
23. As a 用户, I want Markdown、代码块和链接被安全渲染, so that Agent 输出可读且不能借 raw HTML 注入界面。
24. As a 用户, I want 复制代码时获得原始代码文本, so that 语法高亮生成的 DOM 不会污染剪贴板内容。
25. As a 用户, I want 流式文本在原位置平滑更新, so that 我能实时阅读而不看到重复消息或频繁重排。
26. As a 阅读历史的用户, I want 只有在接近 Transcript 尾部时自动跟随输出, so that 新 token 不会强行把我从正在查看的位置拉走。
27. As a 阅读历史的用户, I want 一键跳转至最新内容, so that 我可以自行恢复实时跟随。
28. As a 用户, I want 展开或收起思考和工具活动, so that 我能在紧凑概览与执行细节之间切换。
29. As a 用户, I want 输入多行 prompt 并选择模型与 thinking level, so that 每次工作都使用合适的 Execution Profile。
30. As a 用户, I want Run 被接纳时冻结 Execution Profile, so that 后续界面选择不会改变已排队工作的执行语义。
31. As a 用户, I want 每次普通 prompt 创建一个有独立标识和状态的 Run, so that 执行生命周期清晰可追踪。
32. As a 用户, I want 同一 Session 的多个 Run 按 FIFO 顺序执行, so that 上下文修改不会彼此竞态。
33. As a 多任务用户, I want 不同 Session 的 Run 可以有界并行, so that 一个长任务不会阻塞所有其他工作。
34. As a 多任务用户, I want 调度在繁忙 Session 之间保持公平, so that 持续提交的单一 Session 不会使其他 Session 饥饿。
35. As a 用户, I want 在 Run 排队过多时收到明确拒绝, so that Gateway 不会无界占用内存。
36. As a 用户, I want 向当前 running Run 发送 Steer, so that 我能纠偏而不会意外创建普通后续 Run。
37. As a 用户, I want 取消 queued 或 active Run, so that 我可以停止不再需要的工作并看到准确终态。
38. As a 用户, I want Run 只有在 Pi 已 settled 且终态已持久化后才显示完成, so that 界面成功状态与可恢复状态一致。
39. As a 用户, I want 崩溃或不确定终止后的 Run 显示为 Interrupted Run, so that 产品不会虚构成功、失败或取消结果。
40. As a 用户, I want Interrupted Run 永不自动重放, so that 有副作用的工具调用不会被悄然执行第二次。
41. As a 用户, I want 可显式重试 Interrupted Run 并创建新 Run, so that 恢复操作具有新的身份和可审计生命周期。
42. As a 用户, I want 重复提交同一个 commandId 时得到原始结果, so that 网络重试不会重复创建 Run 或 mutation。
43. As a 用户, I want 在不同 Session 间切换时保留各自的实时活动和 composer draft, so that 并行工作不会丢失临时上下文。
44. As a 用户, I want 收到 queued、thinking、streaming、tool 和终态的实时更新, so that 我能理解每个 Run 当前在做什么。
45. As a 用户, I want 一个浏览器连接同时接收所有 Session 的事件, so that 多 Session 并行不需要维护大量独立连接。
46. As a 用户, I want 断线重连后从游标恢复遗漏事件, so that 短暂网络中断不会重复或丢失 Transcript 内容。
47. As a 用户, I want 在事件历史缺口、epoch 变化或客户端过慢时自动以快照恢复, so that 界面不会在未知状态上继续归约。
48. As a 用户, I want 离线、重连和恢复状态被安静但明确地展示, so that 我知道命令何时不能安全提交。
49. As a 用户, I want 选择 Pi 提供的模型, so that 工作台保持与实际 Pi 能力一致。
50. As a 用户, I want 完成浏览器 OAuth、device code、选择或敏感输入等 Auth Flow, so that 我可以配置需要认证的 provider。
51. As a 用户, I want Auth Flow 过期、取消或 Gateway 重启后安全终止, so that 旧 credential 交互不会被错误恢复。
52. As a 安全敏感用户, I want API key、OAuth 答案和其他敏感输入只在组件本地短暂存在, so that 它们不会进入缓存、Pinia、devtools、资源响应或日志。
53. As a 键盘用户, I want 完整操作导航、sheet、dialog、工具详情和 composer, so that 我无需鼠标也能使用核心功能。
54. As a 辅助技术用户, I want 稳定语义名称、焦点管理和不过度播报 token 的 live region, so that 流式界面保持可理解。
55. As a 窄屏用户, I want Workspace 和 Session 导航转换为 sheet 与单面板流程, so that 核心工作在小屏幕仍可使用。
56. As a 用户, I want 完整的浅色、深色和系统主题, so that 工作台适合不同环境且语义状态保持足够对比度。
57. As a 用户, I want Gateway 启动、迁移、reconciliation、provider auth、协议不兼容和数据异常都有可操作提示, so that 我知道下一步应重试、恢复、重新认证还是升级客户端。
58. As a 运维本地实例的用户, I want readiness 与 liveness 准确反映启动和恢复状态, so that 启动脚本不会把尚未可用的 Gateway 当作就绪。
59. As a 隐私敏感用户, I want 日志只包含类型化白名单诊断字段, so that prompt、Transcript、工具 payload、路径、credential 和环境值不会被持久化。
60. As a 用户, I want 日志大小有固定上限并保留最小崩溃标记, so that 长期运行不会无限占用磁盘且重启后仍能识别非正常退出。
61. As a 升级用户, I want schema 变更前自动创建并验证 Upgrade Backup, so that 迁移失败时存在可信恢复点。
62. As a 升级用户, I want 新二进制对数据库所有权、schema 与迁移历史 fail closed, so that 错误版本不会修改未知或更新的数据库。
63. As a 升级用户, I want 显式列出并恢复已验证的 Upgrade Backup, so that 回滚是可控操作而非自动覆盖当前数据。
64. As a 升级用户, I want 恢复后看到应运行的准确软件版本, so that 数据库 schema 与应用二进制保持兼容。
65. As a Pi Session 所有者, I want 应用升级永不复制、改写或恢复 Pi Agent Root, so that auth、模型设置与 Session JSONL 的独立所有权保持清晰。
66. As a 回滚用户, I want Pi 版本产生 Rollback Barrier 时阻止普通发布, so that 旧版本不会被声称能安全读取已变化的 Session JSONL。
67. As a 多实例用户, I want 每个 Application Data Root 只允许一个 Gateway owner 而不同 roots 可并行, so that SQLite、锁和日志不会被两个进程竞态写入。
68. As a 用户, I want Gateway 在退出时停止准入、终止或中断 Run、关闭 SSE 和 SQLite 并释放锁, so that 下次启动能准确恢复。

## Implementation Decisions

- 产品采用 Vue 3 + Vite SPA、单进程模块化 Node Agent Gateway 与直接嵌入的 Pi SDK。它是本地单用户工作台，不是 Web BFF、远程多租户服务或桌面应用。
- 首发运行时最低为 Node 22.19.0。发布包固定精确 Pi 版本，npm `engines` 与 CLI 运行时检查共同执行版本下限。
- 代码按 web、gateway、contracts、testkit 四个粗粒度 workspace 组织。依赖方向保持为 web 与 gateway 仅通过 contracts 相交；生产代码不得依赖 testkit。
- contracts 模块是浏览器安全、schema-first、版本化的公共 seam，使用 Zod 4 定义 REST 资源、命令、SSE 事件、分页、Problem Details、capability 与兼容性字段；不得导入 Pi、Hono 或 Vue。
- 所有 API 位于 `/api/v1`。查询和命令使用 REST；所有 Session 的实时事件复用一个 Gateway 级 SSE 连接。首发不引入 WebSocket。
- 可变资源携带单调 `revision`。命令成功返回统一 Mutation Result；错误使用 RFC 9457 Problem Details 与稳定、可枚举的问题代码。
- 列表使用有界不透明游标分页。每个 operation 与 event 必须在中央契约注册表中恰好有一个 schema、授权类别、typed-client 映射与预期 Problem family。
- Transcript 使用项目拥有的封闭联合类型表示 message、tool call、tool result、compaction、model change、notice 与 unsupported；不得把原始 Pi 对象直接暴露给客户端。
- Pi Session JSONL 是 Session、Transcript、工具结果、模型变化、压缩及 Pi 扩展条目的唯一事实源。应用 SQLite 不复制完整 Transcript，也不成为 Message Store。
- SQLite 只拥有应用原生状态与可重建 Session Projection，包括 Workspace Grant、Run 账本、命令幂等记录、资源 revision、查询视图与 FTS 搜索索引。
- Session Projection 以 Pi 原生 Session ID 与 entry ID 幂等摄取，并使用安全摘要检测身份冲突。投影 schema 或 parser 变化通过 shadow generation 重建、验证和原子切换；重建期间继续提供上一有效 generation。
- FTS 只索引活跃路径上可见的用户与助理文本。思考、工具参数、原始扩展 payload 与未支持内容不进入搜索索引。
- Session 源健康明确区分 healthy、dirty tail、Unavailable Session 与 Quarantined Session。无法安全恢复或修改时拒绝 Run 和 mutation；Quarantined Session 仅允许安全诊断与删除，不自动跳过、修补或改写历史。
- 删除通过受协调的源文件回收与 SQLite tombstone 实现，准备、文件操作、提交和崩溃恢复必须幂等。删除不把 Pi JSONL 复制进应用数据库。
- 一个深的 Session Runtime Coordinator 统一拥有 durable Run admission、command idempotency、每 Session FIFO actor、公平并发、Steer、cancel、Pi Runtime residency、终态持久化和 shutdown。
- 普通 prompt 创建 Run。Run 经过 queued、starting、running 和不可变终态；任何无法证明正常完成或取消的非终态 Run 在重启恢复时成为 Interrupted Run。
- 每个 Session 同时最多一个 active Run，队列最多 32 个 Run；跨 Session 默认最多 4 个 active Run，并采用有界公平调度。容量可作为进程组合参数存在，但不改变契约语义。
- commandId 由客户端生成。同一 principal、commandId 与等价 payload 的重试返回原结果；同一 ID 配不同 payload 必须拒绝。
- Steer 只能发送给当前 running Run，不创建新 Run，也不是忙时普通 prompt 的降级路径。重试 Interrupted Run 必须创建新 Run；系统绝不自动重放。
- Pi Runtime 按 Session 惰性创建或恢复，内部最多保留一个常驻实例，闲置五分钟后释放。客户端永不持有或感知 Pi AgentSession 引用。
- Run 只有在 Pi settled 且 durable terminal transition 提交后才成为终态；晚到事件不得复活终态 Run。
- shutdown 顺序为停止准入、处理中断的 queued Run、并发取消 active Run、关闭实时连接与 Runtime、关闭 SQLite、释放实例锁。正常 Runtime 排空预算十秒，总进程预算十五秒；第二次信号可强制退出。
- SSE 信封提供 gateway epoch、单调 gateway sequence 与 Run 内 sequence。bootstrap 快照和捕获游标组成恢复边界；客户端重复事件无害，缺口、过旧游标、epoch 变化或背压越界触发 reset 后重新取快照。
- 每个 SSE 客户端只有有界待发送队列。Gateway 不维护永久 token-delta 事件存储，也不声称知道客户端实际应用到哪个事件。
- Router 独占选中的 Workspace 和 Session ID；TanStack Vue Query 独占可由 REST 重取的 durable facts；一个 Pinia store 独占按 Session/Run 分区的 Live Overlay；组件独占草稿、展开状态和敏感输入。
- Gateway Sync Controller 是唯一 SSE consumer，拥有连接、游标、去重、revision-aware projection、reset 与 snapshot recovery。Live Overlay 通过无 Vue 依赖的纯 reducer 归约，并可由验证后的 snapshot 整体替换。
- composer draft 仅保存在按 Session ID 分区的内存注册表中。模型和 thinking level 在 Run admission 时冻结为 Execution Profile。
- provider Auth Flow 使用版本化资源表达 open URL、device code、prompt 与 select 等交互。credential 输入是 write-only，提交后从组件内存清除，不进入 Query、Pinia、devtools、日志或 API 响应。
- Gateway 只绑定 `127.0.0.1` 的随机端口，不提供任意 host 绑定逃逸。浏览器初始 URL 仅在 fragment 中携带两分钟有效、单次使用的 bootstrap secret。
- bootstrap 交换后发放进程级 HttpOnly、SameSite=Strict、Path=/api Cookie 与 session-bound CSRF token。Cookie 不设置 Domain 或持久化过期字段。
- 每个请求依次执行精确 authority、Origin、Fetch Metadata、Cookie、CSRF 和 Workspace Grant 校验；默认不启用 CORS，不返回允许跨域头，不接受 preflight 作为产品协议。
- Workspace 注册采用 preview/confirm 两阶段，使用 realpath 规范化并按路径组件检查包含关系。cwd 只能作为候选，不构成自动授权。
- Principal 是跨 Gateway 重启稳定的本地身份；浏览器 credential 只在当前进程有效。Workspace Grant 保护 Gateway 资源，不限制 Pi 工具和子进程的操作系统权限。
- UI 采用三区域 Workbench Shell：Workspace rail、Session sidebar、conversation panel。窄屏转换为单面板与导航 sheet，不构建独立移动产品。
- 根设计文档是视觉事实源；项目拥有基于 Reka/shadcn-vue 的组件与 Tailwind v4 语义 token。浅色、深色、系统主题、44px pointer target、可见焦点、减少动效和语义状态色均为首发约束。
- Transcript 使用 markdown-it token 流与项目拥有的 Vue VNode renderer，禁用 raw HTML 且不使用 `v-html`。链接协议和属性采用白名单；Shiki highlighter 长期复用并按语言懒加载。
- streaming markdown 保留原始 buffer，按 50–100ms 合并解析，最终 chunk 立即完成。首发保持主线程渲染；只有实测超过既定长任务阈值才另行决定 Worker。
- 首发不启用 Transcript 虚拟化。滚动仅在用户接近尾部时自动跟随，并提供显式“跳转至最新”。
- SQLite 使用 Node 内置 `node:sqlite` 与项目拥有的不可变编号 SQL migrations，不使用 ORM、migration framework 或 native addon。每个 migration 使用独立 `BEGIN IMMEDIATE` 事务并在提交时更新 schema 版本。
- Application Data Root 使用平台规范目录，明确分离 database、state 与可重建 cache。Pi Agent Root 独立解析，应用不得复制其 auth、models、settings 或 Session JSONL。
- 每个 Application Data Root 由一个实例锁保护；不同 data root 可以并行运行。发布物是一个 npm CLI，包含 Gateway、构建后的 SPA 与 immutable migrations，不包含开发源树或 workspace link。
- Gateway 启动在 HTTP、Pi、watcher 与 reconciliation 之前执行 Node 版本、实例锁、数据库 ownership、schema 与 migration-history gate。
- 数据库使用固定非零 application ID、authoritative user version 和带 build-time checksum 的 immutable migration history。外来数据库、更新 schema、断裂历史或 checksum 不匹配均 fail closed。
- 只有存在待执行 SQL migration 时创建 Upgrade Backup。备份使用 SQLite Online Backup API，并在发布前验证 integrity、application ID、schema、migration history 与 SHA-256；不得复制 live database/WAL 文件组合。
- 最多保留三个正常完成的 Upgrade Backup。新备份只有在迁移及迁移后验证成功后才触发旧备份裁剪；失败升级可暂时保留额外恢复证据。
- 首发只提供列出备份与带显式确认的恢复命令。restore 在独占 data root 后验证备份、尽力保存当前可读数据库、隔离当前 database/WAL/SHM、原子安装并再次验证；它不运行 npm、不启动 Gateway、不修改 Pi Agent Root。
- SQLite migrations forward-only；无 down migration、自动 updater、自动 restore 或只读 downgrade server。新数据库 schema 遇到旧二进制时拒绝启动并提供稳定错误代码和恢复指导。
- Pi 版本升级必须通过向后读取兼容性 gate：上一支持版本必须能重开由候选 Pi 写入的隔离 Session fixture。失败即构成 Rollback Barrier，需另行设计迁移、导出和用户备份策略，不能作为普通首发更新发布。
- Minimum Safe Diagnostic Surface 只包含封闭的 Safe Diagnostic Event、请求/命令关联、最小 health probes、崩溃标记与用户可操作恢复状态。
- 诊断日志是固定容量的 allow-listed JSONL，最大 50 MiB，按最旧 segment 轮换。禁止 prompt、消息、工具内容、cookie、token、路径、环境值、raw URL、未知异常 message 与未声明字段。
- liveness 仅表明进程存活；readiness 以有限、稳定代码表示启动、migration、reconciliation、shutdown 等状态。崩溃标记只记录安全 fingerprint，并在非正常退出后的下一次启动触发恢复检查。

## Testing Decisions

- 最高验收 seam 是从打包后的 npm artifact 启动真实 Agent Gateway，并由浏览器通过公开 REST/SSE 契约执行首发关键旅程。该 seam 同时验证发布内容、loopback 安全、SQLite、Pi 集成、SPA 与恢复行为；不为测试暴露额外生产内部接口。
- 良好测试只断言公开资源、命令结果、事件、持久文件所有权、用户可见 DOM、进程退出状态和恢复行为，不断言私有字段、内部调用次数、Vue 组件实现或 SQL 查询形状。
- 契约层测试覆盖注册表完整性、Zod accept/reject fixtures、revision、Problem family、typed client 对称性、route template 唯一性、分页边界与不兼容 revision。
- 模块层优先复用生产 deep-module seams：Session Runtime Coordinator、Session Projection Coordinator、Gateway Access policy、Gateway Sync Controller、Live Overlay reducer、message renderer、migration runner 与 Diagnostic Sink。只有 clock、ID source、故障注入、deterministic Pi/provider adapter 和 process launcher 可作为真正变化的测试依赖。
- Gateway integration 使用真实 SQLite、临时 Application Data Root 与 Pi Agent Root、真实 loopback HTTP/SSE 和真实进程或等价生产组合入口。不得以内存 repository 替代持久化关键路径。
- Runtime 测试覆盖每 Session FIFO、跨 Session 公平并发、队列上限、command idempotency、Run 全状态转换、Steer/cancel 边界、terminal durability、晚到事件、Runtime 恢复失败、idle eviction、graceful shutdown 与崩溃后 Interrupted Run。
- Projection 测试使用 append、partial final line、truncate、replace、delete、invalid JSONL、identity conflict 与未来/unsupported Pi 内容，验证 cursor、dirty tail、Unavailable、Quarantined、shadow generation、atomic flip、FTS 范围与 recoverable deletion。
- Access 测试通过真实 loopback 请求验证 authority、Origin、Fetch Metadata、disabled CORS、fragment bootstrap、secret expiry/single use、Cookie、CSRF、Principal、Workspace canonicalization、Grant substitution 与 unregister revoke，且所有拒绝发生在 domain work 之前。
- SSE 与 Sync Controller 测试覆盖单调 cursor、ordered replay、duplicate、reordered event、gap、epoch mismatch、slow-client backpressure、reset、snapshot replacement、disconnect/reconnect、Gateway restart 和多 Session Live Overlay 隔离。
- Vue 状态测试断言 Router、Vue Query、Pinia 与组件状态的所有权边界；Mutation Result 不伪造 durable domain change；draft 按 Session 隔离；validated snapshot 才能丢弃 stale overlay。
- renderer 测试覆盖安全 Markdown、禁用 raw HTML、危险链接协议、代码溢出与复制、streaming completion、thinking/tool 折叠及 unsupported 内容，不使用 snapshot 代替关键语义断言。
- real-Pi compatibility 测试必须嵌入发布所固定的真实 Pi 包，在隔离 Agent Root 中由 Pi 创建和重开 Session JSONL。确定性本地 provider/model 机制负责阻断网络不稳定；Gateway-only fake 不能替代此 gate。
- upgrade 测试从 fresh database 与每个历史 schema fixture 运行 migrations，验证 checksum 不可变、foreign/newer/corrupt database fail closed、Online Backup 校验与 retention、注入失败、显式 restore 及 Pi Rollback Barrier fixture。
- diagnostics 测试使用 prompt、工具 payload、路径、header、cookie、token、环境值和 CR/LF canary 扫描每类 Problem 与 Safe Diagnostic Event，证明禁止内容不进入日志、health 或 crash marker，并验证 50 MiB rotation 和 sink degradation。
- Chromium Playwright 覆盖完整首发旅程：bootstrap、Workspace 注册、Session 生命周期、搜索、模型与 Auth Flow、streaming、并行 Session、Steer、cancel、Interrupted Run 恢复、断线/reset、Unavailable/Quarantined Session、主题、窄屏和长 Transcript。
- browser acceptance 对核心旅程执行 keyboard-only、focus return、modal containment、semantic name、live-region token 降噪、44px target、两主题 contrast 与 serious axe violation 检查。Firefox/WebKit 只执行 bootstrap、SSE 与 composer smoke。
- 设计 CI 验证设计文档结构、canonical section 顺序、token 引用与组件 contrast；代表性 DOM 样式必须来自项目语义 token。pixel-perfect screenshot 不是 release gate。
- Linux 执行完整 suite。Windows 与 macOS 从同一 packed tarball 执行安装、Node 拒绝、native data root、实例锁、bootstrap、临时 Workspace、真实 Pi Session 创建/重开、SQLite restart persistence 和 bounded shutdown smoke。
- CI 在最低 Node 22.19.0 与当前支持 LTS 上验证 Linux。新 Node 版本只有被 release CI 覆盖后才可声称支持。
- credential-backed live provider canary 可在人工或计划任务中运行，用于发现上游漂移，但因 secret、quota、网络和延迟不可确定，不作为每次发布的 blocking gate。
- 不使用全局覆盖率百分比定义完成。发布候选必须从 clean checkout 和 packed artifact 通过所有适用 critical scenario，不允许无法解释的 skip 或 quarantined flaky test；简单重跑不能把首次失败转为通过证据。
- 实施按四个垂直里程碑验收：安全可执行 shell、durable Session workbench、并行实时 conversation、首发 hardening。每个里程碑可隐藏未完成 route，但不得引入绕过最终 seam 的 placeholder interface。

## Out of Scope

- Session fork、树导航、废弃分支遍历、import、附件、多模态输入、Skills 管理、文件预览/浏览器、PTY 与 terminal emulation。
- 桌面应用、远程多用户服务、tenant、relay、cloud control plane、任意网络 host 绑定与远程认证；这些只能作为未来兼容性约束。
- 多 Agent provider 或 provider-neutral durable Session model；Pi 是首发唯一 Agent 基础。
- 复制旧 React/Next 产品、视觉 parity、代码 shape 或旧契约；旧项目仅可作为行为与失败案例证据。
- 永久 token-delta event store、确定性工具步骤 replay engine、客户端应用事件 acknowledgement 与 Interrupted Run 自动 replay。
- Workspace 对 Pi 工具、扩展、bash 或子进程的操作系统级 sandbox。
- 超出首发 FTS Projection 的搜索能力，以及对 thinking、工具参数或未支持原始 payload 的索引。
- Transcript 虚拟化、raw HTML、DOMPurify、默认 Worker 渲染、图片生成、引用、对比表与文件 diff 专用展示。
- 第二套完整视觉组件库、营销页视觉语言、pixel-perfect screenshot 发布门禁和活动 Run inspector。
- diagnostics dashboard/API、support bundle、downloadable logs、Prometheus、OTLP、distributed tracing、retained metrics、browser telemetry、raw Node reports 与自动 recycle 管理。
- automatic update/restore、down migration、scheduled/compressed/encrypted/cloud backup、delta backup、in-app backup browser、read-only downgrade server、Pi Agent Root snapshot 及跨未批准 Rollback Barrier 的回滚。
- ORM、第三方 migration framework、native SQLite addon 与 Workspace 内应用元数据目录。
- 全局测试覆盖率目标、三平台完整测试重复、所有浏览器完整旅程重复，以及 credential-backed live Provider 调用作为确定性 CI blocker。

## Further Notes

- 本规格使用 Agent Gateway、Workspace、Session、Run、Interrupted Run、Steer、Execution Profile、Auth Flow、Session Projection、Unavailable Session、Quarantined Session、Principal、Workspace Grant、Live Overlay、Application Data Root、Minimum Safe Diagnostic Surface、Upgrade Backup 与 Rollback Barrier 作为规范领域术语。
- 测试 seam 已按“最高可行 seam、最少 seam”原则收敛：发布级验收以 packed artifact 的真实 Gateway 公共契约为最高 seam；只有需要穷举状态或注入确定性故障的领域模块保留其既有 deep-module seam。
- 四个实施里程碑依次为：安全可执行 shell；durable Session workbench；并行实时 conversation；首发 hardening。架构决策已闭合，实施阶段不应重新打开已明确排除的能力，除非出现经验证的新约束。
