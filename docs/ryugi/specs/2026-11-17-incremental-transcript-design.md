# 历史接口改成增量：设计稿

2026-11-17 由主会话写。用户要求「继续做直到所有任务完成」，这份稿没有逐条确认；标「我定的」的是设计者自定的取舍。

## 1. 目的

多会话基准的预跑（`e2e/perf/refetch.ts`，长会话种子约 47 KB）：一个回合里界面重拉 3 次全文历史，共约 143 KB；6 轮里有 1 轮是 6 次、291 KB。会话越长，每回合重拉的字节越多，网关每次都要把整份历史序列化一遍。

原因（读代码确认）：

- 界面在快照 `revision` 变化时 `loadHistory(id, { force: true })`（`use-live-subscriptions.ts`），每条消息结束都会触发。
- 活会话的历史走 `TranscriptReader.page` 的 `live` 分支：不带 `version`，所以 `known` 永远不生效，每次都回全文。
- 磁盘会话有 `version`，文件没变时回 `unchanged`；文件变了就回全文。

## 2. 关键事实：历史投影只在末尾追加

`TranscriptProjection.transcript(entries)` 按分支条目顺序逐条投影，一个条目至多产出一条 `TranscriptItem`，条目落盘后不再改写。所以同一分支上，新投影是旧投影加尾巴。

前缀会变的情况：切分支、分叉、压缩后分支改变。这些情况下前缀对不上，回全文即可。

任务卡片：任务列表走快照的 `tasks`，不是时间线条目（`session-runtime.ts` 注释「任务列表不是时间线」）。时间线里的任务条目来自独立的 `custom_message` 条目，同样只追加。执行方须用测试确认这一点，不成立就停下报告。

## 3. 设计

### 3.1 协议（`packages/protocol/src/session.ts`）

请求多一个可选参数 `after`，形如 `<条目数>:<最后一条 id>`。（我定的）

返回多一种形态：

```ts
| {
    append: TranscriptItem[]   // 第 n 条之后的条目
    timings: TurnTiming[]      // 照旧给全量，体积小
    hasMore: boolean
    version?: string
    externalTurn: boolean
  }
```

- 网关判断：当前投影的第 n 条（下标 n-1）的 id 等于请求里的 id，且投影长度不小于 n，就回 `append`。否则回全文，形态和今天一样。
- `unchanged` 的语义不变，优先级高于 `append`。
- 兼容：旧网关不认 `after`，回全文；旧界面不带 `after`，拿全文。两边都照旧能用。远程 workspace 的网关版本可能落后，这一点必须成立。

### 3.2 网关（`packages/gateway/src/pi/transcript-reader.ts`、`server/platform.ts`）

- 活会话与磁盘会话都支持 `after`。投影本来就有缓存（`TranscriptProjection` 的 `cachedTranscript`、`DiskTranscripts`），只是少发尾巴之前的部分。
- `lightTranscript` 只对尾巴做，省下序列化与截断的开销。

### 3.3 界面（`apps/web/src/client/platform.ts`、`features/session/hooks/use-session-history.ts`）

- `loadHistory` 在缓存里已有这个会话的磁盘条目时带 `after`。n 与 id 取自缓存里最后拉到的磁盘投影，不含 live 覆盖。
- 收到 `append`：把它接到缓存的磁盘条目后面，再照今天的方式与 live 覆盖合并。合并结果必须与「拿全文」完全一致。
- `releaseLive` 标记 stale 后的重拉、切分支后的重拉，照旧可能拿到全文，不用特殊处理。

## 4. 范围

| 要做 | 不做 |
|---|---|
| 协议、网关、界面三处支持 `after` / `append` | 减少重拉次数（那是另一件事，看基准后再定） |
| 单测：前缀对上回尾巴、对不上回全文、旧形态兼容、界面合并结果与全文一致 | 改投影本身 |

## 5. 约束

- 守 `AGENTS.md`。单测只测产品假设与数据路径。
- `features/session` 不引用别的 feature（状态层设计稿刚落地，eslint 会挡）。
- 不加依赖。

## 6. 验收

- 单测见第 4 节。
- `pnpm check:touched` 通过；`pnpm build:web` 后全量 `pnpm test:e2e` 通过。
- 基准推迟到全部待办完成后统一跑：届时 `turnRefetchBytes` 应明显下降，`turnRefetchCount` 不变。
