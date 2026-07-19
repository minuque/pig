# no-pi-no-gang-v2 的 DESIGN.md 选型

## 结论

**最终单一推荐：[`cursor/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/cursor/DESIGN.md)。**

Top 3：

1. **Cursor**：最接近“Session 侧栏 + 聊天 + 代码 + 终端 + agent 工具时间线”的工作台骨架；作为唯一视觉母版最稳。
2. **OpenCode**：终端、代码、语义状态和紧凑交互较强，但其单一等宽字体与 manpage 风格不适合作为整个 Web 工作台的默认阅读界面。
3. **Claude**：代码窗口、表单、语义色和明暗表面覆盖较均衡，但文档明确以营销面为主，真实聊天历史侧栏与消息工具组件不在范围内。

**不建议混合多个 DESIGN.md。** 采用 Cursor 的颜色、字体、圆角、间距、边框和组件语法作为唯一视觉宪法；OpenCode、Claude 只用于发现缺口，不导入其品牌色、字体或形状。缺失组件应在 Cursor 语法内补齐，而不是把 OpenCode 终端皮肤、Claude 珊瑚色和其他候选拼成第三套系统。

Apple 明显不合适：其文档把自身定义为摄影优先、低密度的营销画廊；表单只有搜索框，验证状态和暗色 utility card 均明确缺失。这与高密度、多 Session、持续流式状态的本地 coding-agent 工作台方向相反。

---

## 1. 口径与证据边界

### 已核验事实

- 通过 agent-reach 的 GitHub 路由，使用 `gh CLI` 读取 `VoltAgent/awesome-design-md`。
- 所有链接固定到提交 [`664b3e78fd1a298ba11973822da988483256d4b4`](https://github.com/VoltAgent/awesome-design-md/tree/664b3e78fd1a298ba11973822da988483256d4b4)，避免后续主分支变化影响结论。
- 完整阅读了指定的 8 个候选：Cursor、Linear、Raycast、Warp、OpenCode、Claude、Superhuman、Notion；同时读取 Apple 基线，并额外检查了 Sentry。没有采用官网观感、社区评价或仓库 README 替代 `DESIGN.md`。
- 多数文档明确分析的是**营销页面**，即使其中包含真实产品截图，也不能把截图中未文档化的控件视为已有规范。
- Warp、Superhuman、Sentry 的文件标题/描述明确称为 “Inspired interpretation”；其证据强度低于直接分析文档。Warp 的 app shell、auth、modal、toast 还是 `Examples (illustrative)`，不能当作已观察到的产品组件。

### 针对本项目的判断前提

no-pi-no-gang-v2 是 Vue Web 工作台，不是营销站。核心画面应长期承载：多 Session 列表、聊天 transcript、流式输出、tool call、代码/差异、命令或终端样式、审批、连接与错误状态；同时需要认证/配置表单，以及完整 light/dark。因而评估优先级是“产品工作台语法”高于“品牌首页表现力”。

---

## 2. 候选文档中的事实

### Apple（基线，淘汰）

[`apple/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/apple/DESIGN.md)

- 文档自述为 photography-first、museum gallery、极低密度；产品 tile 通常占据约一个 viewport。
- 组件集中在商品 tile、商店卡、配置器、导航和 CTA；输入只有 `search-input`。
- Known Gaps 明确写出：未出现表单验证/错误状态，也未出现 store/accessories utility card 的 dark-mode 对应项。
- 没有 Session、聊天、代码、终端或工具调用组件。

### Cursor

[`cursor/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/cursor/DESIGN.md)

- 以暖奶油色 light canvas、白色 card、hairline、8px 按钮/输入、12px 卡片为主，无 drop shadow。
- `ide-mockup-card` 明确包含 sidebar、main editor、chat panel、terminal；代码面统一使用 JetBrains Mono 13px。
- 提供 Thinking、Grepping、Reading、Editing、Done 五类 agent timeline pill，并要求这些颜色只用于产品内 agent timeline。
- 有 success/error 色、primary active、disabled text 和标准输入，但 Known Gaps 明确写出：产品内 editor/chat/timeline 只由营销 mockup 部分覆盖；表单 focus 以外的验证未出现；没有 dark mode。
- CursorGothic 为授权字体；文档给出 Inter 替代建议。

### Linear

[`linear.app/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/linear.app/DESIGN.md)

