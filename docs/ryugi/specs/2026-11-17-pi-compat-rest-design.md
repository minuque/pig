# 与本机 pi 的其余兼容项：设计稿

2026-11-17 由主会话写。用户要求「继续做直到所有任务完成」，这份稿没有逐条确认；标「我定的」的是设计者自定的取舍。前置：`2026-11-17-external-turn-readonly-design.md`（别处正在跑回合时只读）已落地。

## 1. 四项的结论

| 项 | 结论 | 依据 |
|---|---|---|
| pig 持有会话时文件被外部追加 | **要改**，见第 2 节 | 下文 |
| `models.json` 两个写入方 | 不改代码 | 本机 pi 1.5.2 的 `dist/core` 里没有写 `models.json` 的代码；SDK 1.5.0 也没有。程序写入方只有 pig（`ProviderConfigStore`：读-改-写、临时文件加 `rename`、进程内串行）。另一个写入方是用户手改，窗口只有毫秒级。没有真实故障报告，按全局规则不加防护 |
| SDK 跟版规则 | 写进文档，见第 3 节 | 仓库锁 1.5.0，本机 pi 1.5.2。两版 `session-manager.js` 逐字相同，`CURRENT_SESSION_VERSION` 都是 3 |
| 兼容 e2e | 只为第 2 节写一条 | 其余项没有代码改动 |

## 2. pig 持有会话时文件被外部追加

### 2.1 问题

pig 第一次发送时打开会话，建一个活运行时（`PiHostService.activeSessions`）。之后历史读运行时的内存（`TranscriptReader.page` 的 `live` 分支），不再读盘。

这时用户在 TUI 里对同一个会话聊了一轮（第 0 项的 `session_locked` 只在打开时守门，挡不住之后的事）：

- pig 看不到 TUI 写的新消息。
- pig 再发送时，新条目的 `parentId` 指向 pig 内存里的末尾。TUI 那一轮成了旁支；下次打开以文件最后一条为当前分支，用户在任何一边都看不到 TUI 那一轮。

### 2.2 判断「被外部追加」（网关）

`PiHostSession` 记下会话文件上次核对时的大小。核对：

1. `stat` 文件。大小没变，就是没被追加。
2. 大小变了：解析文件，比较条目数与内存里 `sessionManager.getEntries().length`。相等说明是 pig 自己写的，更新记录的大小；不等就是被外部追加。

（我定的）不比 mtime：pig 自己写也会改 mtime。只比大小，大小变了再比条目数，平时只多一次 `stat`。

核对时机：

- `prompt` 与 `steer` 交给 pi 之前。
- 活会话的历史读取（`TranscriptReader.page` 的 `live` 分支）之前，且只在运行时空闲（不在回合中）时。

### 2.3 被外部追加之后

- 运行时空闲：照会话关闭的现有路径释放这个运行时（`PiHostSession.dispose`），之后历史读盘，回到第 0 项的规则。外部回合没结束就是只读，结束了就是普通磁盘会话。
- `prompt` / `steer` 时发现：先释放运行时，再给发送方回错误码 `session_changed_elsewhere`，不把这句交给 pi。
- 界面收到 `session_changed_elsewhere`：保留输入框里的内容；按 `force` 重拉历史；给一条提示「会话在别处有更新，已刷新」（i18n 键自定）。用户再点发送时，照今天的 `ensureRemote` 重新打开会话，打开时第 0 项的守门照常生效。
- 被释放的运行时若有连接正挂着，客户端要能知道。先看现有协议里会话关闭时发什么（`wire.ts` 的事件、`use-live-subscriptions.ts` 的处理）。能复用就复用；没有就停下报告，不要自己加协议事件。

### 2.4 不做

- pig 回合进行中被外部追加。两边同时跑回合，pi 本身没有锁，pig 也防不住；用户已定的规则是 TUI 优先，这种情况由用户避免。
- 外部改写（非追加）、删除会话文件。

## 3. SDK 跟版规则（文档）

写进 `docs/directory-structure.md` 的 gateway 一节，或它已有的依赖说明处（执行方找合适位置，不新建文档）：

- 仓库锁 SDK 精确版本。本机 pi 可以比它新。
- 兼容的底线是会话格式：`CURRENT_SESSION_VERSION` 一致。本机 pi 升级后，比一次两边的 `session-manager.js` 与这个常量。
- 升级 SDK 按全局规则：先读 changelog，评估后再改锁版本。

## 4. 约束

- 守 `AGENTS.md`；`packages/gateway/src/pi/service.ts` 不超过 500 行。
- 单测只测产品假设与数据路径。
- `features/session` 不引用别的 feature。
- 不加依赖。

## 5. 验收

- 网关单测：活会话空闲时，测试进程用 `SessionManager.open(path)` 往文件追加一轮（模拟 TUI），然后：历史读取得到磁盘内容（含追加的那轮）；`prompt` 得到 `session_changed_elsewhere`，文件里没有 pig 的新条目。pig 自己写入后的核对不误判。
- e2e（`e2e/`）：打开会话、发一句，外部追加一轮，再发一句：界面出现提示、显示出外部那一轮、输入框内容还在；再发送成功，接在外部那一轮之后。
- `pnpm check:touched` 通过；`pnpm build:web` 后全量 `pnpm test:e2e` 通过。
