# pig 重构后遗问题

> 对照 `docs/refactor.md`。主链路方向正确：
>
> `RemoteSession → PiClient → WebSocket → PiServer → PiHostService`
>
> 不要再造第二套 Agent Domain。下面按用户可感知程度排列；P0 可直接改。

## 1. 启动授权与刷新（已确认叠在一起）

两件表面症状：

1. 启动时 `POST /api/v1/bootstrap` 不通，拿不到凭证。
2. 刷新页面 / 会话后必须重启整个进程。

它们不是同一个缺口，但会串成一条死路。

```
pnpm dev
  Gateway 启动，bootstrap secret TTL 开始计时（默认 60s）
       ↓
  Vite 冷启动编译（经常 > 60s）再 open /#bootstrap=SECRET
       ↓
  bootstrapFromUrl() 先 history.replaceState 撕掉 hash，再 POST /api/v1/bootstrap
       ↓
  失败（401 过期 / 404 没代理 / 401 已被别的标签兑走）
       ↓
  sessionStorage 为空，地址栏也没 secret
       ↓
  F5 → 不再兑换 → 只能重启进程拿新 hash
```

即便兑换成功（201），页面还要连 `ws://127.0.0.1:5173/api/v1/pi`。Vite 代理默认不转发 WebSocket，于是 HTTP 通、WS 挂，看起来仍像「授权没成」。

### 1.1 `/api/v1/bootstrap` 不通 — 不是 WS 代理

HTTP POST 只走 `/api` 代理，不依赖 `ws: true`。失败原因：

| 原因 | Network 里看到 |
| --- | --- |
| 只开了 `pnpm dev:web`，或 VS Code「Debug: Vue 页面」打开裸 `http://127.0.0.1:5173`，没有 `GATEWAY_TARGET` | `404` 或 Vite 自己的 HTML |
| `pnpm dev` 首次编译超过 60s，secret 已过期 | `401 INVALID_BOOTSTRAP` |
| 另一个标签已经兑过（secret 一次性） | 同上 401 |
| 打开的 URL 不带 `#bootstrap=` | 根本没有这发 POST |

`scripts/dev.ts` 里的 Gateway **不挂 webRoot**。UI 必须走 5173；直接打开 gateway 随机端口没有页面。`.vscode/launch.json` 的 Chrome 调试 URL 是裸 5173，会稳定复现「拿不到凭证」。

### 1.2 刷新必须重启 — 一次性 secret + 提前撕 hash

`apps/web/src/client/http.ts` 的 `bootstrapFromUrl` 在 `fetch` **之前** `replaceState`。无论 401 还是 404，hash 已经没了。

- 兑换失败：没有 credential，F5 也不会再 POST。
- 兑换成功：credential 在 `sessionStorage`，F5 按理会重连；但 WS 代理没开时刷新后仍连不上。
- Host 一重启，内存里的 credential 作废，旧标签必须重新走启动链接。这是设计如此。

### 1.3 怎么一眼分清

看 5173 的 Network：

1. **没有** `POST /api/v1/bootstrap` → 地址栏从没带 `#bootstrap=`。
2. **有 POST，404** → Vite 没代理，不是 `pnpm dev` 拉起来的。
3. **有 POST，401** → secret 过期或已被用掉。
4. **POST 201，随后 WS `/api/v1/pi` 失败** → 凭证是通的，缺 `ws: true`。

### 1.4 方案

1. **先成功再撕 hash**；失败把 hash 留着，F5 还能重试。
2. **dev 下取消 bootstrap TTL，或拉到数分钟**。60s 和 Vite 冷启动不兼容。
3. Vite 代理加上 `ws: true`（见 §2.2）。
4. 调试 URL 带上 `#bootstrap=`，或启动后把完整 URL 打到终端。
5. 凭证改 `localStorage`（同 origin、仅 127.0.0.1）；Host 侧给 credential 加 TTL / 个数上限；401 时明确提示「重新打开启动链接」。

1–3 对上当前两个现象；4、5 是体验。

---

