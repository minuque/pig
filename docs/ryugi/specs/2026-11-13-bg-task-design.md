# 会话状态拆分与后台任务（bg task）内置扩展：设计

一轮讨论已收敛，这是最终设计，按它落地。已于 2026-11-13 批准。讨论原文：`.ryugi/artifacts/document/bg-task-extension/doc.xml`。

分两个 PR，都从 PR #29 的分支往上叠：

- PR A 是纯重构，行为不变：会话状态拆分，加上 `Task` 形状。
- PR B 是新功能：后台任务。

## 1. 为什么做

模型现在跑命令和派 subagent 都会挡住对话，直到跑完。开发服务器、测试、长耗时命令没法这样跑。后台任务让工具调用立刻返回，任务在会话里继续跑，结束时叫醒模型。

现在做而不是以后做，是因为任务模型和传输路径一旦定下，subagent、后台命令、以后的其他任务都走同一条路。等 subagent 的专用写法铺开后再改，web、gateway、扩展三处都要返工。

会话状态拆分是前置：会话状态现在放在视图模块 `session-workbench` 里，`session-nav`、`session-rail`、`extension-ui` 只能反过来引用视图模块，形成互相引用。

## 2. 目标与边界

| 类别 | 内容 |
|---|---|
| 目标 | 后台命令可启动、读输出、停止；subagent 可放到后台跑；任务结束叫醒模型；切走会话任务不停；摘要面板列出任务，可停止，可看输出；同时在跑的任务有数量上限；命令的完整输出落盘；本地与远程会话都能用；在 pi TUI 里装这个扩展也能用。feature 之间的引用全部单向。 |
| 非目标 | 等到某行输出出现再返回；定时与循环任务；预览服务器；调整规格的设置界面（这次只定位置和默认值）。 |
| 反目标（不能做） | 任务跨 gateway 重启存活（那是离线长任务）；给扩展开 pig 私有接口；web 按工具名或任务种类写专用逻辑；兼容旧的 subagent 结果形状；覆盖 pi 内置的 bash 工具；默认的运行时长上限。 |

## 3. 约束

- 仓库规则照 `AGENTS.md`：功能代码文件不超过 500 行；导入用别名；已有依赖能表达就复用；单测只测产品假设和数据路径。
- 每个提交跑 `pnpm fix:touched` 和 `pnpm check:touched`；动到会话生命周期和流式的提交加跑 `pnpm test:bench`。
- UI 守 `apps/web/DESIGN.md` 的七条规则；样式只用 `tokens.css` 的 token，动画只用 `motion.css`。
- 扩展只用 pi 1.5 的公开 Extension API。

## 4. 决定

- 任务形状 `Task` 定义在 `@pig/protocol`，字段骨架照 cc-wrapper（你定的方向，字段是我的建议）。
- 状态用词：`queued`、`running`、`completed`、`failed`、`stopped`（我的建议）。
- 扩展直接产出 `Task`，web 只认形状，不认工具名（你定的）。
- 不兼容旧的 subagent 结果形状；旧会话里的 subagent 调用显示成普通工具行（你定的）。
- 后台任务做成 `packages/extensions` 里的内置扩展，只用公开 Extension API（你定的）。
- 会话状态模块名 `features/session/`；另开分支（你定的）。
- 界面尽量对齐 cc-wrapper 的后台任务面板（你定的）。
- 第一版包含后台命令和后台 subagent（你定的）。
- 新增独立工具，统一带 `bg_` 前缀，不改 bash（你定的）。
- `bg_task_start` 有可选的 `timeout` 参数（你定的）。
- 任务数量上限和输出落盘这次就做，规格集中在一处，方便以后提供设置入口（你定的）。
- 任务结束叫醒模型（你定的）。
- 切走会话任务继续跑；应用退出或 gateway 重启时任务结束，留「已停止」记录；摘要面板可停止、可看输出；两个 PR（按建议）。
- 验收场景：开发服务器、测试、长耗时命令（你给的）。
- 命令在会话所在的环境里跑（我的决定）。
- 扩展和 gateway 之间用 `pi.events` 通信（我的决定）。
- 被主动停止的任务不叫醒模型；超时算失败，会叫醒模型（我的决定）。
- 链式 subagent 不支持后台（我的决定）。
- 不先画界面稿，做出来后在真实应用里对照 cc-wrapper 核对（我的决定）。

## 5. PR A：会话状态拆分

### 5.1 新建 `features/session/`

从 `session-workbench` 搬过去，纯移动加改引入路径：

| 搬到 `features/session/` | 留在 `session-workbench/` |
|---|---|
| `index.ts`（provide / use） | `index.vue`、`components/` |
| `type.ts` | `hooks/use-composer-dock.ts` |
| `hooks/use-session.ts` | `hooks/use-session-drop.ts` |
| `hooks/use-background-send.ts` | `hooks/use-turn-finish.ts` |
| `hooks/use-live-subscriptions.ts` | `lib/glyph-wind.ts` |
| `hooks/use-session-history.ts` | `lib/session-reference.ts` |
| `hooks/abortable-open.ts` | |
| `lib/session-state.ts` | |
| `lib/session-history-cache.ts` | |
| `lib/coalesce-by-frame.ts` | |

