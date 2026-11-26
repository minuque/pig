# 会话视图轮播、灵动岛、任务抽屉与提问浮板：设计稿

2026-11-26 经多轮问答与四份示意页定稿，用户批准「开始写 spec 动手」。标「我定的」的是设计者自定、用户没有逐条确认的取舍。

## 1. 目的

右侧停靠的文件面板会压窄对话区；以后还要加终端、浏览器，再往右边挤，体验更差。改成：一个 pane 里同一时间只显示一个视图，视图围绕当前会话，在标题栏中间的「灵动岛」里切换，切换时整页横滑。Chat 视图以外的视图里没有输入框，main 只做一件事。

一起做的还有三件事，都是为了让 main 保持专注：当前会话的提醒交给灵动岛，任务详情改成抽屉，扩展提问和 agent 提问改成贴在输入卡上方的浮板。

## 2. 范围

| 要做 | 不做 |
|---|---|
| 每个 pane 的视图轨道：Chat、Files，横向轮播 | Terminal、Browser 视图本身（等它们出现时加进视图列表） |
| 标题栏中间的灵动岛：收起、展开、提醒三态 | 扩展注册视图的接口（没有扩展要用，先不开） |
| 当前会话的提醒走灵动岛，toast 只管其余 | 同一会话左右各开一个视图（我定的：留到以后，本轮分屏规则不变） |
| 任务详情、子 agent 详情改成 ui-sdk `Drawer`；摘要常态仍独占一列（用户定的） | 摘要独立成一个视图（用户明确不要） |
| 扩展 `select` / `confirm` / `input` / `editor` 改成输入卡上方的浮板，替掉 `AlertDialog` | 改 Pi 扩展 UI 协议 |
| 内置 `ask` 工具：多题、选项说明、多选、直接回复；回答作为普通用户消息发回 | 从零实现 ask 工具（先复用社区现成实现，见 §8） |
| 删掉右侧面板列（`PanelColumn`、`panel-stack`） | |

## 3. 示意页

都在 `.show-me/`（未提交，只作参照；本节已写清结论）：

- `session-views-carousel.html`：A 横向轮播 / B 轮播 + 总览。**选 A**：标签加横滑。
- `session-views-island.html`：灵动岛三态与摘要抽屉（摘要抽屉已否掉，见 §9）。
- `island-notify.html`：方案 (b) 下各类提醒在岛上的样子。**选 (b)**。
- `ask-board.html`：提问浮板。用户改过三点：选项前加 radio / checkbox；补上能直接回复的选择题；去掉底部快捷键提示和倒计时；多题时页码两边能手动切题。

## 4. 视图与轮播

### 4.1 视图

- 视图列表：`chat`、`files`。顺序固定，Chat 永远第一个。
- 每个 pane 记自己当前的视图；写进 `pig.split` 的状态（左右各一个字段），旧数据没有这个字段时按 `chat` 读。
- 换会话时保留当前视图（我定的：在 Files 里点侧栏另一个会话，看到的是那个会话的文件）。欢迎页、新建会话强制回 Chat。
- 对话里的文件提及（`openFileKey`）等「打开文件」的入口，改为切到 Files 视图再打开文件。原来的 `files.open` 开关语义去掉。拖文件进输入卡仍是附件 / @ 提及，不变。
- 文件树条目拖进输入卡生成提及的能力，因为 Files 视图里没有输入卡而断开；改成条目上的「引用到对话」动作：插入 @ 提及并切回 Chat（我定的）。

### 4.2 轨道

- pane body 是一条横向轨道，视图并排，每个占满 pane 宽度；切换时 `transform` 平移，用 `motion.css` 里已有的缓动档，`prefers-reduced-motion` 下直接跳。
- Chat 永不卸载：滚动位置、流式输出、输入框草稿都保持。Files 第一次进入时才挂载，之后常驻。
- 不在当前位置的视图加 `inert`，不能被 Tab 到，也不被读屏读到。
- 视图之间不循环：到头就停。

### 4.3 切换方式