## 2. P0：用户能直接踩到的正确性

### 2.1 欢迎页创建失败仍清空输入

`useWelcomeSubmit` 的契约：`createSession` 失败必须抛错，才不会继续 `submit`。测试也按这个写。

`useApp.createSession` 吞掉异常、不 rethrow。创建失败 → `submitText` 对空 `remote` 变成 no-op → `welcomePrompt` 仍被清空。错误写到侧栏 `workspaceError`，欢迎页看不到。

**方案：** `createSession` / `submitText` 失败时抛出，UI 层 catch 负责展示。不要在接线层把错误吞成 `void`。

### 2.2 `pnpm dev` 的 WebSocket 代理没开

`apps/web/vite.config.ts`：

```ts
proxy: { "/api": { target: gatewayTarget } }
```

浏览器连的是 `ws://127.0.0.1:5173/api/v1/pi`。Vite 默认不转发 WS。`scripts/dev.ts` 正是这条路径。`pnpm start`（gateway 直接托管 `dist`）不受影响。

**方案：**

```ts
proxy: {
  "/api": { target: gatewayTarget, ws: true, changeOrigin: true },
}
```

### 2.3 `contenteditable` 用 `textContent` 丢换行

`PromptEditor.syncFromEditor` 读 `el.textContent`。Chrome 里 Enter / Shift+Enter 插入 `<div>` / `<br>`，`textContent` 不补 `\n`。发出去的是粘在一起的一行。

**方案：** 用 `innerText`，或按块节点 walk 再 `join('\n')`。这就是一个纯文本框，不要自己维护富文本。

### 2.4 附件是假的

`useAttachments` 只保留 `{id, name, kind}`，提交时拼 `[附件: 文件名]`。文件内容当场丢掉。`docs/refactor.md` §9 已写明官方契约暂不支持图片 prompt。

**方案（二选一，不要维持现状）：**

- **推荐：** 先下线「添加图片/文件」，标成 upstream gap。
- 若必须留入口：把用户选中的本地路径交给 Agent（`read` / `bash`），不要假装 multipart 附件，不要发明第二套附件 Domain。

### 2.5 preset 双向 watch 竞态：换模型时 thinking 选择被覆盖

`useApp` 里两条 watch 互相打架：

- `watch(preset)`：`model 变了 → setModel`，`else if thinking 变了 → setThinking`。模型与 thinking 同时变更时只下发 `setModel`，thinking 修改（含 `useModelPresetBinding` 的自动修正）静默丢失。
- `watch(snapshot)`：对 preset **整体替换**。`setModel` 回执快照里 thinking 还是旧值，会把用户刚选的 level 覆盖回去；覆盖后 `modelLevels` 不再重算，UI 显示「新模型 + 它不支持的 level」，与 Session 真实状态永久不一致，直到用户再次手动操作。

**方案：**

1. 下发拆成 model / thinking 两个独立判断，用 `pendingModel` 标志标记在途 `setModel`；
2. 镜像改成字段级：model 在途时跳过整体覆盖，等 promise 完成后再同步；
3. `pendingModel` 在途时暂缓 `setThinking` 下发，回执后 watch 会因镜像再次触发；
4. 补 `useApp` 级测试：换模型（level 不可用触发自动修正）→ 断言最终下发 `setModel(B)` + `setThinking(修正值)`，preset 不被旧值覆盖。目前 `useApp` 没有任何测试。

---

## 3. P1：平台契约与边界

### 3.1 目录选择器锁死 Windows，且依赖 `pwsh`

`NodeDirectoryPort` 非 Windows 直接抛错；Windows 上调的是 PowerShell 7（`pwsh`）。很多机器只有 `powershell.exe`。macOS / Linux 无法从 UI 加 workspace。

**方案：**

- 抽一层真正的第二适配器（现在只有 Windows 一个，seam 是假的）。
- Windows：`pwsh` 失败回退 `powershell.exe`；给对话框设超时。
- 非 Windows：先做「粘贴路径 + `realpath` 校验」；不要为了选目录去写跨平台 GUI 框架。

