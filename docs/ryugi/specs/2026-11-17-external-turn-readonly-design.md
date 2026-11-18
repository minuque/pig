# 外部回合进行中时只读：设计稿

2026-11-17 在架构评审对话里定稿。标「我定的」的是设计者自定、用户未逐条确认的取舍。

## 1. 目的

同一个会话可能同时被 pi TUI 和 pig 打开。用户定的规则：**TUI 优先，pig 只读，能看 agent 行为。**

这一版只守住一种情况：**别处正在跑一个回合**。这时 pig 不能发送，只跟着看；回合结束后自动恢复。

背景事实（已在 SDK 1.5.0 源码里核对）：

- pi 没有跨进程锁，也不写 pid 文件。pig 只能从会话文件本身判断。
- pi 在每条消息结束时落盘，不落增量。所以只读视图按消息刷新，没有逐字流式。
- 会话是带 `parentId` 的树，重新打开时以文件最后一条为当前分支。两边同时写的最坏结果是分叉，不是文件损坏。
- SDK 1.5.0 里会话文件在第一条用户消息时就落盘（`session-manager.js` 的 `_hasConversation`），之后每条追加。TUI 新会话的第一个回合也看得到。
- pig 打开会话只走 HTTP 拉历史；第一次发送时才发 `attach_session`（`apps/web/src/features/session/hooks/use-session.ts` 的 `ensureRemote`）。「看」和「接管」已经分开，不用再拆。

## 2. 范围

| 要做 | 不做 |
|---|---|
| gateway 判断「外部回合进行中」，随历史接口返回 | TUI 开着但空闲的情况 |
| 输入卡禁用发送，显示说明和「接管」 | pig 写入期间被外部追加后退回只读 |
| 未挂连接的会话定时跟随刷新，文件没变不重发全文 | 逐字流式、回合进行中的动画指示 |
| `attach_session` 在服务端守门 | 侧栏卡片上的「运行中」标记 |
| | 外部回合期间的重命名、删除守卫 |

反目标：不用「最近修改时间」做判断。在 TUI 里做完、退出、再到 pig 接着聊是最常见的用法，按时间判断会把它锁住。

## 3. 判断规则（gateway）

`externalTurn` 为真，当且仅当两条同时成立：

1. gateway 进程里没有这个会话的活运行时（`PiHostService.activeSessions` 里没有它）。
2. 当前分支的回合没结束。

「回合没结束」的定义：从分支末尾往前找第一条 `type: "message"` 且角色是 `user` / `assistant` / `toolResult` 的条目，其余条目跳过。

| 这一条是 | 结论 |
|---|---|
| `user` | 没结束 |
| `toolResult` | 没结束 |
| `assistant` 且 `stopReason` 是 `toolUse` | 没结束 |
| `assistant` 且是其他 `stopReason`（`stop`、`length`、`error`、`aborted`） | 已结束 |
| 找不到这样的条目 | 已结束 |

只有这一条规则，没有时间阈值。（我定的）TUI 中途被杀、或 pig 自己上次中途崩溃的会话，也会落进「没结束」，靠「接管」出去。

实现成一个纯函数，放在 `packages/gateway/src/pi/`，输入是分支条目，输出布尔值。

## 4. 接口约定

三个执行方并行开工，这一节是它们之间唯一的约定，不能各自改。

### 4.1 历史接口

`GET /api/v1/platform/transcript?sessionId=<id>&known=<version>`，`known` 可省。

类型加在 `packages/protocol/src/session.ts` 并从 `index.ts` 导出：

```ts
/** 历史接口的返回；unchanged 表示文件版本与 known 相同，不重发。 */
export type SessionTranscriptPage =
  | { unchanged: true }
  | {
      items: TranscriptItem[]
      timings: TurnTiming[]
      hasMore: boolean
      /** 磁盘会话的文件版本；活会话不带。 */
      version?: string
      /** 别处正在跑回合：pig 这边只读。 */
      externalTurn: boolean
    }
```

