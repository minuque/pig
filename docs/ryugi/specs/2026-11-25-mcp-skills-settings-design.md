# MCP 与 Skills 设置页：设计稿

2026-11-25 根据「新增 MCP 与 Skill 设置页」的 grill 讨论和随后的原型筛选写成。界面以精简版 Linear Drill 原型为准。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

现在要改 MCP server 和 Skill，只能手改 `mcp.json`、`settings.json` 和 `SKILL.md`，或者到终端里用 `pi mcp` 命令和 `/mcp`。设置弹窗里加两个页面，让用户在 pig 里完成日常操作：看有哪些、开关、测连接、登录、增删改、修坏掉的 `SKILL.md`。

第一版原方案能力太满，用户看了原型后要求精简。所以每个页面只分三层：列表 → 详情 → 编辑。每层一屏能看完，心智与「模型」页一致。低频或复杂的能力推到第二版，界面上只读展示或不展示。

## 2. 范围

要做：

- 设置弹窗新增「MCP」「Skills」两个页面，放在「模型」之后，导航顺序为：通用、外观、模型、MCP、Skills、通知、归档。两页接入设置弹窗现有的 `/` 搜索。
- gateway 新增两组 HTTP 路由，负责读写配置、探活、OAuth 登录登出、读写和删除 `SKILL.md`。
- 写入后让后续新开或重新打开的会话生效，不影响已经打开的会话。

不做（第二版或不做）：

