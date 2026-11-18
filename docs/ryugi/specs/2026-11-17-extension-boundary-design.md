# 扩展边界：TUI 扩展默认不开，宿主里的 agent 行为搬进内置扩展：设计稿

2026-11-17 在架构评审对话里定稿。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

用户定的三条：

- 内置扩展（`packages/extensions`）是 pig 专属，不注册到本机 pi TUI。
- TUI 里注册的扩展有些只服务终端，在 pig 里默认不开，避免兼容问题。以后再做扩展管理和动态开关。
- 边界规则：**改 agent 行为的进扩展，改用户所见的留宿主。**

对照现状有两处不符：

1. `packages/gateway/src/pi/resource-loader.ts` 把 `agentDir` 和 `SettingsManager` 交给 `DefaultResourceLoader`。用户在 TUI 里装的扩展今天在 pig 里是**全部开启**的。
2. 宿主里有两段代码在改 agent 行为：`pi/turn-timing.ts`（往会话里写条目）和 `pi/file-mentions.ts`（发送前改写 prompt）。

## 2. 范围

| 要做 | 不做 |
|---|---|
| A. 用户扩展默认不加载，按白名单文件放行 | 扩展管理界面、运行中动态开关 |
| B. 回合计时与 @ 文件展开搬进内置扩展 | 列出已发现扩展的接口 |
| 去掉内置扩展包「TUI 里也能装」的声明 | 把通道名、条目名收进一个共用模块 |
| | `extension-ui.ts` 读私有主题键的问题 |

A 和 B 互不依赖，可以分开做、分开提交。

## 3. A：用户扩展默认不开

### 3.1 关哪些（用户确认）

| 来源 | pig 里 |
|---|---|
| `settings.json` 的 `packages` 带来的扩展 | 默认关 |
| `~/.pi/agent/extensions` 下的扩展 | 默认关 |
| 项目 `.pi/extensions` 下的扩展 | 默认关 |
| pig 内置扩展（`subagent`、`remote-workspace`、`tasks`，以及 B 新增的） | 永远开 |
| 照 CLI 加上的三个（codemode、tool-search、MCP） | 不变，启用与否仍看用户的 pi 设置 |
| skills、prompt 模板、AGENTS.md、`mcp.json` | 不变，继续共用 |

用户已知的后果：靠扩展注册的模型供应商、斜杠命令、工具，会从 pig 里消失，直到单独放行那个扩展。

### 3.2 怎么放行

白名单文件 `~/.pig/extensions.json`（pig 自己的目录，不写 pi 的 `settings.json`）：

```json
{ "enabled": ["npm:some-pi-package", "C:/Users/me/.pi/agent/extensions/foo.ts"] }
```

- 包来的扩展，键是 `settings.json` 的 `packages` 里写的那个来源字符串。目录下的扩展，键是文件或目录的路径。（我定的）这两样用户自己都认得，不用界面也能手写。
- 文件不存在或解析失败：按空白名单处理。解析失败在网关日志里报一次。
- 建资源加载器时读一次。改了文件，新开的会话生效；这一版不做热更新。
- 路径可以经 `GatewayOptions` 注入，测试与基准指向临时文件。

### 3.3 怎么不加载

目标是被关的扩展**代码不执行**，不是加载后再摘掉。扩展的工厂函数在加载时就会跑，可能当场注册供应商或起子进程。

SDK 给了几个入口（`DefaultResourceLoaderOptions`）：`extensionsOverride`、`noExtensions`、`additionalExtensionPaths`、`extensionFactories`。

**先验证再定做法。** 用一个加载时写标记文件的临时扩展，确认哪种组合能做到「没放行就不执行」。优先顺序（我定的）：

1. `extensionsOverride` 过滤。只有它发生在工厂执行之前才算数。
2. `noExtensions: true`，再把内置扩展和放行的扩展经 `additionalExtensionPaths` 加回来。要确认 `noExtensions` 不会连 `additionalExtensionPaths` 和 `extensionFactories` 一起关掉。
3. 两种都做不到：停下报告，不要自己解析 pi 的包目录。

`Extension.sourceInfo`（`source`、`scope`、`origin`）能区分来源，过滤和匹配白名单用它。

### 3.4 顺带

- `packages/extensions/package.json` 去掉 `keywords` 里的 `pi-package` 和描述里「pi TUI 里也能安装使用」。`pi.extensions` 字段是否还需要，看网关是否靠它加载（今天网关是按路径加载的）。
- `docs/directory-structure.md` 里「pi TUI 里也能装」同步改掉。

