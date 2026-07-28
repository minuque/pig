# Vue 状态边界调研

## 决策结论（架构建议）

| 状态 | 唯一归属 | 边界规则 |
|---|---|---|
| REST server-state | TanStack Vue Query | Query cache 保存可由 REST 获取的事实；query key 必须包含所有影响请求的 identity/filter。不要再复制一份到 Pinia。 |
| SSE live overlay | 专用 Pinia setup store（按 `sessionId` 分区） | 保存连接状态、事件序号/epoch、增量 overlay；事件先进入无框架纯 reducer，再由 store 提交结果。不要让 SSE 事件直接改 Query cache，除非该事件确实是可验证的权威资源更新。 |
| route-owned identity | Vue Router | 稳定资源身份放 path params（如项目、session、对象 ID）；可分享、可回退的搜索/过滤/分页放 query。路由是输入源，Query key 从它派生。不要把 identity 再复制为 Pinia 真相。 |
| component-local UI state | 组件 `setup()` 的 `ref`/`reactive` | 弹窗、临时草稿、hover、当前 tab 等仅由该组件拥有；只有需要跨组件/跨页面或持久化语义的状态才提升。 |

## 官方事实

### TanStack Vue Query

- 官方将 Query 定义为 fetching、caching、synchronizing、updating **server state**；同一 key 的实例共享 cache，inactive 数据按 `gcTime` 回收。  
  [Overview](https://tanstack.com/query/latest/docs/framework/vue/overview) · [Caching](https://tanstack.com/query/latest/docs/framework/vue/guides/caching)
- `invalidateQueries` 会将匹配 query 标记为 stale；活跃观察者会后台 refetch，并支持 prefix、exact、predicate 匹配。  
  [Query Invalidation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-invalidation)
- `setQueryData` 可用 mutation 返回值同步更新 cache；更新必须 immutable，不能原地改旧值。  
  [Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/vue/guides/updates-from-mutation-responses) · [QueryClient API](https://tanstack.com/query/latest/docs/reference/QueryClient)
- 默认启用 structural sharing：JSON-compatible 结果未变化时保留旧引用；非 JSON 值不保证，亦可配置自定义 structural-sharing 函数。  
  [Important Defaults](https://tanstack.com/query/latest/docs/framework/vue/guides/important-defaults)
- query function 收到 `AbortSignal`；消费 signal 后，取消会中止请求并将 query 状态恢复到此前状态；`cancelQueries` 可手动取消。默认未消费 signal 时，组件卸载不会取消请求，结果仍可入 cache。  
  [Query Functions](https://tanstack.com/query/latest/docs/framework/vue/guides/query-functions) · [Query Cancellation](https://tanstack.com/query/latest/docs/framework/vue/guides/query-cancellation)
- query key 顶层必须是数组、可序列化且唯一描述数据；请求依赖的变量应进入 key，变化后会独立缓存/按配置 refetch。  
  [Query Keys](https://tanstack.com/query/latest/docs/framework/vue/guides/query-keys)

### Pinia

- Setup store 用 `defineStore(id, setup)`；返回的 ref/reactive 是 state，computed 是 getter，函数是 action。Setup store 必须自行实现 `$reset()`。  
  [Defining a Store](https://pinia.vuejs.org/core-concepts/) · [State / Reset](https://pinia.vuejs.org/core-concepts/state.html)
- `$patch` 支持对象或函数；函数 patch 可把多次集合修改合并为一次 mutation。Pinia 不能直接替换整个 store state，否则会破坏响应性；应 patch。  
  [State / Mutating and Replacing](https://pinia.vuejs.org/core-concepts/state.html)
- `$subscribe` 基于 Vue `watch`；patch 函数后只触发一次，可传 watch 选项（如 `flush: 'sync'`）。组件 setup 中创建的订阅默认随组件卸载，`detached: true` 可脱离组件。  
  [State / Subscribing](https://pinia.vuejs.org/core-concepts/state.html)
- 官方源码显示 setup store 在 Pinia effect scope 中运行，并在 `$dispose()` 时停止该 store scope；这不会替应用外部创建的 SSE/网络资源自动调用 close，资源仍须显式清理。  
  [Pinia store.ts](https://github.com/vuejs/pinia/blob/v3/packages/pinia/src/store.ts)

### Vue 与 Vue Router

- `effectScope()` 捕获其中创建的 reactive effects（computed/watch），`stop()` 一并停止；`onScopeDispose()` 注册 scope 停止时的清理回调，是非组件耦合的 cleanup 方式。  
  [Advanced Reactivity](https://vuejs.org/api/reactivity-advanced.html) · [Vue effectScope source](https://github.com/vuejs/core/blob/main/packages/reactivity/src/effectScope.ts)
- Vue Router 将动态 path segment 暴露为 `route.params`；route 还暴露 `route.query`。同一组件实例在 params 改变时可能复用，因此应监听具体字段而不是整对象。  
  [Dynamic Matching](https://router.vuejs.org/guide/essentials/dynamic-matching) · [Composition API](https://router.vuejs.org/guide/advanced/composition-api)
- `router.push`/`replace` 支持 `query`；若 location 同时给 `path` 和 `params`，params 会被忽略，按命名路由传 params 才由 Router 构造 URL。  
  [Programmatic Navigation](https://router.vuejs.org/guide/essentials/navigation)

## 单 Gateway SSE + 多并行 Session

### 可测试的纯 reducer

这是架构建议，不是四个库提供的现成 API：定义无 Vue/Pinia/Query 依赖的 `reduceOverlay(previous, event) -> next`，测试输入事件序列即可验证顺序、重复、跨 session 隔离和旧 epoch 丢弃。Gateway 只负责连接与分发；reducer 按 `sessionId` 路由到对应 overlay。

- Pinia 的 `$patch(fn)` 适合作为提交边界，`$subscribe` 适合记录/持久化，不应成为 reducer 本身。
- Query 的 `setQueryData(key, old => next)` 支持把同一纯 reducer 作为 immutable updater；但它是 cache 更新 API，不是 SSE 管理器。
- 四个官方库均未提供“单一 SSE Gateway + 多 Session”或事件 reducer；连接复用、背压、事件序号和协议均属应用层。

### 重连与 snapshot reset

建议把重连视为新 epoch：先关闭/失效旧连接，丢弃旧 epoch 事件；拿到 REST snapshot 后用纯 `reset(snapshot)` 重建每个 session overlay，再接受新 epoch 增量。不要在旧 overlay 上盲目继续累加。

- overlay reset：Pinia setup store 暴露自有 reset action；内部用 `$patch` 更新，或清空并写入按 session 分区的 state。
- REST snapshot：权威 snapshot 可用 Query `setQueryData` 写入对应 key；若只知道已过期，则用 `invalidateQueries` 让活跃 query 后台重取。需要恢复 Query 初始状态时使用 QueryClient 的 `resetQueries`，不要把它当作 SSE overlay reset。
- 连接清理：把 Gateway 生命周期放在应用级 setup store/独立 effect scope；用 `onScopeDispose`/scope `stop()` 显式 close，并避免每个 Session 组件各建一条连接。Pinia `$dispose` 只保证其 scope/subscription 被释放，不能替代网络资源清理。
- route 切换导致的 REST 请求应消费 Query 提供的 `AbortSignal`；SSE 连接则用独立 epoch/显式 close，因为 Query cancellation 不覆盖 SSE。

## 事实与建议的边界

上述“放哪里”及 epoch、纯 reducer、单 Gateway 是架构建议；官方事实仅证明各库的 cache/update/invalidation/cancellation、Pinia setup/subscription、Vue scope cleanup、Router params/query/navigation 能力，不证明某种状态划分是唯一正确方案。
