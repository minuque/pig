# live 覆盖按 id 逐事件累积

- 状态：已采纳
- 代码：`apps/web/src/features/session/hooks/use-live-subscriptions.ts`（`session.subscribe` 回调）、
  `apps/web/src/features/session/lib/transcript-timeline.ts`（`mergeLiveTranscript`）

## 背景

快照广播会清空库内 progress：同一帧里后到的空快照会盖掉先到的 `item_finished`。一帧内可能收到多次快照，
只保留最后一份就会丢条目。

## 决定

订阅回调按 id 把事件累积进 `liveItems`，不整份替换；与磁盘条目对齐的合并规则放在
`projectTranscriptTimeline` 这个纯函数里，按 id 覆盖、只追加还没落盘的尾巴。

## 后果

同一帧多次快照不丢条目，投影层是唯一的合并入口。改动时不要让订阅回调直接替换整个覆盖集合，
也不要绕开投影在别处合并磁盘与 live。