## 4. B：两段 agent 行为搬进内置扩展

### 4.1 回合计时

今天：`PiHostSession` 在 `prompt()` 里驱动 `TurnTimingRecorder`，往会话写 `pig.turn-timing` 条目（先一条 `running`，结束再一条终态）。读取在 `readTurnTimings`。

改成：新内置扩展 `packages/extensions/src/turn-timing/`，用扩展事件记录并用 `pi.appendEntry` 写同样的条目。

- 条目的类型名和数据形状不变（`TurnTiming`）。旧会话照常读。
- `readTurnTimings` 留在网关。读会话文件是宿主的正常消费。
- 语义要对齐现有实现，逐条核对：
  - `startedAt` 是收到用户输入的时刻，不是模型开始应答的时刻。
  - `userId` 是这条用户消息落盘后的条目 id。
  - 终态：正常结束 `complete`，助手消息 `stopReason` 为 `error` 记 `error`，为 `aborted` 记 `aborted`；一旦记了 `aborted` 不再被覆盖。
  - prompt 在模型应答前就抛错，也要落一条 `error` 终态。

### 4.2 @ 文件展开

今天：`PiHostSession.prompt()` 和 `steer()` 在交给 pi 之前调用 `expandFileMentions`，把 `@path` 换成 `<file>` 文本块。远程会话读远端文件。

改成：新内置扩展 `packages/extensions/src/file-mentions/`，监听 `input` 事件，返回 `{ action: "transform", text }`。

- 展开规则、上限、输出形状原样搬过去，现有单测（`packages/gateway/test/file-mentions.test.ts`）跟着搬。
- 远程会话的环境从会话里的 `pig.remote` 绑定取，做法照 `remote-workspace` 扩展。
- `input` 在 steer 时也会触发（`event.streamingBehavior === "steer"`），两条路径都要覆盖。
- 网关里删掉 `expandMentions` 及其两处调用。

一处行为变化要知道：pi 先查扩展命令，命中就不触发 `input`。所以 `/某扩展命令 @file` 里的 `@file` 不再展开。今天是先展开再交给 pi。（我定的：接受。扩展命令的参数本来就该由命令自己解释。）

## 5. 约束

- 守 `AGENTS.md`。内置扩展只用公开 Extension API。
- 网关不给扩展开私有接口；扩展与宿主之间只走会话条目和 `pi.events`。
- `packages/gateway/src/pi/service.ts` 现在 498 行，不要让它再过 500。
- 不引入新依赖。

## 6. 留给执行方

- 白名单的读取放在哪个文件。
- 两个新扩展内部怎么分文件。
- 计时扩展具体挂哪几个事件，只要第 4.1 节的语义逐条成立。

## 7. 验收

A（`packages/gateway/test/`）：

- 临时 `agentDir` 里放一个加载时写标记文件、并注册一个工具的扩展。默认：标记文件不出现，工具不在会话里。写进白名单后：两者都出现。
- 同一场景下内置扩展的工具始终在。
- skills 与 prompt 模板不受白名单影响。

B：

- 搬过去的单测在新位置通过；`packages/gateway/test/turn-timing.test.ts` 里测读取的部分留下。
- 网关集成测试：发一个 prompt，会话文件里出现一条 `running` 和一条终态的 `pig.turn-timing`，`userId` 指向那条用户消息。
- 带 `@file` 的 prompt 和 steer，模型收到的文本里是 `<file>` 块。

整体：

- `pnpm check:touched` 通过；`pnpm build:web` 后全量 `pnpm test:e2e` 通过。
- 用真实的本机配置起一次 `pnpm dev:desktop`：确认本机 TUI 装的扩展没有加载（网关日志或会话里的工具列表），内置扩展正常。

## 8. 分工

| 顺序 | 执行方 | 范围 |
|---|---|---|
| 1 | 执行方甲 | A：先做 3.3 的验证并报告，再实现 |
| 1（并行） | 执行方乙 | B：4.1 与 4.2。两处都改 `session-runtime.ts`，由同一个执行方做 |
| 2 | 主会话 | 评审、全量 e2e、真实配置验证、提交 |

甲只动 `resource-loader.ts` 与新文件，乙只动 `session-runtime.ts`、`packages/extensions` 与对应测试，互不重叠。