- 单一深色营销 canvas，四级暗色 surface ladder + hairline，主要视觉是 issue list、project view、dashboard 等产品截图。
- 提供 compact button/input、focused input、status badge、changelog row 和 mono token。
- Known Gaps 明确写出 light mode 未文档化、表单错误/验证未出现；产品内更丰富的 priority/label 色只存在于 mockup。
- 没有聊天、Session 列表或终端组件规范。

### Raycast

[`raycast/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/raycast/DESIGN.md)

- 视觉语法接近命令面板：连续暗色模式、四级 surface ladder、6–10px 紧凑圆角、hairline、command-palette row、active row、keycap、search、tabs 和 disabled button。
- 文档提到产品截图覆盖 command palette、store、AI chat，但同时在 Known Gaps 中说明真实 in-product app chrome 并未作为独立系统文档化。
- 提供 blue/red/green/yellow 语义色及 soft 版本，但这些颜色也兼任扩展类别插画色。
- Known Gaps 明确写出：dark only、无验证状态、无 authenticated chrome。
- 营销面没有 monospace 主代码系统；不适合作为代码 transcript 的完整规范。

### Warp

[`warp/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/warp/DESIGN.md)

- 文档明确是 inspired interpretation；核心是暖暗色 canvas、Inter + DM Mono、紧圆角（按钮 3px、卡片 4px）、terminal mockup、hairline、无 shadow。
- 与开发工具气质接近，代码/终端文字角色清晰。
- 没有独立 success/warning/error palette，正文明确说营销页面未呈现这些语义色。
- 只有 dark canvas。Session、聊天和 agent tool lifecycle 没有规范。
- `ex-app-shell-row`、`ex-auth-form-card`、`ex-modal-card`、`ex-toast` 是文件内标注的 illustrative auto-derived examples，不能视为观察事实。

### OpenCode

[`opencode.ai/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/opencode.ai/DESIGN.md)

- 全站使用 Berkeley Mono，浅暖 canvas + 单个深色 TUI hero；4px 交互圆角、0px 容器圆角、ASCII 标记、hairline，无 shadow/gradient。
- 提供 TUI prompt row、install snippet、text input、textarea、tab、disabled、active，以及 accent/warning/danger/success 和对应部分 active ramp。
- `/enterprise` 表单覆盖使其表单基础强于多数开发工具候选。
- Known Gaps 明确写出：真实 OpenCode TUI 的完整 panels/status bar/keybindings 没有文档化，营销 hero 之外的 in-product TUI 不在范围；验证消息未出现。
- 没有 Session 列表和聊天 transcript 规范；全等宽字体会把长对话也渲染成终端文档。

### Claude

[`claude/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/claude/DESIGN.md)

- 暖 cream canvas、coral primary、cream card、dark product surface 三种表面；正文用 sans、展示用 serif、代码用 JetBrains Mono。
- 提供 product mockup、code window、输入 focus、primary disabled、success/warning/error、dark secondary button 等较完整基础。
- 开发者页面明确使用代码编辑器、terminal output、model comparison 等暗色产品卡。
- Known Gaps 明确写出：真实 `claude.ai` 的聊天气泡、消息工具、上传 chip、conversation history sidebar 不在范围；验证状态仍缺失。
- 三类表面是营销页面的节奏，不是完整的 light/dark 主题配对。

### Superhuman

[`superhuman/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/superhuman/DESIGN.md)

- 文档明确是 inspired interpretation，重点是深色人物 hero、白色营销正文、teal closing band、宽松 editorial whitespace。
- 虽然品牌原型是效率型邮件产品，文档本身没有收件箱/会话列表、消息密度、代码、终端或工具调用组件。
- 输入只有 neutral `text-input`；没有语义状态体系，也没有真正的 light/dark 配对。

### Notion

[`notion/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/notion/DESIGN.md)