### 3.2 cwd 未规范化 → Session 从侧栏消失

`groupSessionsByCwd` 用 `session.cwd === localWorkspace` 精确匹配。Windows 上 `C:\Foo`、`C:/Foo`、盘符大小写、尾斜杠都可能对不上。目录加进去了，历史 Session 却是空列表。

**方案：** 在 platform 层（`workspace.ts` / Host `selectDirectory`）统一 canonicalize（`path.resolve` + 盘符小写 + 统一分隔符）。UI 只拿已经规范化的字符串。

### 3.3 Transport 主动 `close()` 不发终态

官方约定：每个连接恰好一次 `onClose` 或 `onError`。实现里 `close()` 先把 `closed = true`，随后的 `socket.close` 事件被吃掉。注释写「收敛到单一终态」，代码没做。

**方案：** `close()` 里调用 `handlers.onClose()`，或等 socket `close` 再 `finish()`。二选一。`fail` / `finish` 保持互斥。

### 3.4 运行中仍可改模型

`ThinkingLevelSelect` 有 `:disabled="running"`，`ModelPicker` 没有。Host 的 `setModel` 在 turn 中会 `SessionBusyError`。

**方案：** `phase !== 'idle'` 时禁用 ModelPicker。preset watch 在 snapshot 未 idle 时不要发 `setModel`。文案「创建时固定」是错的，应改成「空闲时可改」。

### 3.5 Session 列表与 local workspace 绑死

`groupSessionsByCwd` 只渲染 `localWorkspaces` 里的组。磁盘上有、但没重新「添加目录」的 Session 不可见。`isLocal()` 在当前数据流下几乎恒为 true。

**方案：** 侧栏分两段——「已授权目录」+「其它 Session（按 cwd 自动成组）」。撤销目录只影响授权列表，不删除 Pi Session。这与「Pi 拥有 Session 真相」一致。

### 3.6 Gateway 不透传 Host 配置

`GatewayOptions` 只收 `bootstrapSecret` / `webRoot` / 帧限制，`PiHostService` 的 `sessionDir` / `cwd` 无法从 CLI 配置，`cli.ts` 写死默认值。

**方案：** `GatewayOptions` 加 `sessionDir?` / `cwd?` 字段透传给 `PiHostService`，一行一个。

---

### 3.7 Host 端 `send` 在连接关闭后静默成功

`WebSocketByteConnection.send` 对已关闭连接直接 `Promise.resolve()`。`PiServer` 若在 close 后仍调用 `send`（协议外误用），数据静默丢失、无任何信号，比显式失败更难排查。与 §3.3（浏览器端 `close()` 不发终态）是同一契约的两面。

**方案：** `closed` 后 reject；或至少触发 `onError` 计数，别让「发送成功但对方没收到」成为可能。

### 3.8 重连时旧 `PiClient` 只断连不销毁

`usePiClient.connect` 对旧实例只 `disconnect("重新连接")`、不 `dispose()`。每次重连都 new 一个新 `PiClient`，旧实例若内部还有 timer / listener 残留会累积。

**方案：** 创建新实例前 `await previous?.dispose()`（`dispose` 幂等；`connect` 是 async，可直接 await）。

---

## 4. P2：设计深度

对照 deep module：小接口、多实现、改动集中在一处。

### 4.1 `useApp` 是浅模块

一个 composable 同时管 bootstrap、退避重连、路由同步、workspace、preset 双向同步、submit/abort、滚动状态。对外吐出约 35 个字段。任何一项改动都要打开这个文件（Divergent Change）。§2.1 的吞错就是接线层过厚的直接后果。

**方案：** 按 seam 切开，`useApp` 只接线：

| 模块 | 接口 | 藏进去的实现 |
| --- | --- | --- |
| `usePiClient`（已有） | `connect / snapshot / models` | 连接与重连 |
| `useRemoteSessions`（已有） | `open / create / submit / abort` | lease 串行、dispose |
| `useWorkspaceNav` | `groups / add / revoke / expand` | 本地目录 + 分组 |
| `useComposerBinding` | `preset` | snapshot ↔ picker 镜像 |
| `useSessionRoute` | `sessionId` | 路由 ↔ `openSession` |