- 任意项目的作用域选择器。第一版只有「全局」和「当前工作区」两档。
- 单个工具的暴露方式设置，以及通配符规则（`toolExposure`）编辑器。已有规则只读展示。
- `SKILL.md` 的 frontmatter 表单，以及「表单 / 源码 / 预览」三模式。第一版只有「预览 | 编辑源码」两种。
- 附属文件（`scripts/`、`references/` 等）的内容预览。只列文件名。
- 扫描目录的增删界面（`settings.json` 里 `skills` 的目录、glob 规则）。
- `enableSkillCommands` 与 `autoEnableCodemode` 两个开关的界面入口。已记为 [#79](https://github.com/minuque/pig/issues/79)。
- 项目信任（trust）管理界面。gateway 只在需要时代写 `trust.json`（见 3.3），不提供查看或撤销信任的界面。
- 聊天主界面的快捷入口。
- 远程浏览器场景下粘贴回调 URL 完成 OAuth。第一版只支持本机浏览器回调（我定的）。

### 2.1 第一步：Pi 升级到 1.6.0

动手写页面之前，先把 Pi 依赖从 1.5.0 升到 1.6.0（用户已定），单独作为一次提交：

- 要改的版本号：根 `package.json`，`packages/gateway/package.json` 里的 `@earendil-works/pi-ai` 和 `@earendil-works/pi-coding-agent`，`packages/environment` 和 `packages/extensions` 的 devDependencies。全部锁精确版本 `1.6.0`。装依赖时禁用生命周期脚本。
- 升级前读完 1.5.1、1.5.2、1.6.0 三段 changelog，评估对 pig 现有用法（`resource-loader.ts`、`SettingsManager`、扩展、会话）有没有影响，结论写进提交说明。
- 升级的理由：6.3 用 Pi CLI 做探活和 OAuth，1.5.1 修了其中几处问题。修之前，`pi mcp list` 对配了 `auth.provider` 的 server 不发 token，会误报「需授权」；token 刷新失败会破坏正在进行的 OAuth 登录；OAuth 登录成功后 `/mcp` 会卡在「Connecting…」好几分钟。
- 1.6.0 仍然没有导出 `loadMcpConfig` 等函数和 `McpOAuthCredentialStore`（已核对），所以 6.2、6.3 的做法不变。
- 升级后跑 `pnpm check:touched`、`pnpm test:electron`。有失败就先修好或停下来报告，再继续做页面。

## 3. 两页共有的部分

### 3.1 页面骨架

结构照 `ModelsPane.vue`：一个 pane 组件按状态切换「列表 / 详情 / 新建或编辑」，面包屑写进 `SETTINGS_TRAIL`。例如：`设置 / MCP`、`设置 / MCP / filesystem`、`设置 / MCP / filesystem / 编辑`、`设置 / Skills / grill-me`。

### 3.2 组合 toolbar

列表页顶部是一条组合 toolbar，用 `@pig/ui/toolbar` 组装（方向键在控件之间移动），从左到右依次是：

1. 搜索输入框，占满剩余宽度，按名称、说明、命令或 URL 过滤。
2. 漏斗按钮，按钮文字是当前作用域名（「全局」或工作区名）。点击打开 `DropdownMenu` 单选菜单，菜单里只列作用域名，不显示路径。作用域不是「全局」时按钮用 `--bg-selected` 高亮。
3. 分隔线，然后是「新增」（MCP）或「新建」（Skills）按钮。

样式参照 `NavHeader.vue` 的 `nav-toolbar`：一个 `control-bg` 加 `control-shadow` 的整体容器。

### 3.3 作用域

作用域有两档：「全局」，以及「当前工作区」。当前工作区取设置弹窗打开时活动会话的 `cwd`；没有活动会话时菜单里只有「全局」（我定的）。默认选「全局」。

在工作区作用域下：

- 工作区自己的条目正常显示、可编辑。
- 从全局继承的条目折叠成卡片下方一行「另有 N 个来自全局」，展开后只读。点击进入只读详情，详情里给「切到全局修改」按钮。
- MCP 的「项目覆盖」条目（工作区 `mcp.json` 里没有 `command`、`url`、`type`，只覆盖 `enabled`、`exposure`、`toolExposure` 的条目）照 Pi 的语义处理：它属于工作区条目，列表里显示，名字后加「项目覆盖」tag，开关和暴露方式改的是覆盖条目本身。它的详情页没有「编辑」，「删除」改叫「恢复全局」，即删掉这条覆盖。
- 界面上不新建覆盖条目（grill 时已定）。继承来的全局条目在工作区作用域下没有开关，也不能改暴露方式。

项目信任：pig 的会话对每个已知工作区都加载 `.pi/mcp.json` 和项目 Skill（`resource-loader.ts` 没有做信任判断），所以设置页的工作区作用域也始终可写，不显示「未信任」。但 Pi CLI（6.3）只认 `~/.pi/agent/trust.json` 里信任过的项目，否则看不到工作区定义的 server。用户已定：在 pig 里对某个工作区做「测试连接」或「OAuth 登录」时，gateway 先把这个工作区写入 `trust.json`，设为信任（见 6.3）。

### 3.4 路径分组

列表里的条目按来源文件或目录分组，每组一张 `CardList`。卡片左上角上方用小号等宽字显示路径（`--text-meta`、`--font-mono`、`--fg-muted`）：

- MCP：当前作用域的 `mcp.json` 路径，如 `~/.pi/agent/mcp.json`、`<工作区>/.pi/mcp.json`。
- Skills：`SKILL.md` 所在的扫描根目录，即 `filePath` 去掉 `/<skill 目录>/SKILL.md` 后的部分，如 `~/.agents/skills/`、`~/.pi/agent/skills/`、`<工作区>/.pi/skills/`、`D:/shared-skills/`。

### 3.5 列表行

每行只有：名称（MCP 名称后跟状态点）、一行说明、启停开关、右箭头。transport、exposure、工具数、来源徽标都不在列表上出现，进详情看。

有问题的条目不另起顶部 Banner，而是作为行出现在对应分组里，名字后加黄色 tag（`Badge` `soft` `warning`），说明行写原因：

- MCP：`mcp.json` 里无效的条目（例如 `sse` 传输），tag「未加载」，不可点击。
- Skills：Pi 没有加载的 `SKILL.md`（扫描诊断里有它的路径，但加载结果里没有它），tag「未加载」，点击进入详情并直接打开编辑。
- Skills：同名冲突。如果列表里有同名 Skill，tag「同名冲突」加在那一行上，悬停显示原因；没有同名行时单独占一行。

这些问题行也按搜索词过滤。

### 3.6 生效时机

两页的任何写入完成后，gateway 清掉 `WorkspaceResources` 里预热好的 resource loader（全局改动清全部，工作区改动只清该工作区），这样下一个新开或重新打开的会话会读到新配置。已经打开的会话不动。写入成功后用 toast 告知「新会话生效」（我定的）。

## 4. MCP 页

### 4.1 列表

- toolbar（见 3.2），按钮文字「新增」。
- 当前作用域 `mcp.json` 的一张卡片（见 3.4、3.5）。开关直接改 `enabled`。
- 工作区作用域下，全局条目折叠在「另有 N 个来自全局」里。
- 列表打开时只读静态配置，不连接任何 server。状态点在没有探活结果时显示「未测试」；已停用的显示「已停用」；`mcp-auth.json` 里没有凭据而 server 需要 OAuth 时，以上一次探活结果为准。

### 4.2 详情

从上到下：

1. 标题：名称加状态点（未测试、连接中、已连通、需授权、连接失败、已停用）。下面一行等宽字显示命令（`command` 加 `args`）或 URL，再下面是 `mcp.json` 里的 `description`（有才显示；CLI 不返回 server 的 instructions，所以不显示它）。
2. 操作按钮：「测试连接」（已连通后改叫「刷新工具」）；HTTP server 有「OAuth 登录」或「退出 OAuth」；「编辑」；「删除」（`danger`，`AlertDialog` 确认）。只读条目只有「测试连接」和「切到全局修改」。
3. 探活失败或需要授权时显示 `Banner`（`warning`），内容是 CLI 返回的错误文字（stdio 的 stderr 末尾已经拼在里面）。
4. 「暴露方式」一行：说明加 `Select`，取值 `codemode`、`deferred`、`direct`、`hidden`，说明文字随选择变化。只读条目禁用。
5. 「工具 · N」：探活后列出工具名（等宽），只读。`pi mcp list --json` 不给工具说明，所以只有名字。没探活时显示「测试连接后列出工具。」
6. 「mcp.json 中的工具规则」：已有 `toolExposure` 条目时才显示，只读列出模式和取值。

### 4.3 新增与编辑

表单沿用原型 `McpServerForm.vue` 的字段：名称、transport（stdio / streamable HTTP）、stdio 的命令与参数、HTTP 的 URL、`env` 或 `headers` 的键值行、说明、暴露方式、启用。`timeout`、`cwd`、OAuth 客户端参数和 `auth.provider`（只允许全局）收在「高级设置」折叠区里。

`env` 和 `headers` 的值：`${VAR}` 和 `!cmd` 这类引用型的值明文显示；其他字面量默认掩码，每行有眼睛按钮切换（grill 时已定）。所以 GET 接口原样返回这些值。这与 provider 接口「密钥只写不读」不同；gateway 的远程访问已经要求鉴权，这里不再另加限制（我定的）。

新增页顶部有「粘贴 JSON 导入」按钮，打开导入对话框（原型 `McpJsonImportDialog.vue`）：

- 同时接受整段 `{ "mcpServers": { … } }` 和单个 server 对象。单个对象需要另填名称。
- 写入前预览，与现有条目重名的逐个勾选是否覆盖。
- 解析和冲突比较在前端做，确认后逐个调用保存接口（我定的）。

保存时只改动这一个条目，文件里的其他内容和缩进保持不变。改名等于删除旧名再写新名。

### 4.4 探活

用户点「测试连接」时，gateway 临时连接一次，拿回状态、工具名列表和错误文字，然后断开。结果在 gateway 内存里按「作用域 + 名称」缓存，列表的状态点读这份缓存；gateway 重启后缓存清空（我定的）。

实现方式见 6.3。

### 4.5 OAuth

HTTP server 没有 `Authorization` header 且服务端返回 401 时，状态是「需授权」，详情页出现「OAuth 登录」。

登录流程照模型页的 `provider-login.ts` 与 `ProviderLoginPanel.vue`：开一个登录会话，前端轮询事件，可以取消。gateway 打开本机浏览器去授权页，回调完成后写入 `~/.pi/agent/mcp-auth.json`，然后自动重新探活。「退出 OAuth」删掉这个 server 的凭据。凭据按「名称 + URL」存储，与 Pi CLI 共用同一个文件。

## 5. Skills 页

### 5.1 列表

- toolbar（见 3.2），按钮文字「新建」。
- 按扫描根目录分组的卡片（见 3.4），包括标准目录（`.pi`、`.agents`）、祖先目录里的 `.agents/skills`，以及 `settings.json` 里 `skills` 配的额外路径。
- 开关改的是当前作用域 `settings.json` 里的 `skills` 数组：停用时加一条精确排除 `-<SKILL.md 路径>`，启用时删掉这一条。这是 Pi 自己的语义，CLI 也认（见 Pi `docs/settings.md` 的 Resources 一节）。
- 工作区作用域下，全局 Skill 折叠在「另有 N 个来自全局」里，只读。

### 5.2 详情：预览与编辑在同一页

从上到下：

1. 标题：名称；`disable-model-invocation: true` 时加「仅手动」tag；未加载的加「未加载」tag。下面是说明和 `SKILL.md` 完整路径（等宽）。
2. 一行：左边是「预览 | 编辑」分段切换（`TabsList` `segmented`），右边是「删除」（`ghost` `danger`）。只读 Skill 不显示这一行，改为「切到全局修改」按钮。
3. 预览：渲染正文 Markdown。预览显示的是编辑框里的当前内容，所以没保存的改动也能预览。
4. 编辑：`SKILL.md` 全文的等宽文本框。校验照 Pi 的实际规则（我定的）：frontmatter 解析失败或缺 `description` 时 Pi 不加载，这时在下面显示红色错误（`--danger-text`），「保存」不可用；`name` 缺省（Pi 用目录名）或不合规范时 Pi 只给警告、照样加载，这时显示黄色警告，可以保存。没有改动时「保存」和「放弃修改」都不可用。保存后留在详情页，切回预览。
5. 附属文件：目录下除 `SKILL.md` 以外的文件，只列相对路径，不能预览。

从「未加载」行进入时直接打开「编辑」。修好保存后，它变成正常 Skill，页面停在它的详情。

删除用 `AlertDialog` 确认，正文写出将删除的完整目录。目录不在当前作用域标准目录下（自定义目录、祖先目录）时，确认按钮文案改成「仍然删除」（我定的）。

### 5.3 新建

只填两项：名称、什么时候用（即 `description`）。下面实时显示写入路径：全局 `~/.pi/agent/skills/<name>/SKILL.md`，工作区 `<工作区>/.pi/skills/<name>/SKILL.md`。第一版不提供切换到 `.agents/skills/`（我定的）。名称必须是小写字母、数字和单个连字符（新建时严格一些，因为它同时是目录名，我定的），重名时报错。创建后生成模板（frontmatter 加一个标题和一行占位正文），然后进入这个 Skill 的详情并打开编辑。

## 6. gateway 与协议

### 6.1 路由

新路由加在 `packages/protocol/src/http.ts` 和 `packages/gateway/src/server/` 里，与现有路由同样的写法。现有的 `GET /api/v1/platform/skills` 只给输入框 `/` 补全用，不改。

`scope` 取值是 `"global"`，或者一个工作区路径。工作区路径都要先过 `hostService.isKnownWorkspace`，不通过就返回 403，与 `GET /api/v1/platform/skills` 一致。

MCP：

- `GET /api/v1/platform/mcp?scope=` → `{ file, servers, inherited, invalid }`。`servers` 和 `inherited` 的每项带名称、transport、`enabled`、`exposure`、`description`、`command`/`args`/`cwd`/`env` 或 `url`/`headers`、`timeout`、`oauth`、`authProvider`、`override`（是否项目覆盖）、`toolExposure`。`invalid` 是 `{ name, message }[]`。
- `PUT /api/v1/platform/mcp/server`，body `{ scope, name, previousName?, config }`：新增或替换一个条目。
- `PATCH /api/v1/platform/mcp/server`，body `{ scope, name, enabled?, exposure? }`：开关和暴露方式，只改这个作用域文件里已有的条目（包括覆盖条目）。
- `DELETE /api/v1/platform/mcp/server`，body `{ scope, name }`。
- `POST /api/v1/platform/mcp/probe`，body `{ scope, name }` → `{ status, tools, instructions?, error?, stderrTail? }`。
- `GET /api/v1/platform/mcp/probes?scope=` → 缓存里的探活结果，按名称索引。
- OAuth：`POST /api/v1/platform/mcp/login`（body `{ scope, name }`，返回 `{ loginId }`）、`GET …/login/:loginId/events`、`POST …/login/:loginId/cancel`，事件形状复用 provider 登录；`POST /api/v1/platform/mcp/logout`，body `{ scope, name }`。

Skills：

- `GET /api/v1/platform/skill-settings?scope=` → `{ skills, inherited, diagnostics }`。`skills` 每项是 `{ name, description, filePath, baseDir, enabled, disableModelInvocation }`；`diagnostics` 每项是 `{ kind: "broken" | "collision", path, message, name? }`。Pi 的诊断只有 `warning`、`error`、`collision` 三种：路径不在加载结果里的记为 `broken`，`collision` 照搬，只是警告而 Skill 已加载的不返回。
- `GET /api/v1/platform/skill-settings/file?path=` → `{ raw, files }`，`files` 是附属文件的相对路径。
- `PUT /api/v1/platform/skill-settings/file`，body `{ path, raw }`。
- `POST /api/v1/platform/skill-settings`，body `{ scope, name, description }` → `{ filePath }`。
- `PATCH /api/v1/platform/skill-settings/enabled`，body `{ scope, filePath, enabled }`。
- `DELETE /api/v1/platform/skill-settings`，body `{ path }`，删除 Skill 所在目录。

`path` 一律要先校验：必须是这次扫描结果里某个 Skill 的 `filePath`，或某条诊断的 `path`。不是就返回 403，防止借接口读写任意文件。

### 6.2 读写配置文件

Pi 1.5.0 有 `loadMcpConfig`、`updateMcpServerConfig`、`addMcpServerConfig`、`removeMcpServerConfig`，但它们不在 `@earendil-works/pi-coding-agent` 的公开导出里（`package.json` 的 `exports` 只有 `.` 和 `./rpc-entry`）。所以 gateway 新建 `packages/gateway/src/pi/mcp-config.ts`，按 Pi `docs/mcp.md` 写明的规则自己读写（我定的）：

- 全局文件 `<agentDir>/mcp.json`，工作区文件 `<cwd>/.pi/mcp.json`，同名时工作区条目替换全局条目。
- 工作区条目没有 `command`、`url`、`type` 时，只覆盖全局同名条目的 `enabled`、`exposure`、`toolExposure`。
- `enabled: true` 和 `exposure: "codemode"` 是默认值，写入时删掉这个键；覆盖条目例外，保留默认值。
- 只改目标条目，其他内容原样保留，按文件原来的缩进写回。

Skills 的扫描不用 `loadSkills`：它不扫 `~/.agents/skills` 和祖先目录的 `.agents/skills`，也不认识 `-path`。改用公开导出的 `DefaultPackageManager` 解析资源，它的结果带 `enabled` 标记，被 `-path` 排除的 Skill 也在里面；再用 `DefaultResourceLoader` 拿 `skills` 和 `diagnostics`。开工时先确认 `DefaultPackageManager` 的结果确实覆盖 3.4 列的全部来源。`settings.json` 用 Pi 公开的 `SettingsManager` 读写（`getSkillPaths`、`setSkillPaths`、`setProjectSkillPaths`）。

### 6.3 探活与 OAuth：复用 Pi CLI

`mcp-auth.json` 的读写（`McpOAuthCredentialStore`）同样不在公开导出里，自己仿写它的文件格式太脆。所以探活和 OAuth 通过子进程调用依赖里自带的 Pi CLI（`@earendil-works/pi-coding-agent` 的 `bin`：`dist/bundle/cli.js`），用 Pi 自己的实现（我定的）：

- 登录：`pi mcp login <name> [--local] --timeout <秒>`，cwd 是工作区。只有条目定义在工作区 `.pi/mcp.json` 里时才加 `--local`；继承来的全局条目和覆盖条目不加（CLI 对不是项目定义的条目加 `--local` 会报错）。子进程的输出转成登录事件；取消就结束子进程。
- 登出：`pi mcp logout <name> [--local]`，`--local` 的规则同上。
- 探活：`pi mcp list --json` 会连接当前配置下所有启用的 server，只能整组探。点某个 server 的「测试连接」时，gateway 跑一次 `list --json`，用结果刷新这个作用域全部 server 的缓存（我定的）。停用的 server 不会被 `list` 连接，所以停用的不显示「测试连接」。

工作区作用域下，每次调用 CLI 之前，用 Pi 公开导出的 `ProjectTrustStore`（`new ProjectTrustStore(agentDir).set(cwd, …)`）把这个工作区记为信任，已经信任的跳过。决定值的取法照 `ProjectTrustDecision` 类型，开工时确认。副作用：之后用户在这个目录直接运行 Pi CLI 也视为已信任。这与 pig 会话本来就加载项目配置的行为一致，用户已接受。

在 Electron 的 gateway 进程里用 `process.execPath` 启动 CLI，并设置 `ELECTRON_RUN_AS_NODE=1`。子进程要设超时（探活 60 秒，登录 5 分钟，我定的），gateway 退出时一并结束。

`pi mcp list --json` 的输出已经对过 `dist/extensions/mcp/cli.js`：有状态（`connected`、`needs-auth`、`disabled` 等）、工具名（没有说明）和错误文字（stderr 末尾拼在里面）；没有 instructions。只要有一个 server 没连上，退出码就是 1，所以不能按退出码判断成败，要解析输出。

### 6.4 让新会话生效

`WorkspaceResources` 加一个方法 `invalidate(workspace?: string)`：不传参数时清掉全部 slot，传了就只清这个工作区的 slot（用 `canonicalizePath` 规范化）。已经被 `take` 走的 loader 不受影响。两组写接口成功后调用它。

## 7. 前端

- 新目录 `apps/web/src/features/settings/components/mcp/` 和 `…/skills/`，入口分别是 `McpPane.vue`、`SkillsPane.vue`，在 `SettingsDialog.vue` 的导航和 pane 映射里注册。图标用 `@lucide/vue`。
- toolbar 抽成一个共用组件（原型 `LeanToolbar.vue`），放在 `features/settings/components/` 下。
- 数据请求放在 `features/settings/hooks/` 里，照 `use-providers.ts` 的写法。
- 所有文案进 i18n，不写死中文。
- 能用 `@pig/ui` 的都用它：`CardList`、`CardRow`、`Switch`、`Badge`、`Banner`、`Select`、`TabsList`、`DropdownMenu`、`AlertDialog`、`Collapsible`、`Toolbar`、`Field`、`TextFieldRoot`。Markdown 预览复用仓库里现有的 Markdown 渲染，不用原型里手写的 `markdown.ts`。
- 每个 `.ts` 或 `.vue` 文件不超过 500 行，不写注释（AGENTS.md）。

## 8. 测试与验收

单测只测产品假设和数据路径（AGENTS.md）：

- `mcp-config.ts`：同名时工作区替换全局；覆盖条目只覆盖三个字段；写入只改目标条目，其他内容和缩进不变；默认值删键而覆盖条目保留默认值。
- Skills 启停：停用写入 `-path`，启用删掉它，`settings.json` 里的其他条目不变；停用的 Skill 仍出现在列表里，且 `enabled: false`。
- 路径校验：不在扫描结果里的 `path` 返回 403。
- `invalidate`：写入后下一次 `take` 拿到的是新 loader。
- 工作区作用域探活前，`trust.json` 里这个工作区被记为信任；已信任时不重复写。

e2e（`e2e/`）各写一条整页旅程：

- MCP：打开设置 → MCP → 新增一个 stdio server → 列表出现 → 进详情 → 关掉开关 → 删除。
- Skills：打开设置 → Skills → 新建 → 在编辑里改正文 → 保存 → 预览里看到改动 → 删除。

验收按 AGENTS.md：`pnpm fix:touched` → `pnpm check:touched`；改了 gateway，还要跑 `pnpm test:electron`。

## 9. 原型

- 精简版原型：`apps/web/prototypes/mcp-skills/variants/LeanDrillVariant.vue` 和 `variants/lean/`，打包后的 `apps/web/prototypes/mcp-skills.html` 里按 `4` 切换。数据是假的，只用来确认布局和交互，不要照搬实现（例如原型的 `store.ts`、`markdown.ts`）。
- 原型里 3 个旧方案（Linear Drill、Inline Expand、Split Inspector）已被否决：原 Linear Drill 内容太满，另两个与「模型」页的结构差太多。
- 原型目录 `apps/web/prototypes/` 没有提交。正式实现完成后删掉。

## 10. 风险

- 6.2 和 6.3 都绕开了 Pi 的内部函数（截至 1.6.0 都没有公开导出）。Pi 升级时如果改了 `mcp.json` 的语义或 CLI 的输出格式，这两处要跟着改。升级 Pi 时要看这部分的 changelog。
- 6.3 里对 `pi mcp list --json` 输出的核对是在 1.5.0 上做的。升到 1.6.0 后要再对一次。
- `pi mcp list --json` 每次连接整组 server。stdio server 多时，一次探活可能要几秒到几十秒，按钮要一直显示 loading，直到结果回来或超时。