- 磁盘会话：`version` 用 `DiskTranscripts` 已有的 `mtimeMs:size`。`externalTurn` 按第 3 节算，和投影一起缓存。
- 活会话：不带 `version`，`externalTurn` 恒为 `false`，忽略 `known`。
- 磁盘会话且 `known` 等于当前版本：返回 `{ unchanged: true }`，不做投影。

归属（我定的）：

- `DiskTranscripts.read(path, known?)` 负责 `stat`、比对 `known`、投影和缓存。缓存值多存一个「回合没结束」的布尔值，和投影出自同一次 `getBranch()`。它不知道会话是不是活的。
- `PiHostService.sessionTranscript(sessionId, known?)` 负责分活会话与磁盘会话，并拼出 `SessionTranscriptPage`。`externalTurn` = 磁盘会话且回合没结束。
- `fullTranscript` / `transcriptItem` 的行为不变。

### 4.2 挂载命令

`packages/protocol/src/wire.ts`：

```diff
-  | { command: "attach_session"; sessionId: string }
+  | { command: "attach_session"; sessionId: string; takeover?: boolean }
```

- `SessionService.openSession(sessionId, options?: { takeover?: boolean })`。
- `PiHostService.openSession` 从磁盘打开前按第 3 节判断。回合没结束且不是 `takeover`：抛 `GatewayError("session_locked", …)`，不建 `AgentSession`。
- 守门位置：`findSessionPath` 之后、建 `AgentSession` 之前；判断用的就是随后交给 `createAgentSession` 的那个 `SessionManager`，不重复打开文件。
- 会话已经是活的（`LiveSessions` 里有）：不走 `openSession`，不受影响。pig 自己在跑、切到后台的会话也属于这一类，网关对它报 `externalTurn: false`。

接管后怎么续上未结束的回合，交给 pi 现有行为，不额外处理。今天 pig 没有守卫时走的就是这条路。

## 5. web 行为

### 5.1 状态

- `client/platform.ts`：不带 `known` 的调用永远拿到全文，返回类型里没有 `unchanged`，现有调用方（`RailChild.vue`、`session-reference.ts`）不用改。带 `known` 的调用才可能拿到 `unchanged`，只给 `loadHistory` 用。做成重载还是两个函数由执行方定。
- 历史缓存页（`session-history-cache.ts`）多存 `version` 和 `externalTurn`。
- `loadHistory` 在页已就绪时带上 `known`。收到 `unchanged` 不写缓存、不触发重算。
- `useSessionLifecycle` 多给两样：
  - `externalTurn`：缓存页的 `externalTurn` 为真，且这一侧没有挂着这个会话的连接。后一个条件只为盖住「刚接管、历史还没重拉」的窗口。
  - `takeover()`：带 `takeover: true` 走 `ensureRemote`，立刻挂载。挂上后 `externalTurn` 自然变假。（我定的：接管 = 立刻挂载，不等下一次发送）

### 5.2 跟随刷新

会话正显示在某一侧，且没有挂着的连接（既不是前台连接，也不在后台池）时，每 2 秒强制重拉一次历史。（我定的）

- 条件是「显示中且未挂载」，不是「`externalTurn` 为真」。（我定的）这样 pig 先打开、TUI 后开跑的情况也能看到，用的是同一套机制。
- 文件没变时网关只做一次 `stat`，回 `{ unchanged: true }`。
- 挂上连接后停止轮询；之后的刷新走现有的快照通道。

### 5.3 输入卡

`externalTurn` 为真时：

- 发送禁用：并进 `session-workbench/index.vue` 现有的 `sendDisabled`。输入框照常可打字，草稿保留。Enter 和入队都不响应，走 `Composer` 现有的 `sendActive` 路径，不改 `Composer` 内部。
- 输入卡正上方显示一行说明和一个「接管」按钮。由 `session-workbench`（页面层）拼装，`features/session` 不引用视图。
- 点「接管」先弹确认框（现有的 `components/ui/alert-dialog`），确认后调 `takeover()`。
- 回合结束后轮询拿到新历史，`externalTurn` 变假，说明消失，发送恢复。不需要额外代码。