`createSession` 必须失败即抛。测试对着这些小接口写，不要再给 `useApp` 堆集成逻辑——目前 `useApp` 零测试，§2.5 的竞态就藏在这层没测试的接线里。

### 4.2 `ComposerPreset` 把 `ModelRef` 压成 `"provider/id"`

`modelRefOf` / `parseModelId` 按第一个 `/` 切开。官方类型已经是 `{ provider, id }`。provider 一旦带 `/` 就会切错。

**方案：** UI 全程持有 `ModelRef + ThinkingLevel`。展示层再拼字符串。删掉 `modelRefOf` 这条往返。

### 4.3 Host 手写 Session JSONL，是第二套持久化

`createSession` 用 `flag: "wx"` 自己 `writeFile` header，因为「Pi 要等助手消息才落盘」。格式假设与 Pi 内部 JSONL 一致。Pi 改磁盘格式，这里静默坏掉。

**方案：** 优先找 SDK 是否有 `flush` / `ensurePersisted`。没有就在 adapter 里标成 temporary compatibility；官方已导出 `parseSessionEntries`（0.84.1），写完立即用它读回校验，格式不兼容在升级当天就炸出来。不要再扩展 `serializeEntries`。

### 4.4 文档和文案还在旧 Run 世界

- `ChatInput`：「不创建新 Run」「创建时固定」
- `docs/ui-guidelines.md`：Run 终态、Session kebab 重命名/删除、引用不存在的 `docs/adr/`
- `DESIGN.md` 是 Notion 视觉 token，不是产品架构（架构在 `docs/refactor.md`）

**方案：** UI 文案改成 Prompt / Steer / Abort / phase。guidelines 与 `refactor.md` §9 对齐；做不到的标成 upstream gap，不要写成像已实现。

### 4.5 Host 快照投影是全量重算，且索引无界

三处同源（都在「Pi 事件 → 协议投影」热路径上）：

1. `listSessions`：官方 `server_snapshot` 每次广播都调 `PiHostService.listSessions()`（`pi-server/dist/snapshots.js`），当前实现每次 `SessionManager.listAll()` 全量扫盘 + 解析所有 session 文件；attach / disconnect / 每轮结束都会触发广播。
2. `snapshot()`：每次 `session_snapshot` 都对 `getBranch()` 全量重投影 transcript，含每个 assistant 消息的 toolCall 参数 JSON 序列化。
3. `TranscriptProjection.toolCalls`：`toolCallId → args` 只增不删，长会话内存只涨。

**方案：**

- `listSessions` 加短 TTL（约 2s）缓存，`createSession` / `openSession` 时失效；`ponytail:` 注释标注升级路径（官方提供变更通知后改增量失效）。
- transcript 投影按「条目数 + revision」memo，条目追加时增量投影。
- toolResult `finished` 后从 `toolCalls` 删除对应 id。

---

## 5. 落地顺序

1. **先修接线（对上 §1 的两个现象）：** 先成功再撕 hash、放宽 / 取消 dev TTL、Vite `ws: true`、欢迎页错误传播、`contenteditable` 换行、运行中禁用 ModelPicker、preset 竞态（§2.5）。
2. **再收口产品谎言：** 下线假附件；Windows 目录选择器回退；cwd canonicalize。
3. **然后加深模块：** 拆 `useApp`、preset 改用官方 `ModelRef`、Session 列表不再过滤掉「未收藏」的 cwd、Host 快照缓存（§4.5）。
4. **不要做：** 第二套 Agent Runtime、自研图片协议、现在就抽 `@pig/ui`（边界还在 `useApp` 里搅在一起，先切开再抽）。

最终判断顺序仍以 `docs/refactor.md` 为准：

> 官方 Pi SDK / Remote Protocol → Pi Extension → UI state → platform concern。
>
> Pi 已拥有的能力，禁止在 pig 中实现第二份 Agent Truth。