- 点灵动岛展开后的标签。
- 触控板横向滑动：横向分量占主导、超过阈值时翻一页，翻页之间有冷却，避免一次滑动翻多页。视图内部能横向滚动的内容（宽代码行、表格）先滚到头，才轮到翻页。
- `Ctrl/⌘ + 1…n` 直达。相邻翻页用 `Ctrl + ← / →`（用户定的），也认 `Ctrl + PageUp / PageDown`。焦点在有字的输入框里时 `Ctrl + ← →` 让给按词移动光标，输入框为空时照常翻页。
- 快捷键作用于当前聚焦的 pane。

### 4.4 删掉的东西

`PanelColumn.vue`、`lib/panel-stack.ts`、`createPanelHost` 与 `providePanelHost` / `usePanelHost`、`PaneBody` 里的停靠 / 盖住两种布局、`pig.files.split` 与 `pig.panels.*` 两组 `auto-save-id`、标题栏里的 Files 开关按钮。删掉之后没人引用的 i18n 键一起删。

## 5. 灵动岛

位置：标题栏水平居中；左边的面包屑、右边的按钮让出它的位置，pane 窄时面包屑先截断。

外观：扁平胶囊，`--bg-surface` 底 + 细线环，圆角 `corner-shape: round`，不用 iPhone 的纯黑（DESIGN.md：静止的工具栏不加阴影、毛玻璃）。弹出提醒时它比标题栏高、盖住正文上沿，这时算浮层，换 `--float-shadow`；收回后恢复扁平。宽高变化用弹簧缓动；内容切换只动透明度与轻微缩放。

三态：

| 状态 | 什么时候 | 显示 |
|---|---|---|
| 收起 | 默认 | 当前视图名 + `位置/总数` |
| 收起·运行中 | 会话在跑 | 脉冲点（cyan）+ 视图名 + 已用时间 |
| 展开 | 悬停、键盘聚焦、快捷键或横滑翻页后约 1.2 秒 | 所有视图的标签，选中底滑动 |
| 提醒 | 见 §6 | 一张小卡：状态点、标题、一行内容、动作 |

- 展开态用 `@pig/ui/tabs`（底层是 ui-sdk Tabs，自带方向键、ARIA 与选中指示），不自写分段控件。若 `@pig/ui/tabs` 缺滑动指示，先在 `packages/ui` 里补，再在业务里用。
- 已用时间的起点从会话已有数据里取（当前一轮的开始时间）；没有现成字段时，先看 `turn-timing` 扩展写的条目能不能用，不另造计时。

## 6. 提醒分工（方案 b）

当前 pane 正在显示的会话发生的事，由这个 pane 的灵动岛提醒；别的会话的事、全局错误、设置页反馈，照旧走右上角 `notify()` toast。同一件事只在一处出现。

| 事件 | 来源 | 在 Chat 视图 | 在其他视图 | 停留 |
|---|---|---|---|---|
| 回复完成 | `use-turn-finish.ts` 的干净结束 | 不弹（对话里看得到） | 弹，动作「回到 Chat」 | 4 秒，悬停暂停 |
| 这一轮出错 | 同上的 error 分支（原来是 transient toast） | 不弹 | 弹，动作「回到 Chat」 | 6 秒，悬停暂停 |
| 扩展 `confirm` | `extension-ui` | 用 §7 的浮板，岛不弹 | 岛上直接「拒绝 / 允许」 | 不自动收 |
| 扩展 `select` / `input` / `editor`，agent `ask` | `extension-ui` / §8 | 用 §7 的浮板，岛不弹 | 岛显示「等你选择」，点一下切到 Chat 并打开浮板 | 不自动收 |
| 扩展 `notify` | `extension-ui` | 弹 | 弹 | 4 秒 |
| 会话在别处有更新 | `use-session.ts` 的 `changedElsewhere` | 弹 | 弹 | 4 秒 |

- 几条同时到时排队，卡片右上角显示剩余数，一条收完下一条接上。
- 会话不在任何 pane 里显示时（后台会话），这些事件按原样走 toast；需要回答的提问，toast 带「打开」动作，打开后在那个会话里显示浮板（我定的）。
- `notifyTurnDone()` 的系统通知与提示音不变。
- 同步修改 DESIGN.md「控件」里的通知规则：当前会话的事件由灵动岛提醒，其余走 `notify()`。按 AGENTS.md 这需要用户确认，本设计稿即确认。

## 7. 提问浮板