- `workbenchHeaderTitle` 只有头部组件用，跟着视图走。
- `sessionTitle` 和 `untitledSession` 从 `session-nav/lib/format.ts` 移到 `session/lib/`，`session-nav` 改为从 `session` 引入。
- 测试 `session-state.test.ts` 移到 `test/features/session/lib/`。
- `scripts/check/scope.mjs` 给 `features/session/` 加 e2e 映射，沿用 `session-workbench` 的那组。
- `docs/directory-structure.md` 补 `session` 模块，并改掉组合根的过期描述。

### 5.2 拆 `use-session.ts`

现在 565 行，超上限。前台连接（挂上、摘下、切换、重连、释放 `GatewaySession`）拆成 `hooks/use-foreground-session.ts`。路由同步、建会话、发送、中止留在 `use-session.ts`。对外的返回值不变。

### 5.3 `Task` 形状与解环

- `packages/protocol/src/task.ts` 定义 `Task`。PR A 只含 `AgentTask` 用得到的字段。
- subagent 扩展产出 `details.tasks`，不再产出 `results`。
- web：`session-rail/lib/subagent.ts` 删除；`transcript-view/lib/` 新增按形状读任务的函数；`ToolSubagentBody.vue` 改成 `ToolTaskBody.vue`；`ToolRow.vue` 和摘要面板不再判断工具名。
- 解开 `transcript-view` 和 `session-rail` 的互相引用：`transcript-view/index.ts` 定义「打开子会话」的注入键，由 `provideSessionRail` 提供实现。

做完后的依赖方向：`session-workbench` 只被 shell 和 router 引用；`session-nav`、`session-rail`、`extension-ui` 引用 `session`；`session` 引用 `composer` 和 `transcript-view`；`session-rail` 引用 `transcript-view`。

## 6. PR B：后台任务

### 6.1 任务形状

```ts
type TaskStatus = "queued" | "running" | "completed" | "failed" | "stopped"

interface TaskBase {
  id: string            // 稳定标识："agent:<子会话 id>"、"bash:<随机 id>"
  description: string   // 一行标题：子代理名，或命令的简述
  status: TaskStatus
  startedAt?: number    // 毫秒时间戳
  completedAt?: number
  error?: string
}

interface AgentTask extends TaskBase {
  kind: "agent"
  sessionId?: string    // 有它就能点开看子会话
  prompt: string        // 交给子代理的任务
  steps: string[]       // 最近几步工具调用
  summary?: string      // 子代理的最终回复
  tokens: number
}

interface BashTask extends TaskBase {
  kind: "bash"
  command: string
  output: string        // 只留末尾 8000 个字符
  exitCode?: number | null
  logPath?: string      // 完整输出的日志文件；界面这一版不用
}

type Task = AgentTask | BashTask
```

界面只读 `TaskBase` 的字段就能画出一行；`kind` 决定展开后显示什么。

### 6.2 任务怎么流动

前台和后台是同一个 `Task`，走两条路：

- 前台（现在的 subagent）：工具结果的 `details.tasks` 持续更新，工具调用结束任务就结束。
- 后台：工具调用立刻返回 task id。扩展经 `pi.events` 的 `pig:tasks` 频道发任务列表，gateway 放进会话快照推给 web。web 的停止请求经 gateway 发到 `pig:tasks:stop` 频道。任务结束时扩展调 `pi.sendMessage`，时间线多一行通知。

`pi.events` 是 pi 公开的扩展间事件总线。gateway 是 SDK 宿主，建会话时把总线传给资源加载器（`DefaultResourceLoader` 的 `eventBus` 选项）。在 pi TUI 里没人监听，扩展照常工作。

任务结束的 `pi.sendMessage`：`customType` 是 `pig.task`；`content` 是给模型读的文字（状态、退出码、输出末尾）；`details` 是 `Task`；选项是 `triggerTurn: true` 加 `deliverAs: "followUp"`。被用户或模型主动停止的任务只记通知，不触发新一轮。

### 6.3 扩展（packages/extensions）

- 新增 `src/tasks/`，是第三个内置扩展。里面有一份按会话分的任务登记表：任务、它的中止开关、输出缓冲。
- 三个工具：
  - `bg_task_start`：参数 `command`、`description`、可选的 `timeout`（秒）。在会话的环境里启动命令，立刻返回 task id。
  - `bg_task_output`：参数 `id`。返回状态、退出码、输出末尾。
  - `bg_task_stop`：参数 `id`。停止任务。
- `timeout` 不给就不限时。到时间后命令被终止，任务状态是 `failed`，`error` 写明超过多少秒被终止，并照常叫醒模型。工具说明里告诉模型：会自己结束的命令给超时，常驻的命令不给。
- 命令经 `@pig/environment` 的 `exec` 跑。远程会话读 remote-workspace 写下的绑定，在 SSH 主机上跑。
- `subagent` 工具加可选参数 `background`。为真时每个子任务登记进同一份登记表，工具调用立刻返回 task id。链式模式不支持后台。
- `session_shutdown` 时停掉所有在跑的任务，并各写一条状态为 `stopped` 的通知，不触发新一轮。