- 提供真实 workspace mockup、table row、search、tabs、input focus、disabled primary、success/warning/error、dense pricing comparison 等较广组件。
- 8px 按钮/输入、12px 卡片、语义 token 和 Inter-based 字体容易转译到常规组件库。
- 代码/终端没有独立字体或组件；聊天与 Session 列表也没有规范。
- Known Gaps 明确写出：除 hero band 外没有具体 dark-mode token。
- 大量 pastel feature card 和装饰更偏营销叙事，不宜进入高密度工具工作区。

### Sentry（额外检查，未进入 Top 3）

[`sentry/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/sentry/DESIGN.md)

- 文档明确是 inspired interpretation，提供暗/亮两种页面 polarity、Monaco code block、input focus 和 developer-tool 品牌语法。
- 其亮暗面被分配给不同营销/交易页面，并非同一 app shell 的主题配对。
- 除 focus ring 外没有完整 error/warning/success 组件规范；Session、聊天、终端流和 tool lifecycle 仍缺失。

---

## 3. 针对 no-pi-no-gang-v2 的评分判断

评分为 **0–5**，是针对本项目的判断，不是仓库原始事实。加权：工作台 18%、Session/聊天 17%、代码/终端/tool 18%、表单/认证 10%、light/dark 12%、状态 10%、技术栈适配 8%、可直接采用/缺口可控性 7%。营销截图中出现但未文档化的控件不计为完整覆盖。

| 候选 | 工作台 | Session/聊天 | 代码/终端/tool | 表单/认证 | L/D | 状态 | Vue 栈适配 | 缺口可控 | 加权总分 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Cursor** | 4.0 | 2.5 | 5.0 | 2.0 | 1.0 | 3.5 | 4.5 | 3.0 | **65.7** |
| **OpenCode** | 3.5 | 1.5 | 4.5 | 3.5 | 2.0 | 4.0 | 4.0 | 3.0 | **64.3** |
| **Claude** | 3.0 | 2.0 | 4.0 | 3.5 | 2.5 | 4.0 | 4.0 | 3.0 | **63.6** |
| Notion | 4.0 | 2.0 | 1.0 | 4.0 | 1.5 | 4.0 | 4.5 | 3.5 | 56.5 |
| Warp | 4.0 | 1.5 | 4.5 | 2.5 | 1.0 | 1.0 | 4.0 | 2.0 | 54.3 |
| Raycast | 4.0 | 2.0 | 2.0 | 2.5 | 1.0 | 3.5 | 4.0 | 2.5 | 52.7 |
| Linear | 3.5 | 2.0 | 2.5 | 3.0 | 1.0 | 2.0 | 4.0 | 2.5 | 50.7 |
| Sentry | 2.5 | 1.0 | 3.0 | 3.0 | 2.5 | 1.5 | 4.0 | 2.5 | 48.1 |
| Superhuman | 2.0 | 1.0 | 0.5 | 2.0 | 2.0 | 1.0 | 3.5 | 1.5 | 30.9 |
| Apple | 1.0 | 0.0 | 0.5 | 1.0 | 1.5 | 0.5 | 3.0 | 1.0 | 18.2 |

### 评分解释

- **所有候选在 Session/聊天上都不完整。** Cursor 最高只是因为其明确给出 sidebar + editor + chat + terminal 的组合，并提供 agent timeline；并不意味着可以直接得到产品级 Session 列表和 transcript。
- **所有候选在 light/dark 上都不及格。** Claude 的多表面最接近双极性，但仍不是完整主题；不得把“页面里同时有浅卡和暗代码窗”误判成 dark mode。
- **OpenCode 与 Claude 总分接近 Cursor，但都存在更难逆转的全局语气问题。** OpenCode 的全等宽字体会伤害长聊天可读性；Claude 的 serif/coral/editorial 语气更像内容型 AI 品牌，而非本地开发工作台。
- **Notion 的基础组件覆盖好，但技术内容表达弱。** Warp 的技术内容表达好，但状态、主题与表单薄弱。两者都更适合作为局部灵感，而不是母版。

---

## 4. Top 3 详细比较

### 1. Cursor：最终推荐

**为何第一：** 八个维度没有全满分候选，Cursor 在最难后补的前三项——工作台骨架、聊天与编辑器邻接、agent tool 可视化——组合最完整。其暖浅色、hairline、无 shadow、8/12px 几何也足够中性，能由 Vue + Reka UI + shadcn-vue + Tailwind v4 实现，而不会强迫组件库模仿特殊 ASCII 或品牌插画。

**主要风险：** 原文仍是营销系统；dark mode、真实 Session list、完整 chat/tool parts、认证与验证都必须自行补齐。

### 2. OpenCode

**为何第二：** 代码、TUI、compact form、危险/警告/成功语义最直接，且规则简单一致。

**为何不选第一：** “每个字符都用 Berkeley Mono”是全局品牌决定，不适合长对话、设置表单和 Session 元数据；深色只作为单个 hero TUI，无法提供工作台 dark theme；实际 TUI 仍被列为 Known Gap。

### 3. Claude

**为何第三：** code-window、dark product surface、表单 focus/disabled 和 success/warning/error 比 Cursor 更完整，长文本可读性也好。

**为何不选第一：** 文档明确排除了真实 Claude 聊天产品的 conversation sidebar、chat bubbles 和 message tools；serif + coral 的编辑品牌语气会让本地 coding workbench 更像内容产品，且多表面不等于双主题。

---

## 5. Cursor 中可直接采用的规则

以下是**采用 Cursor 作为母版后可直接落地**的部分：

1. **基础尺度**：4px 基础间距；4/6/8/12/16px 圆角梯度；按钮与输入 8px，卡片 12px。
2. **表面与层级**：暖浅 canvas、白 card、1px hairline；不以 drop shadow 建层级。工作台分栏依靠 surface 与 border，而不是浮夸阴影。
3. **字体分工**：比例字体承担导航、Session 元数据、聊天正文与表单；JetBrains Mono 承担代码、diff、命令、路径、token 和 tool payload。CursorGothic 不直接依赖，使用文档允许的 Inter 替代。
4. **工作台构图**：把 `ide-mockup-card` 的 sidebar + main editor + chat panel + terminal 关系转译成 Session sidebar + conversation + 可选 inspector/terminal 的应用 shell。
5. **agent 时间线**：Thinking / Grepping / Reading / Editing / Done 使用独立、低饱和状态色；严格限制在 tool/agent timeline，不能扩散到普通按钮和导航。
6. **主操作纪律**：Cursor Orange 只承担 primary action 与关键运行信号；普通选择、hover、secondary action 留在中性色阶。
7. **技术内容密度**：代码 13px mono、卡片 16–24px padding 可作为桌面默认；营销用的 80px section rhythm 和 72px hero display 不进入 authenticated workspace。

---

## 6. 必须补齐的项目规则

这些缺口不能从 Cursor 原文假装推导出来，必须写入项目自己的 DESIGN.md。

### 6.1 App shell 与 Session 密度

- 三栏/两栏的最小宽度、可折叠与可调整规则；窄屏时 Session → transcript → inspector 的导航顺序。
- Session row 的高度、标题截断、cwd/repo、模型、更新时间、未读、favorite、active/running/queued/blocked/error/interrupted 状态。
- 当前 Session、键盘 focus、hover、多选、后台有新输出的视觉差异。
- 长列表虚拟化不改变 row 高度和 focus ring 的约束。

### 6.2 Chat、代码、终端与工具调用

- user/assistant/system/event/tool/permission/error 各类 transcript part；不使用营销式大气泡挤压代码宽度。
- streaming cursor、thinking collapse、tool call 输入/输出、elapsed time、exit code、retry、cancel、approval、copy 和 reveal-in-file。
- code block、inline code、diff add/delete/context、文件路径、诊断、命令输出、JSON payload、超长行横向滚动。
- tool timeline 的颜色映射必须和全局 success/warning/error 分离，避免 “Editing lavender” 被误解为警告或错误。

### 6.3 完整 light/dark

- 为 background/foreground/card/popover/muted/accent/border/input/ring/destructive 以及 code/diff/terminal/tool timeline 定义成对 token。
- dark theme 不能简单反相 Cursor cream；必须重建 surface ladder、边框对比、代码语法、selection、scrollbar 和 focus ring。
- 所有状态至少在 light/dark 各做一次对比度与辨识测试；不能只靠颜色区分。

### 6.4 表单与认证

- label、description、placeholder、required、disabled、read-only、focus、invalid、success、loading、password reveal、submit error。
- 本地 bootstrap/登录、远程登录、连接 daemon、API key/模型设置、危险确认与会话过期状态。
- Reka UI/shadcn-vue 组件的 default/open/checked/selected/disabled/invalid 等交互状态必须统一映射到同一 token，不另造组件私色。

### 6.5 系统状态与恢复

- info/success/warning/error/destructive；running/queued/pending-approval/cancelling/cancelled/interrupted。
- offline/reconnecting/connected、stale snapshot、replay gap、lagged、daemon unavailable、permission denied。
- toast、inline alert、banner、empty state、skeleton、error boundary、modal confirmation 的使用边界；严重错误不能只用 toast。

### 6.6 Vue + Reka UI + shadcn-vue + Tailwind v4 适配

- 将 Cursor 原始颜色先改写为**语义 token**，再由 Tailwind 与 shadcn-vue 消费；组件不得直接散落 `#f54e00`、timeline pastel 或 surface hex。
- Reka UI 负责行为与可访问状态，Cursor 规则只负责视觉；不要为了复刻营销 mockup 改写 headless 组件的键盘/焦点语义。
- 用 variant 管理 size/intent/state；不要为每种 tool 单独复制一套 card。
- 保留 shadcn-vue 的组件边界，优先补 token 与 variant，而不是把整页 mockup 写成不可复用的 Tailwind 长字符串。

---

## 7. 是否混合多个 DESIGN.md

**决策：不混合视觉系统。**

允许的边界只有：

- Cursor 是唯一 token、排版、圆角、间距、表面和普通组件来源。
- OpenCode 提醒项目必须覆盖 terminal semantic states；Claude 提醒必须覆盖 code-window、disabled、warning/error；这些是**需求清单**，不是视觉导入。
- 新组件必须先回答“如何用 Cursor 的 cream/card/hairline/8px/12px/JetBrains Mono/timeline 语法表达”，不能直接复制 OpenCode 的 ASCII、Claude 的 coral/serif、Raycast 的纯暗 command palette 或 Notion 的 pastel 卡。

只有未来出现一份明确 ADR，逐项列出“借入组件、借入原因、token 映射、适用边界、退出条件”，才允许例外。默认禁止无边界拼贴。

---

## 8. 最终决策

采用 [`cursor/DESIGN.md`](https://github.com/VoltAgent/awesome-design-md/blob/664b3e78fd1a298ba11973822da988483256d4b4/design-md/cursor/DESIGN.md) 作为 no-pi-no-gang-v2 的唯一上游 DESIGN.md：

- 保留 warm-light、hairline、低阴影、8/12px 几何、比例字体 + JetBrains Mono、agent timeline 的核心语法；
- 删除营销 hero/section 的大尺度规则，不把营销页密度带入工作台；
- 在同一语法内补齐 Session、chat/tool parts、认证、状态恢复和完整 dark theme；
- 不混入其他候选的品牌 token。

这不是“Cursor 已经完整”，而是“Cursor 的缺口最容易在不破坏整体一致性的前提下补齐”。