位置和表面：贴在输入卡上方 8px，与 `/` 命令、`@` 文件浮板同一种菜单表面（`--float-bg` + `--float-shadow` + `--glass-filter`），挂 body；浮板打开时隐藏输入卡状态条，二者不叠放（DESIGN.md 现有规则）。

结构：

- 头部：状态点、来源（扩展名或题目 header）；多题时右侧有「‹ 页码 ›」手动切题；最右是 ✕（跳过）。
- 题目一行；`confirm` 的 message 用代码字体显示在题目下。
- 选项行：单选前面是 radio，多选是 checkbox；选项标签加粗一档，有说明时说明在下一行、弱色；右侧是数字键提示 `1…9`。
- 底部没有快捷键提示，也没有倒计时（用户要求）。扩展设了 `timeout` 时照样由 Pi 超时取消，浮板随请求关闭即可。

和输入卡的联动：

- 提问期间输入卡就是回答框：加强调色细环，原有草稿先收起，回答完放回原处。
- `select` / `confirm`：输入卡锁住，占位「从上面选一项」，只能选列表里的项（Pi 协议的 select 只认选项文本）。我定的：去掉示意第一版里的「打字筛选」，与 ask 的「打字即直接回复」不混用。
- `input`：输入卡用请求的 placeholder，Enter 提交。
- `editor`：prefill 放进输入卡，Shift+Enter 换行，Enter 提交。
- `ask`：见 §8。
- 发送键文字随状态变：「发送」→「选择」/「下一题」/「提交」。

键盘：数字键在输入卡为空时直接选；↑↓ 移动高亮，Enter 选中高亮项；输入卡为空时 ← → 切题；Esc 跳过（`confirm` 里等于拒绝，其他扩展请求回 `cancelled`）。

回答之后不在对话里另留记录（我定的：Pi 会话文件不记扩展回答，留记录要动 gateway 与协议；扩展自己会把结果交给 agent）。

实现：列表复用 `@pig/ui/trigger-menu`（与 `CommandMenu` 同一套）或 ui-sdk 现有的列表行为，不自写键盘导航；radio / checkbox 的外观取 `@pig/ui/radio-group`、`@pig/ui/checkbox` 的样子，但不能把选项放进 RadioGroup（它的方向键会改选中，会误触单选自动跳题）。`features/extension-ui/index.vue` 的 `AlertDialog` 整个删掉；同一会话同时只显示一个请求，其余排队，页码不计扩展请求。扩展请求优先于 ask（我定的：扩展请求阻塞 Pi 还可能超时）：ask 浮板开着时来了扩展请求，先显示扩展请求，ask 已选、已写的内容保留，扩展请求答完再回到 ask。请求状态按会话存，由显示该会话的 pane 渲染；现在 `provideExtensionUi(pi, focused)` 只跟聚焦会话，要改成按会话。

## 8. 内置 `ask` 工具

### 8.1 行为（已定）

- agent 调用 `ask`，这一轮结束（工具不阻塞等待）。
- pig 从对话记录里读出最后一个未回答的 `ask` 工具调用，用它的参数画 §7 的浮板。
- 用户的回答，不管是选项还是自己写的，作为一条普通用户消息发回 agent。消息格式每题一行：`<header>：<回答>`，多选用顿号连接（我定的，以 §8.2 复用的实现为准可调整）。
- 跳过（✕ / Esc）也发一条消息，说明用户跳过了提问（我定的：否则 agent 不知道为什么没有回音）。
- 提问期间没有「绕过浮板正常发消息」这条路：输入卡就是回答框；不想答就按 ✕ / Esc 跳过，再正常发消息（我定的）。不允许直接回复的题，输入卡锁住。
- 题型：1…N 道题；每题 header、question、options（label + description）、multiSelect、是否允许直接回复。
- 单选点一下 200ms 后自动跳到下一道没答的题；多选打勾后点「下一题」。在输入卡里打字时选项变灰、取消选中，这时的回答就是这段文字。切题时保留每题已选的项和已写的文字。「下一题」跳到下一道没答的题；全部答完按钮变成「提交」。
- 输入卡里的 `@` 文件引用等能力在回答里照常可用（回答就是普通消息）。

### 8.2 实现来源（2026-11-26 调研结论）

