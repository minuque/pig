# 会话真相以 Pi 持久化为准

- 状态：已采纳
- 代码：`packages/gateway/src/pi/service.ts`（`PiHostService`）、`packages/gateway/src/pi/session-runtime.ts`（`PiHostSession`）

## 背景

gateway 要给 web 提供会话列表、历史、卡片与占用估算，而会话文件由 Pi SDK 的 `SessionManager` / `AgentSession` 写入，用户也可能在同一份文件上直接跑 TUI。若 gateway 自己再维护一套会话状态，就要处理两份状态的同步与冲突。

## 决定

gateway 只做 Pi SDK 到协议 `SessionService` 的映射，不保存第二套领域状态。会话列表、历史、卡片、占用一律以会话文件为源；`sessionPaths`、`SessionCardCache`、`DiskTranscripts` 都是按文件版本（mtime + size）失效的缓存，不是权威状态。本地已打开会话的运行时由 `PiHostSession` 持有，文件被别处追加时释放运行时并改读盘。

## 后果

- 读盘成本靠缓存版本号兜住；缓存失效判断错了表现为拿到旧历史，不会丢数据。
- 需要「会话之外」的信息（远程绑定、子代理归属）只能写进会话文件的 `custom` 条目，不能存进 gateway 内存。
- 新增会话相关字段时先确认 Pi 是否已持久化，没有才考虑单独落盘，避免引入第二真源。
