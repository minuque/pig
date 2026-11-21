# 会话快照广播与流式进度的发出顺序

- 状态：已采纳
- 代码：`packages/gateway/src/pi/session-runtime.ts`（`PiHostSession.handleEvent`、`SNAPSHOT_SKIP_EVENTS`、`forwardProgress`、`emitPendingUpdate`、`snapshot`）

## 背景

客户端把 `progress` 事件叠到手里的快照上重建时间线。Pi SDK 在通知订阅者之后才把条目写进会话文件，所以 `message_start`、`tool_execution_start` 这类事件触发时，`sessionManager` 里还没有对应条目。此时广播快照，客户端会拿到不含该条目的旧快照，把刚收到的流式进度清掉。

## 决定

高频且尚未持久化的事件（`message_start`、`message_update`、`tool_execution_start`、`tool_execution_end`、`tool_execution_update`、`bash_execution_update`）不触发快照广播，只发 `progress`。`message_end` 是权威快照的时机：等一个微任务（`queueMicrotask`）再广播，让 SDK 先完成落盘。其余事件直接广播快照。

反过来，读快照前必须先把合帧中的进度推出去（`snapshot()` 开头调 `emitPendingUpdate`）：快照里的在途消息已经包含这些文字，之后再发同样的增量就会重复。

## 后果

- 快照与进度都必须按 revision 顺序消费；客户端不能把旧快照当成事件之后的真相。
- 新增会改变会话状态的事件时，要判断事件发生时条目是否已落盘。没落盘的加进跳过集合，落了盘的留给快照广播；漏判的后果是客户端丢一段流式输出或重复一段。
- 流式增量有 16ms 合帧窗口（`PROGRESS_COALESCE_MS`），同一块的增量合并成一条，跳过集合之外的事件会先把合帧的内容推完再广播快照。