规格集中在 `src/tasks/config.ts` 一个对象里，代码别处不写这些数字：

| 规格 | 默认值 | 超出时 |
|---|---|---|
| 每个会话同时在跑的任务数 | 8 | 启动工具返回错误，告诉模型先停掉一个或等一个结束。已结束的任务不占名额。 |
| 界面与模型看到的输出末尾 | 8000 个字符 | 只留末尾，开头截在换行处。 |
| 单个任务的日志文件大小 | 10 MB | 停止写入，在文件末尾记一行说明。任务继续跑，输出末尾照常更新。 |
| 日志目录 | `~/.pig/tasks/<会话 id>/<任务 id>.log` | 不适用 |

- 落盘的是命令任务的完整输出。代理任务不落盘。
- 日志在本机，远程会话也一样。
- 本地会话里 `bg_task_output` 和结束通知带上日志路径。远程会话里不给路径，只给输出末尾。
- 删除会话时一并删掉 `~/.pig/tasks/<会话 id>/`。任务结束后日志保留。

### 6.4 gateway

- 建会话时创建事件总线并传给资源加载器。监听 `pig:tasks`，把任务列表放进会话快照，变化时推给 web。输出变化合并后再推。
- 协议加一条命令：按 `sessionId` 和 `taskId` 停止任务。
- 时间线：`details` 是 `Task` 形状的自定义消息，转成一种新的时间线条目（任务通知）。其他自定义消息照旧不进时间线。
- 会话销毁条件加一项：有任务在跑的会话不销毁（`live-sessions.ts` 的 `maybeDispose`）。
- 删除会话时删掉它的任务日志目录。

### 6.5 web

- 摘要面板的 Task 块显示两个来源合并后的列表：会话快照里的后台任务，加上最近一次前台工具调用里的任务。按 `id` 去重。
- 界面对齐 cc-wrapper 的后台任务面板（`G:\AICode\cc-wrapper\app\src\source-background-tasks.jsx`）：
  - 分「进行中」「已结束」两段：进行中按开始时间排，已结束按结束时间倒序。
  - 每条任务一张卡：第一行是标题，运行时带微光，右侧是停止按钮；第二行是类型、状态和已用时间，运行时每秒走。
  - 展开后先显示命令原文，再显示输出：只留最后 8000 个字符，新输出到来时跟到底部。
  - 没有输出时显示一句话：运行中是「还没有输出」，结束后是「没有捕获到输出」。
  - 块的标题栏有清除按钮，清掉已结束的任务；没有已结束任务时置灰。
  - 任务结束时，时间线多一行：「后台命令已完成 · 描述 · 耗时」。
- 颜色、间距、圆角用 pig 的 token。
- 展开一条任务：`kind` 是 `bash` 时显示命令和输出；是 `agent` 时显示最近几步，点击打开子会话抽屉。
- 「清除已结束」只是界面上隐藏，按会话记在本地存储里。
- 输出里的终端颜色：现有依赖能渲染就渲染，不能就去掉颜色码显示纯文本，不为此新增依赖。

## 7. 提交

| PR | 提交 |
|---|---|
| A | 1. 会话状态搬到 `features/session/`。2. 拆 `use-session.ts`。3. `Task` 进 protocol，subagent 产出新形状，web 只认形状，解环。 |
| B | 4. 扩展：登记表、三个工具、结束通知、规格、落盘。5. gateway：事件总线、快照里的任务、停止命令、通知进时间线、有任务不销毁。6. web：Task 块按 cc-wrapper 重做，通知行。7. subagent 的 `background` 参数。 |

## 8. 验收

写成 `e2e/` 里的浏览器旅程，用现有的假模型驱动：

1. 开发服务器：模型启动一个持续输出的命令。工具行立刻结束，Task 块出现一条进行中的任务，输出在走。切到别的会话再切回，任务还在跑。点停止，任务变成已停止。
2. 测试：模型启动一个几秒后退出的命令，然后停下。命令退出后，模型被叫醒并开始新一轮，时间线出现通知行。
3. 长耗时命令失败：命令以非零退出码结束。任务显示失败，模型收到的通知里有退出码和输出末尾。
4. 后台 subagent：带 `background` 派出子任务，工具行立刻结束，Task 块显示代理任务，结束后模型被叫醒。

扩展的登记表、上限、超时、落盘和通知内容写单测。gateway 的「有任务不销毁」写单测。画面最后在真实应用里对照 cc-wrapper 逐点核对。

## 9. 留给实施时定的

- 协议里新命令、新事件、新时间线条目的具体名字，照现有命名习惯。
- 给模型读的通知文字的具体措辞，以及三个工具的英文说明。
- 任务通知行和 Task 卡片的具体组件拆分。
- `use-session.ts` 的具体切线，按闭包变量的归属定。