Pi 扩展市场里的 ask 类扩展（`@juicesharp/rpiv-ask-user-question`、`@arhen/pi-core-ask`、`@dreki-gg/pi-questionnaire`、官方 examples `question.ts` / `questionnaire.ts` 等，均 MIT）全部在 `execute` 里阻塞等 `ctx.ui.custom` 或 `ui.select`。pig 用 rpc 模式绑扩展，`custom` 返回 `undefined`，它们要么报错，要么退化成一题一个选择框，没有自定义回答。所以不直接依赖，自己写内置扩展，只照抄 rpiv 的参数 schema 与工具描述（MIT）。

- 位置：`packages/extensions/src/ask/`，工具名 `ask_user_question`，`exposure: "model-only"`，`executionMode: "sequential"`。
- 结束本轮：`execute` 返回 `terminate: true`（`pi-agent-core` 的 `AgentToolResult`；同批工具全部 terminate 才生效）。`promptGuidelines` 要求单独调用；同批其他调用只靠工具描述约束（我定的：`tool_call` 事件看不到同批其他调用，拦不全）。不用 `ctx.abort()`，否则本轮按中断收尾。
- 参数：`questions[1..4]{ question, header(≤16), options[2..4]{ label(≤60), description }, multiSelect?, allowCustom?(默认 true) }`。rpiv 的 `preview` 字段不收（浮板不画预览）。
- 前端判定：transcript 里最后一个 `ask_user_question` 工具调用之后没有用户消息、会话 idle → 显示浮板。该轮 assistant 的 `stopReason` 是 `toolUse`，不按中断渲染。
- 回答消息：每题一行 `<header>：<回答>`（§8.1）。

## 9. 摘要列与任务抽屉

- 摘要照旧：对话列够宽时 `RailSummary` 常驻对话列右侧独占一列，标题栏按钮开关并记住；窄时收成标题栏按钮下的 popover（`railModeOf`）。用户 2026-11-26 否掉了摘要抽屉。
- 任务详情、子 agent 详情（原 `RailPane` 进面板列的两种 pane）改成 ui-sdk `Drawer`：`side="right"`，`modal={false}`，开着时下面的视图照常能操作。抽屉挂在标题栏的 `RailToggle` 里，切到 Files 也不被 `inert` 盖住。
- 抽屉只盖住所在 pane，不盖另一侧 pane：pane 写 `--drawer-inset`，抽屉视口按它定位。
- 按 AGENTS.md 先读 ui-sdk skill 与 `node_modules/@ui-sdk/vue/docs/llms.txt`；`@pig/ui` 还没有 Drawer 封装，先在 `packages/ui` 按 `rendering.md` 加基础件，再在业务里用。

## 10. 验收

- 单测（只测产品假设与数据路径）：分屏状态读写带视图字段、旧数据兼容；提醒分工的判定（事件 × 当前视图 × 会话是否显示 → 岛 / toast / 不弹）；ask 回答拼成消息；扩展请求排队与对 ask 的优先。
- e2e（`e2e/workbench/`）：横滑与快捷键切视图后 Chat 滚动位置不变；对话里点文件提及切到 Files 并打开该文件；在 Files 里收到回复完成，岛弹出并能回到 Chat；扩展 select 浮板选中后回到原草稿；ask 两题切题、直接回复、提交后对话里出现那条用户消息；任务抽屉打开时下面的视图能点。
- `pnpm fix:touched` → `pnpm check:touched`；耗时、滚动相关跑 `pnpm test:bench`；看画面用 `pnpm dev:desktop`。
- design-lab 只维护整页 demo：把视图轨道、灵动岛三态、浮板加进 `FullPageDemo.vue` 的 fixture。

## 11. 留给实现者

- 灵动岛、轨道、浮板的具体尺寸、阈值与缓动档，从现有 token 里取，缺档先补 token。
- 状态与模块归属：视图状态放 `split-view`（它已经管 pane 状态）；灵动岛与提醒判定新建模块还是归入 `session-workbench`，按 CODEBASE.md「新领域先归既有模块」判断。
- 功能代码文件不超过 500 行（`WorkbenchHeader.vue` 已有 538 行，加灵动岛前先拆）。
- 提交按逻辑任务原子提交，建议顺序：视图轨道与删面板列 → 灵动岛 → 任务抽屉 → 提问浮板 → ask 工具 → 提醒分工与 DESIGN.md。