文案（我定的，中英都要，加在 `i18n/messages.ts`）：

| 位置 | 中文 |
|---|---|
| 说明 | 这个会话正在别处运行，回合结束后可以继续输入。 |
| 按钮 | 接管 |
| 确认框标题 | 接管这个会话？ |
| 确认框正文 | 另一边如果还在运行，两边会各写各的，会话会分叉。 |
| 确认按钮 | 接管 |

### 5.4 被拒的路径

pig 以为可以发、但服务端判定外部回合进行中（比如轮询还没轮到）：

web 靠 `GatewayRequestError.code === "session_locked"` 认出它（`client/gateway-client.ts` 已有这个类）。规则只有一条：**任何一次挂载被 `session_locked` 拒绝，这一侧放掉连接并强制重拉历史。**

- 发送：现有的失败路径会还原草稿、撤掉乐观消息并报错，再加上面那条规则。
- 断线重连后的 `reattach()`：会话在断线期间被网关释放、又被外部跑起来时会被拒。重连不自动接管，永远不带 `takeover`。（我定的）`use-session-hub.ts` 的重连循环要逐侧接住拒绝，一侧被拒不影响另一侧重挂。落在哪个 hook 里放连接由执行方定。

## 6. 约束

- 守 `AGENTS.md`：别名导入、单文件不超过 500 行、样式只用 token、复用 `components/ui`。`session-workbench/index.vue` 已有 629 行，新增内容放进 `components/` 或 `hooks/`，不再往里堆。
- 改 UI 前读 `apps/web/DESIGN.md`，守「七条规则」。
- `features/session` 不新增对 `composer`、`transcript-view` 的引用。
- 不引入新依赖。
- gateway 的判断只读会话文件，不新增对 pi 私有接口的调用。

## 7. 留给执行方

- 纯函数、缓存字段、组件、i18n key 的命名。
- 说明行的具体样式和基础件选择（`callout` 之类），只要守第 6 节。
- 轮询放在 `features/session` 的哪个 hook 里。
- 是否补一条 `docs/architecture/flows.ts` 数据流。

## 8. 验收

单测只验证产品假设和数据路径。

gateway（`packages/gateway/test/`）：

- 第 3 节表格里的每一行各一例。
- 历史接口：未结束的磁盘会话返回 `externalTurn: true`；带上相同 `known` 返回 `unchanged`；文件追加后版本变化并返回全文。
- `attach_session`：未结束的磁盘会话不带 `takeover` 被拒，错误码 `session_locked`；带 `takeover` 成功。

e2e（新文件 `e2e/conversation/external-turn.spec.ts`，并在 `scripts/check/scope.mjs` 里把 `apps/web/src/features/session/` 映射上它）：

1. 预置一个会话：先有一个完整回合，再追加一条用户消息（`e2e/support/` 现有的构造函数都以助手消息或工具结果结尾，要加一个）。打开后：说明可见，发送禁用，输入框可打字。
2. 测试进程用另一个 `SessionManager.open(path)` 追加一条 `stopReason: "stop"` 的助手消息（这就是一个外部写入方）。几秒内：新消息出现在对话里，说明消失，发送可用。
3. 同样的预置会话：点「接管」并确认，说明消失，发一条消息能正常跑完一个回合（用现有的替身模型）。

收尾：`pnpm fix:touched` → `pnpm check:touched` 全绿。

## 9. 分工

约定在第 4 节，执行方不许改。同一个工作区，各自只动自己的目录，不提交；主会话统一检查、评审、提交。

| 顺序 | 执行方 | 范围 |
|---|---|---|
| 1 | 协议 | `packages/protocol`：第 4 节的两处类型 |
| 2（并行） | gateway | `packages/gateway`：判断函数、历史接口、挂载守门、单测 |
| 2（并行） | web | `apps/web`：状态、轮询、输入卡、文案、被拒路径 |
| 3 | e2e | `e2e/`、`scripts/check/scope.mjs`：第 8 节的三条旅程 |
| 4 | 主会话 | 评审 diff、`fix:touched` / `check:touched`、提交 |
