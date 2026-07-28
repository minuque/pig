# AI coding agent / local daemon 多 Session 实时事件传输

## 结论

**推荐 v2 使用拓扑 1：Gateway 级单 SSE 应用多路复用。** Vue SPA 每个页面只建立一个 `EventSource`，Hono Node Gateway 把所有 Session/Run 的 Pi SDK 实时事件封装进统一 envelope；命令继续走 REST。协议从第一版就保留 `sessionId`、`runId`、Gateway 全局游标、Run 内序号和显式 `replay-gap/lagged` 恢复信号。未来只有在“后台 Session 产生的高频 delta 明显浪费带宽”时，才演进为拓扑 3：低频全局通知流 + 当前可见 Session 详情流。

- **[事实]** SSE 是服务端到浏览器的单向 HTTP 流；`EventSource` 原生支持断线重连、`id`、`retry` 和 `Last-Event-ID`。客户端命令不需要与事件共用连接。[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)；[MDN Using SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- **[事实]** OpenCode 官方 server 同时提供实例 `/event` 和 `/global/event` SSE；实例事件流按一个连接订阅该实例的全部 bus 事件，并发送 heartbeat。它证明 coding-agent 的多类事件不需要按 Session 建物理连接，但其公开 SSE handler 本身不能被当作完整 replay/backpressure 规范。[OpenCode event handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)；[OpenCode global handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts)
- **[事实]** T3 Code 和 Hubcode 都选择一个 WebSocket 承载多个领域通道，而不是“每 agent 一个 socket”。T3 Code 强调所有 outbound push 经过单一有序路径；Hubcode 使用二进制多路复用，并为 agent timeline 定义 `epoch + seq`、`staleCursor`、`gap`、`reset`。[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)；[T3 Code orchestration contracts](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)；[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)；[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)
- **[推论]** 在“本地单用户、Vue SPA、Hono Node Gateway、Pi SDK、REST 命令 + SSE 事件、不做 PTY、Session 间并行”的约束下，WebSocket 的双向、二进制和通道控制能力没有覆盖其额外协议成本；单 SSE 又能避免每 Session 连接数爆炸，因而是当前最小且可扩展的方案。依据是 SSE 的单向语义、HTTP 连接限制，以及 T3/Hubcode 证明的“逻辑多路复用不要求物理多连接”。[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)；[MDN 连接限制](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)；[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)

---

## 1. 研究口径与来源

候选资料先通过 agent-reach 的 Exa 搜索发现，再回到以下一手来源核验：

1. WHATWG HTML SSE/EventSource、MDN、RFC 9113；
2. Hono 官方源码；
3. OpenCode、T3 Code、Hubcode 官方架构和源码；
4. OpenHands / Software Agent SDK 官方架构和源码；
5. 本项目已定持久化边界：Pi JSONL 是 durable session 事实源，运行中 delta 是可重建传输状态。

本文以 **[事实]** 表示规范、官方文档或源码直接支持的行为；以 **[推论]** 表示针对本项目约束的设计判断。

---

## 2. 已核验事实

### 2.1 SSE 的顺序、重连与游标

- **[事实]** 一个 event stream 按文本出现顺序逐条解析；每个事件块由空行终止。`id:` 更新该 `EventSource` 的 last event ID；断线重连时，浏览器在 last event ID 非空时发送 `Last-Event-ID` 请求头。[WHATWG processing model / Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)
- **[事实]** `Last-Event-ID` 只把“客户端最后处理到的 ID”报告给服务端；规范没有替服务端保存历史或定义 replay。因此自动重连不等于无丢失，服务端仍须实现保留窗口、按游标读取和过期处理。[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- **[事实]** 浏览器可自动重连，服务端可用 `retry:` 调整重连等待；HTTP `204` 可要求浏览器停止重连。注释行不会触发事件，可作为 keep-alive；WHATWG 建议面对旧代理时约每 15 秒发送注释。[WHATWG SSE authoring notes](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes)；[MDN event stream format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)
- **[推论]** SSE 提供的是“有序字节流 + 重连游标载体”，不是 exactly-once 消息系统。断开边界可能导致重复投递，客户端 reducer 必须幂等；缺失是否可补取必须由 Gateway 的 replay 协议决定。[WHATWG processing model](https://html.spec.whatwg.org/multipage/server-sent-events.html#processing-model)

### 2.2 HTTP/1.1、HTTP/2 与多标签页

- **[事实]** MDN 明确警告：非 HTTP/2 时，同一 browser + domain 的 SSE 连接上限很低，Chrome/Firefox 常见为 6，且多个标签页共享；HTTP/2 的并发 stream 数由双方协商。[MDN Using SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)
- **[事实]** HTTP/2 在一条连接内多路复用多个独立 stream，并用 `SETTINGS_MAX_CONCURRENT_STREAMS` 限制并发；流量控制同时作用于单 stream 和整条连接。RFC 建议允许值不小于 100，但实际值由端点设置，不能假定固定为 100。[RFC 9113 §5, §5.2, §6.5.2](https://www.rfc-editor.org/rfc/rfc9113.html)
- **[事实]** WHATWG 直接指出：多个页面各开 `EventSource` 可能碰到每服务器连接限制，可通过 SharedWorker 共享一个 `EventSource`。[WHATWG SSE authoring notes](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes)
- **[推论]** 不能因生产反向代理“可能支持 H2”就把每 Session SSE 当作安全基线；本地 Node Gateway、桌面 WebView、远程代理链路可能协商出不同协议。应用级单流把连接规模稳定在每标签页 1 条，对 H1/H2 都成立。[MDN Using SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)；[RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html)

### 2.3 Hono/OpenCode 的实现边界

- **[事实]** Hono `streamSSE` 设置 `text/event-stream`、`no-cache`、`keep-alive` 等响应头；`writeSSE()` 支持 `data/event/id/retry` 并 `await` 底层 Web Streams writer。`onAbort()` 可清理订阅。[Hono SSE helper](https://github.com/honojs/hono/blob/main/src/helper/streaming/sse.ts)；[Hono StreamingApi](https://github.com/honojs/hono/blob/main/src/utils/stream.ts)
- **[事实]** OpenCode 的实例 SSE 在建立请求 scope 时先订阅事件，再拼接 `server.connected` 和 heartbeat，源码注释明确说明这是为避免“前缀发送与延迟订阅之间丢事件”的竞态；事件输出串行经过流编码。[OpenCode event handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)
- **[事实]** OpenCode 的全局事件包含 location/directory 维度，实例事件则过滤到当前 directory/workspace；两者都是逻辑作用域，不是每 Session 建流。[OpenCode event handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)；[OpenCode global handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/global.ts)
- **[推论]** `await stream.writeSSE()` 只能让单个响应 pump 感知底层 writer 背压；若 producer 先写入无界内存队列，或发布者逐个等待慢客户端，它仍会造成内存增长或拖慢 Pi 事件生产。Gateway 必须另外实现“每客户端有界队列 + 独立 pump + 溢出恢复”。[Hono SSE helper](https://github.com/honojs/hono/blob/main/src/helper/streaming/sse.ts)；[Hono StreamingApi](https://github.com/honojs/hono/blob/main/src/utils/stream.ts)

### 2.4 成熟 coding-agent 的相关实践

#### T3 Code

- **[事实]** T3 Code 的 browser 与 Node server 使用单 WebSocket；server 把各 Session 的 provider 事件归一化为 orchestration events，所有 outbound push 经单一有序路径送往 browser。[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)
- **[事实]** 其订阅契约支持 `afterSequence`：已有 snapshot 的客户端只请求该序号之后的 shell events，重叠事件由客户端按 sequence 去重。[T3 Code orchestration contracts](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)
- **[推论]** “一个连接承载多个 Session”可靠性的关键不是 WebSocket，而是统一 envelope、单调序号、snapshot/replay 与去重；这些机制可原样用于 SSE。[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)；[T3 Code contracts](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)

#### Hubcode

- **[事实]** Hubcode 的 local daemon 用一个 binary-multiplexed WebSocket 服务 app/CLI/desktop；agent timeline append-only，每次 run 有 epoch，事件广播给订阅客户端。[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)
- **[事实]** `AgentManager` 的 timeline cursor 是 `{ epoch, seq }`，读取结果显式返回 `reset`、`staleCursor`、`gap` 和 window 边界；这是 replay gap 不能靠“猜”处理的直接先例。[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)
- **[事实]** Hubcode 对高流量 terminal 检查 WebSocket `bufferedAmount`；超过阈值时停止原始增量并退化为 snapshot，避免慢客户端导致内存膨胀。[Hubcode Session](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/session.ts)
- **[推论]** 本项目虽不做 PTY，仍应采用同一原则：可重建的 text/tool progress 增量在拥塞时不应无限排队；发送 `stream.lagged` 后以 REST snapshot 恢复，比试图永久保存每个 token delta 更稳。[Hubcode Session](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/session.ts)

#### OpenHands / Software Agent SDK

- **[事实]** OpenHands 的架构为每个 conversation 建立直接 WebSocket，并先 replay historical events；当前 Software Agent SDK 同时暴露 conversation REST events 与 conversation WebSocket。[OpenHands conversation startup](https://github.com/OpenHands/OpenHands/blob/1.6.0/openhands/architecture/conversation-startup.md)；[OpenHands Agent Server](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-agent-server/openhands/agent_server)
- **[事实]** 当前远程客户端先通过分页 REST 做 full sync，再接 WebSocket；按 event ID 去重、按 timestamp 插入，并提供 `reconcile()` 再次从 REST 合并，以修复初始同步与订阅间的竞态。WebSocket 收到订阅完成后的 full-state event 才标记 ready。[RemoteConversation](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/remote_conversation.py)；[ConversationStateUpdateEvent](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/event/conversation_state.py)
- **[推论]** “REST snapshot + live stream”之间必须有可验证的交接点；只做一次 REST 查询后盲接 live pub/sub 会有丢事件窗口。Gateway replay ring 和 snapshot cursor 应共同封闭此窗口。[RemoteConversation](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/remote_conversation.py)；[OpenCode eager subscription](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)

---

## 3. 三种拓扑比较（本节表格为架构推论）

下表是基于第 2 节事实对本项目约束作出的推论；各项依据链接集中列在表后的“事实依据”和“对本项目的推论”。

| 维度 | 1. Gateway 单 SSE 多路复用 | 2. 每 Session/Run 独立 SSE | 3. 全局通知 + Session 详情 |
|---|---|---|---|
| 多 Session 并行 | **可靠，推荐。** 一个 Gateway sequencer 串行分配传输 ID；各 Pi runtime 仍独立并行。单连接内可观察到 Gateway 接收顺序，Session 内以 `runSeq` 判定完整性。 | 每个 Session 自然隔离，单 Session 慢流不影响其他流；但连接生命周期和订阅竞态按 Session 成倍增加。 | 可靠，但需要同时维护通知 cursor 与详情 cursor；必须定义二者交接和重复事件规则。 |
| 顺序语义 | 一个全局 `gatewaySeq` + 每 Run `runSeq`；禁止把不同 Session 的相邻序号解释为业务因果。 | 每条流只保证本 Session 顺序；跨 Session 没有共同观察顺序。 | 两条流彼此无顺序保证；通知的状态版本必须能与详情 snapshot/cursor 比较。 |
| `Last-Event-ID` | 最自然：一条流只有一个全局 cursor，重连一次可补所有 Session。 | 每条流各有 cursor；后台 Session 若未开流，不能靠 `Last-Event-ID` 获得通知。 | 两套 cursor；详情流切换 Session 时还需初始 `after=` 或 snapshot cursor。 |
| replay gap | 一个 bounded ring；过期后一次 bootstrap/reconcile 所有受影响 Session。 | 每 Session ring/历史接口；隔离好，但状态、内存和测试矩阵膨胀。 | 通知流可长保留，详情流短保留；恢复最省带宽但协议最复杂。 |
| 慢客户端 | 一个 tab 的慢连接会阻塞该 tab 内所有 Session 的发送，所以必须独立有界队列并在溢出时 reset；不会阻塞其他客户端或 Pi producer。 | Session 间背压隔离最好；连接数和每流资源最差。 | 高频详情与低频通知隔离；当前 Session 卡顿时仍能看到其他 Session 状态。 |
| H1/H2 连接 | 每 tab 1 条，最稳。 | H1 下很快碰到共享 6 连接限制；H2 虽可多路复用，仍受协商 stream 上限。 | 每 tab 常态 2 条；H1 下 3 个 tab 已可能占满 6 条 SSE。 |
| 多标签页 | 初期每 tab 1 条；后续可用 SharedWorker 共享到 browser 级 1 条。 | `tab × active sessions`，最差。 | 通常 `tab × 2`；中等。 |
| 认证 | 单入口最简单；同源 cookie/Origin/Host 检查一次。 | 每个动态 URL 都要重复鉴权、授权和审计。 | 两入口、两类 scope；仍可共用同源 cookie。 |
| 适用场景 | Dashboard 同时观察多个并行 Session；当前约束。 | 少量固定 Session、强隔离、H2 已保证，或每 Session 由不同后端直接托管。 | 背景 Session 很多且高频详情只对当前视图有价值。 |

### 事实依据

- **[事实]** HTTP/2 只保证不同 HTTP stream 可多路复用和独立流控，不给不同 EventSource 建立业务顺序；SSE 的 last event ID 也属于各自 `EventSource`。[RFC 9113](https://www.rfc-editor.org/rfc/rfc9113.html)；[WHATWG EventSource](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)
- **[事实]** 原生 `EventSource` 的构造参数只有 URL 和 `withCredentials`；首次连接没有应用可设置的 `Last-Event-ID` 选项。[WHATWG EventSource interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)；[MDN EventSource constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)

### 对本项目的推论

- **[推论]** 拓扑 1 的主要代价是“单 tab 内的应用层 head-of-line”：若某次大输出填满客户端队列，同一流中的其他 Session 事件也会等待。通过按语义 coalesce、bounded queue、`stream.lagged` + snapshot 可把影响限制在该客户端，而无需提前支付拓扑 3 的双流一致性成本。[Hono streaming](https://github.com/honojs/hono/blob/main/src/utils/stream.ts)；[Hubcode snapshot fallback](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/session.ts)
- **[推论]** 拓扑 2 不适合作为 v2 基线：它把 Session 并行错误地映射成连接并行。Session 的执行并行应存在于 Gateway 后面的独立 Pi runtime/run coordinator 中，传输层只负责 multiplex。[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)；[MDN 连接限制](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)
- **[推论]** 拓扑 3 是明确的后续优化，而不是“更可靠”的默认方案。触发条件应是测得背景 delta 带宽/CPU 或单流 HOL 已成为瓶颈；否则双 cursor、双鉴权、切换竞态和额外连接不划算。[OpenHands REST + WS reconcile](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/remote_conversation.py)

---

## 4. 推荐协议

### 4.1 端点

```text
POST /api/sessions/:sessionId/runs              # 创建 run / prompt
POST /api/runs/:runId/cancel                    # 命令仍走 REST
POST /api/runs/:runId/permissions/:requestId    # 审批仍走 REST
GET  /api/bootstrap                             # snapshots + captured event cursor
GET  /api/events?after=<gatewayEpoch>:<seq>      # 唯一 SSE；after 仅用于首次连接
GET  /api/sessions/:sessionId/snapshot           # gap/lag 后定点恢复
```

- **[推论]** `/api/bootstrap` 应先捕获 Gateway cursor `C`，再读取 Session/Run snapshots，并把二者一起返回；客户端随后以 `?after=C` 首连。这样 snapshot 读取期间发生的事件会被 replay，最多重复、不会遗漏。后续自动重连优先使用浏览器发送的 `Last-Event-ID`。[WHATWG Last-Event-ID](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-last-event-id-header)；[OpenHands reconcile](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/remote_conversation.py)
- **[推论]** 若请求同时有 `Last-Event-ID` 和旧的 `after` query，服务端必须以前者为准；`after` 只是弥补原生 EventSource 首次连接不能自定义 header。[MDN EventSource constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)

### 4.2 事件 envelope 与顺序

```ts
type GatewayEvent = {
  schemaVersion: 1
  gatewayEpoch: string       // daemon 进程/日志代际
  gatewaySeq: number         // SSE id 使用 `${gatewayEpoch}:${gatewaySeq}`
  type: string
  sessionId?: string
  runId?: string
  runSeq?: number            // 同一 run 内严格递增
  durableEntryId?: string    // 若已到 Pi durable boundary
  emittedAt: string          // 仅诊断，不参与排序
  payload: unknown
}
```

- **[推论]** `gatewaySeq` 在事件进入 Gateway fan-out 时分配，作为单 SSE 的 replay cursor；`runSeq` 在各 Run coordinator 产生事件时分配，用于检测某个 Run 内的缺口。两者不能互相替代。[T3 Code sequence subscription](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)；[Hubcode epoch/seq cursor](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)
- **[推论]** 不用 timestamp 排序。并行 runtime 的时钟和调度不可建立因果关系；跨 Session 只承诺 Gateway 观察顺序，同一 Session/Run 才承诺业务顺序。[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)；[RFC 9113 stream order](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)
- **[推论]** 每个应用事件都写 SSE `id:`；heartbeat 用注释 `: ping`，不要推进游标。客户端保存每个 Run 的 last `runSeq`，重复事件 `<= last` 直接忽略。[WHATWG event stream interpretation](https://html.spec.whatwg.org/multipage/server-sent-events.html#interpreting-an-event-stream)

### 4.3 replay、gap 与 daemon 重启

- **[推论]** Gateway 维护按“事件数 + 总字节 + 时间”共同限制的内存 ring；阈值必须通过压力测试定标，不使用无界队列。ring 只保证短断线 replay，不升级为第二套 Pi 持久事件存储。[Hubcode timeline window/gap](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)
- **[推论]** cursor 在 ring 中：按 `gatewaySeq` 依次 replay 后转 live；cursor 早于 oldest、epoch 不同或格式无效：发送无 `id` 的 `event: stream.reset`（含 requested/oldest/latest/reason），随后关闭。客户端调用 `EventSource.close()`，重新取 bootstrap/snapshot，再建立新流。[WHATWG `close()` / reconnect](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)；[Hubcode `staleCursor/gap/reset`](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)
- **[推论]** replay 语义为 at-least-once。Pi 已完成消息由 `durableEntryId`/Session snapshot 对齐；未完成 token/tool progress 允许在 gap 后用 Run snapshot 重建，不承诺永久逐 token replay。[Pi RPC durable cursor](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/docs/rpc.md)

### 4.4 慢客户端与背压

每个 SSE 客户端独立维护：

1. bounded queue（同时限制 event count 与 bytes）；
2. 单一 async pump，严格 `await stream.writeSSE(...)`；
3. producer 发布只做非阻塞 enqueue，不逐客户端等待网络；
4. 可替换状态（token 聚合片段、progress、session status）按 key coalesce；
5. 达到硬上限时，强制投递 `stream.lagged`/`stream.reset` 并关闭该客户端，要求 snapshot 恢复；
6. `onAbort` 中取消订阅、timer 和 queue。

- **[事实]** Hono 的 `writeSSE()` 会等待底层 writer，`onAbort()` 提供清理点。[Hono SSE helper](https://github.com/honojs/hono/blob/main/src/helper/streaming/sse.ts)；[Hono stream lifecycle](https://github.com/honojs/hono/blob/main/src/utils/stream.ts)
- **[事实]** OpenCode 设置 `Cache-Control: no-cache, no-transform`、`X-Accel-Buffering: no`、`X-Content-Type-Options: nosniff` 并定期 heartbeat，避免代理缓冲/静默断流。[OpenCode event handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)
- **[推论]** 慢客户端只能牺牲自己的连续增量，不能拖住 Pi SDK callback、其他 Session 或其他浏览器连接；否则“一个单 SSE”会错误地变成全系统背压点。[Hubcode backpressure fallback](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/session.ts)

### 4.5 多 Session 并行的执行边界

- **[推论]** 每个 active Session 保持独立 Pi `AgentSession`/Run coordinator、命令队列和 `runSeq`；Gateway sequencer 只串行化 envelope ID 分配，不串行化 Session 执行。任一 Session 的 cancel/error/compaction 不得关闭全局 SSE。[Pi AgentSession](https://github.com/earendil-works/pi-mono/blob/3da591ab74ab9ab407e72ed882600b2c851fae21/packages/coding-agent/src/core/agent-session.ts)；[T3 Code provider/orchestration flow](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)
- **[推论]** envelope 必须始终带 `sessionId`；Run 相关事件再带 `runId/runSeq`。Vue store 以 `(sessionId, runId)` 分片 reducer，绝不依赖“当前打开的 Session”隐式路由。[T3 Code orchestration contracts](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)；[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)

### 4.6 多标签页

- **[推论]** v2 首先允许每 tab 一条全局 SSE；桌面单 WebView 自然只有一条。若浏览器多标签成为真实需求，再用 SharedWorker 持有唯一 EventSource，通过 `MessagePort` fan-out；不要为尚未出现的需求先实现 leader election。[WHATWG SharedWorker 建议](https://html.spec.whatwg.org/multipage/server-sent-events.html#authoring-notes)
- **[推论]** 必须测试 6 个标签页下 REST 命令是否仍及时；在 H1 环境中即使每 tab 仅一条 SSE，也可能占满同源连接配额。产品可限制后台 tab 建流，或届时启用 SharedWorker/H2。[MDN 连接限制](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)

---

## 5. 认证与远程扩展

- **[事实]** 原生 `EventSource` 只能配置 URL 与 `withCredentials`，没有自定义 `Authorization` header 参数；同源请求可带 cookie，跨源需显式 `withCredentials: true` 并满足 CORS。[WHATWG EventSource interface](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)；[MDN EventSource constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)
- **[事实]** `HttpOnly` 阻止 JS 读取 cookie，但 cookie 仍随 fetch 等请求发送；`SameSite` 限制跨站发送，`Secure` 限制 HTTPS（localhost 有特殊处理）。[MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)；[MDN secure cookie guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies)
- **[事实]** OWASP 明确反对把 session/token 放 URL query，因为即使 HTTPS 下仍可能进入浏览器历史、服务日志和中间系统。[OWASP query-string exposure](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)
- **[事实]** Hubcode local daemon 官方源码同时检查 allowed Host/Origin 并支持 bearer WebSocket 鉴权；其远程架构另设 E2E relay。这说明“绑定 localhost”与“认证/Host 校验”是不同防线。[Hubcode WebSocket server](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/websocket-server.ts)；[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)

### 对本项目的推论

1. **本地默认**：Gateway 仅监听 loopback；校验 `Host` 与 `Origin` allowlist；SPA 与 API 同源。不要因“单用户”完全省略本地访问控制。[Hubcode WebSocket server](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/websocket-server.ts)
2. **浏览器认证**：用一次性 bootstrap/登录流程换取短期 `HttpOnly; SameSite=Strict` session cookie；SSE、snapshot 与 REST 命令共享该 cookie。不要把长期 bearer 放 `/api/events?token=...`。[MDN secure cookie guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies)；[OWASP query-string exposure](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)
3. **远程阶段**：统一 HTTPS 同源入口、授权每个 Session/Run、校验 Origin，并对 REST mutation 加 CSRF 防护；SSE 鉴权失败返回非 `text/event-stream` 的 401/403，注销可用 204 终止自动重连。[WHATWG reconnect / 204](https://html.spec.whatwg.org/multipage/server-sent-events.html)
4. **桌面阶段**：桌面壳管理 daemon 生命周期和 cookie/bootstrap secret；renderer 仍只看 REST + SSE 公共协议，不直接持有 Pi runtime。该边界与 Hubcode “desktop 管理 daemon、客户端走同一协议”的官方架构一致。[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)

---

## 6. 何时改用 WebSocket

### 保持 SSE 的条件

- 客户端到服务端仍是低频、可请求/响应建模的 REST 命令；
- 服务端到客户端是 JSON 文本事件；
- 不做 PTY、音视频或二进制流；
- subscription 主要是“观察全部 Session”，不需要在同一连接上频繁创建/取消大量逻辑通道；
- snapshot + cursor replay 已能满足恢复。

**[推论]** 当前约束全部满足以上条件，因此不应因“多个 Session 并行”单独切 WebSocket。T3/Hubcode 使用 WebSocket 的同时还承载双向 RPC、PTY/二进制或远程 relay；这些并不是当前产品需求。[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)；[Hubcode binary multiplexing](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)

### 切换 WebSocket 的硬触发条件

出现任一项再评估：

1. PTY、stdin、音频、文件块等持续双向/二进制流；
2. 客户端每秒大量控制消息，REST 请求开销和响应关联成为瓶颈；
3. 单连接上需要动态 subscribe/unsubscribe 数百通道，并要求协议级 request/response/push；
4. 远程 relay 只能高效承载一条全双工隧道；
5. 测量证明 SSE/HTTP 代理兼容性无法满足部署，而非仅凭偏好。

- **[事实]** Hubcode 正是因为 terminal I/O、agent streaming、control message 和 relay 共存而采用 binary-multiplexed WebSocket；T3 Code 同一 WebSocket 同时处理 typed request 与 push。[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)；[T3 Code 架构](https://github.com/pingdotgg/t3code/blob/main/docs/architecture/overview.md)
- **[推论]** 改用 WebSocket不会自动解决 replay、gap、幂等或慢客户端；Hubcode/T3 仍显式实现 sequence、snapshot、ordered push 和 queue-backed worker。切换时应复用本报告 envelope/cursor/recovery 语义，只替换 wire transport。[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)；[T3 Code contracts](https://github.com/pingdotgg/t3code/blob/main/packages/contracts/src/orchestration.ts)

---

## 7. 验收测试

实施前把以下场景作为传输层契约测试：

1. **并行顺序**：至少 20 个模拟 Run 并发交错发事件；每个 `runSeq` 无缺失/逆序，跨 Run 不要求因果顺序。
2. **短断线 replay**：客户端在事件 N 后断开，服务端继续生产，重连携带 `Last-Event-ID=N`；最终状态与无断线一致，重复投递无副作用。
3. **过期 cursor / daemon 新 epoch**：得到 `stream.reset`，停止浏览器自动重连，bootstrap + snapshot 后恢复。
4. **慢客户端**：暂停读取直到队列超限；仅该客户端 lag/reset，Pi producer、其他 Session、其他客户端延迟不显著上升，内存有硬上限。
5. **订阅竞态**：在 stream 建立和 `stream.ready` 之间发事件，不得丢失；先注册订阅再发送 ready。
6. **多标签页/H1**：1、3、6 个标签页同时打开，验证 SSE、REST cancel/permission 命令与重连行为。
7. **认证**：错误 cookie、错误 Origin/Host、注销、远程 CORS、token 不出现在 URL/日志。
8. **代理行为**：验证 `no-transform`、禁缓冲、heartbeat、idle timeout 和 HTTP/1.1/2 实际协商结果。

- **[推论]** 只有以上测试通过，才能声称“多个 Session 并行可靠”；单次手工看到多个 token 流交错不构成可靠性验证。测试关注点来自 OpenCode 的订阅竞态处理、Hubcode 的 gap/backpressure 模型和 WHATWG 的重连语义。[OpenCode event handler](https://github.com/anomalyco/opencode/blob/b6478dce/packages/opencode/src/server/routes/instance/httpapi/handlers/event.ts)；[Hubcode AgentManager](https://github.com/hubtool/hubcode/blob/main/packages/server/src/server/agent/agent-manager.ts)；[WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 8. 最终决策建议

### Decision

采用 **REST Commands + Gateway Multiplexed SSE**：

- 每个 Vue tab 一个 `/api/events`；
- Gateway 全局 `epoch + seq` 作为 SSE `id` / replay cursor；
- 每个 Run 独立 `runSeq`；
- bootstrap/snapshot 与 cursor 交接；
- 每客户端有界队列、独立 pump、coalesce、`lagged/reset`；
- Pi durable entry 与 live delta 明确分层；
- loopback + Host/Origin 校验起步，远程使用同源 HTTPS + 安全 cookie；
- 协议保留未来拆成“全局通知 + Session 详情”的能力，但 v2 不先拆。

### Rejected for v2

- **每 Session/Run 独立 SSE**：连接数、多标签页、动态订阅和恢复状态随 Session 数增长，H1 风险不可接受。[MDN connection warning](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#warning)
- **立即使用双流拓扑**：在没有测得单流带宽/HOL 问题前，双 cursor 与 snapshot 交接属于额外复杂度。[OpenHands reconcile implementation](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/conversation/impl/remote_conversation.py)
- **立即改 WebSocket**：当前无 PTY、无二进制、命令已由 REST 覆盖；WebSocket 也不会免除 sequence/replay/backpressure 设计。[Hubcode 架构](https://github.com/hubtool/hubcode/blob/main/docs/ARCHITECTURE.md)
