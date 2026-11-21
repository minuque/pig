# 协议投影的条目 id 约定

- 状态：已采纳
- 代码：`packages/gateway/src/pi/transcript.ts`（`TranscriptProjection.allocateId`、`inFlight`、`messageProgress`）

## 背景

会话条目与流式事件来自两条不同的路径：历史条目有 `SessionManager` 分配的条目 id，而 `message_start` / `message_update` / `message_end` 事件在条目落盘之前就发出，事件本身不带条目 id。客户端要靠 id 把流式进度合并进已有的时间线。

## 决定

- `user` / `assistant` 条目的快照 id 用会话条目 id；流式进度里的消息 id 用投影内自增的 `m<N>`。`message_end` 之后服务端立刻广播快照，客户端以快照重建投影，`m<N>` 不会残留。
- 工具条目统一用 `toolCallId` 作 id，保证 `tool_execution_start` 发出的 `running` 占位与结束时的完成条目在客户端合并成一条。
- 中途挂上的连接从 `inFlight()` 拿当前流式消息的同一个 `m<N>`，之后的增量接在它后面。

## 后果

- 客户端的合并逻辑依赖「工具条目 id 恒等于 `toolCallId`」与「流式 id 只活到 `message_end`」两条，改动其一都要同时改客户端。
- 同一会话重新投影（例如运行时释放后改读盘）会从 1 重新计数 `m<N>`，因为此时客户端已经用快照重建过时间线，旧 id 不再被引用。
