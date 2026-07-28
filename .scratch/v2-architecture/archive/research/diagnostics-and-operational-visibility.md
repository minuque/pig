# Diagnostics 与 operational visibility：外部事实核验

> 目标：核验本地单用户 Node Gateway + Vue SPA + Pi SDK 的可观察性边界。本文只记录官方文档/规范/源码事实，并把架构建议单独标记。来源限定为 OWASP、OpenTelemetry、Node.js、IETF/RFC、Pi 官方文档或源码。

## 结论摘要

- **日志默认应是 allow-list 的结构化元数据，而不是请求/会话内容的镜像。** OWASP 明确要求排除 session ID、access token、密码、密钥、敏感个人数据和商业敏感信息；还要求对日志事件做 CR/LF 等字符清理以防 log injection。[事实][OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- **OpenTelemetry HTTP server span 语义约定当前标为 Stable；HTTP metrics 文档是 Mixed。** `http.server.request.duration` 是 Stable；`http.server.active_requests`、request/response body size 是 Development。HTTP request/response header 捕获是 opt-in 且官方警告可能泄露敏感信息；不能把任意 URL path 当作低基数 route。[事实][HTTP spans](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)[HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
- **Node 22 能提供进程级崩溃、诊断报告、source-map 栈和 HTTP 观测钩子，但没有内建 Prometheus/OTLP HTTP server 指标端点。** 可用 `process`/`perf_hooks`/`net.Server`，以及 Stability 1（Experimental）的 `diagnostics_channel` HTTP channels 自行计数/计时。[事实][Node process](https://nodejs.org/docs/latest-v22.x/api/process.html)[Node diagnostics_channel](https://nodejs.org/docs/latest-v22.x/api/diagnostics_channel.html)
- **IETF 没有统一规定 `/health`、`/live`、`/ready` 的路径或 health/readiness JSON。** RFC 8631 只注册可发现的 `status` link relation，并明确不约束表示形式；RFC 9110 提供普通 HTTP 状态语义，例如临时不可用可用 503，必要时用 `Retry-After`。[事实][RFC 8631](https://www.rfc-editor.org/rfc/rfc8631)[RFC 9110 §15.6.4](https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable)
- **Pi 的安全可观察面是 SDK/RPC 的状态与生命周期事件，不是把会话全文或 debug log 直接暴露给 SPA。** RPC `get_state` 给出 streaming/compacting/sessionFile/sessionId/message counts 等状态；`get_messages`、message/tool update 事件和 debug log 可能包含提示词、LLM 消息或工具输出。[事实][Pi SDK](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)[Pi RPC](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md)[Pi development/debug](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/development.md)

## 1. OWASP：日志记录与敏感数据排除

### 外部事实

1. OWASP Logging Cheat Sheet 将日志目标分为安全事件、审计、运维和问题诊断，并建议记录事件时间、事件类型、严重级别、请求/交互相关标识、结果、来源和必要的运维上下文；日志内容应结构化、可解析且避免高基数/无界内容。[事实][Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
2. OWASP 的 **Data to exclude** 明确列出：session identification values（如需追踪可考虑哈希）、access tokens、敏感个人数据/部分 PII、authentication passwords、encryption keys/其他 primary secrets、商业敏感信息，以及可能导致敏感数据泄露的内容。[事实][Logging Cheat Sheet — Data to exclude](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude)
3. OWASP 还指出日志本身可能包含密码、代码和应用逻辑；必须防止未授权读取、修改、删除和日志注入，并在检查/导出时考虑 exclude、mask、sanitize、hash 或 encrypt。[事实][Logging Cheat Sheet — Protection](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
4. OWASP 要求对事件数据做 CR、LF 和分隔符等清理，防止攻击者伪造日志行或字段；日志采集错误不应让应用整体不可用。[事实][Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
5. OWASP 对“日志里应该有什么”的例子包含 action、object、user type、结果/状态码等，而不是要求记录请求 body 或业务正文。[事实][Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### 架构建议（不是 OWASP 的项目特定规定）

- Gateway 日志采用固定 allow-list：`timestamp`、severity、component/version、event code、requestId、trace_id、span_id、opaque sessionId/runId、route template、HTTP status、duration、outcome、bounded error code、queue/replay counters。
- 默认不写 prompt、assistant text/thinking、tool args/results、HTTP body、cookie/auth header、API key、完整 query string、Pi JSONL 原文；路径/文件名也应按数据分类，必要时只保留类型或不可逆短摘要。
- “详细诊断”与“用户可见错误”分层：用户响应只给稳定 error code/instance；本地文件也先脱敏再进入 support bundle。不要仅在导出阶段补救，因为日志文件已经是敏感数据副本。

## 2. OpenTelemetry semantic conventions：HTTP、server、log correlation 与稳定性

### 外部事实

1. 当前 OpenTelemetry HTTP spans 文档顶部状态为 **Stable**，定义 HTTP client/server spans，涵盖 HTTP/HTTPS 及常见 HTTP 版本。[事实][HTTP spans](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)
2. HTTP server span 表示 inbound request，`SpanKind.SERVER`；核心字段包括 `http.request.method`、`url.path`、`url.scheme`、可用时的 `http.response.status_code`、低基数 `http.route`，以及 server/client/network 地址字段。`http.route` 必须是匹配的低基数模板；文档明确 URI path 不能替代 route。[事实][HTTP server span](https://opentelemetry.io/docs/specs/semconv/http/http-spans/#http-server-span)
3. HTTP spans 中，完整 URL 不得包含 URL credentials；可识别的敏感内容应 scrub。官方列出应默认 redact 的签名/凭据 query keys，并指出 request/response header 捕获必须显式配置，因为捕获全部 header 有泄露敏感信息的安全风险。[事实][HTTP URL/header guidance](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)
4. HTTP metrics 文档状态为 **Mixed**，并声明这些是初始 HTTP metric instruments，未来可能增加。`http.server.request.duration` 是 Histogram、单位秒、**Stable**、Recommended；`http.server.active_requests` 是 UpDownCounter、**Development**、Opt-In；`http.server.request.body.size` 和 `http.server.response.body.size` 也是 **Development**、Opt-In。[事实][HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
5. HTTP metrics 文档警告：以 HTTP header 推导 `server.address`/`server.port` 的 opt-in 维度可能被攻击者操纵以触发 cardinality limit，降低指标价值。[事实][HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
6. OTel 日志数据模型提供可选的顶层 `TraceId`、`SpanId`、`TraceFlags`；有 SpanId 时应同时有 TraceId。非 OTLP JSON 日志的稳定约定是顶层小写 `trace_id`、`span_id`、`trace_flags`，值按文档要求编码。[事实][OTel log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)[Trace context in non-OTLP logs](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/compatibility/logging_trace_context.md)
7. OTel 稳定性规则将 Development（旧文档可能称 Experimental）定义为可能发生 breaking changes、性能问题且不应建立长期依赖；Stable 才允许长期依赖。[事实][OTel versioning and stability](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/versioning-and-stability.md)
8. 当前 HTTP spans 中仍有明确 Development 的单项，例如 `http.request.body.size`、`http.request.size`、`http.response.body.size`、`http.response.size`、`url.template`，以及某些 well-known values（如 `QUERY`、synthetic user-agent type）；不能因为文档整体 Stable 就把这些单项当稳定公共合同。[事实][HTTP spans](https://opentelemetry.io/docs/specs/semconv/http/http-spans/)

### 架构建议

- Node Gateway 的 JSON log 顶层使用 OTel 兼容的 `trace_id`/`span_id`/`trace_flags`，同时保留本项目的 `requestId`/`runId`；不要把 session/run 业务 ID 伪装成 trace ID。
- v1 只依赖 HTTP server span 核心 stable 字段和 `http.server.request.duration`；active requests/body size 若采集，应标记为 OTel Development/项目内部指标并限制 cardinality。
- 不默认记录 query、headers、body size 以外的正文或工具 payload。即便 HTTP convention 允许 opt-in，也不替代 OWASP 的敏感数据排除。

## 3. Node 22：crash、unhandled rejection、diagnostic report、source maps、HTTP metrics

### 3.1 Crash 与 Promise rejection

#### 外部事实

- `uncaughtException` 默认会把 stack trace 写到 stderr 并以 code 1 退出；安装 handler 会覆盖默认行为。Node 明确说未捕获异常后应用处于 undefined state，不安全继续正常运行；handler 的正确用途是同步清理资源后关闭，可靠重启应由外部 monitor 完成。[事实][Node process — uncaughtException](https://nodejs.org/docs/latest-v22.x/api/process.html#event-uncaughtexception)
- `uncaughtExceptionMonitor` 可用于观察而不改变默认退出行为。[事实][Node process](https://nodejs.org/docs/latest-v22.x/api/process.html#event-uncaughtexceptionmonitor)
- `unhandledRejection` 在 Promise 被 reject 且一个 event-loop turn 内没有 handler 时触发；`rejectionHandled` 表示之后才补上 handler。因此“计数/记录未处理 rejection”需要同时处理增长和收缩。[事实][Node process — unhandledRejection](https://nodejs.org/docs/latest-v22.x/api/process.html#event-unhandledrejection)[Node process — rejectionHandled](https://nodejs.org/docs/latest-v22.x/api/process.html#event-rejectionhandled)
- Node 22 的 `--unhandled-rejections` 支持 `throw`、`strict`、`warn`、`warn-with-error-code`、`none`；默认是 `throw`。`throw` 在未安装 `unhandledRejection` hook 时会把 rejection 提升为 uncaught exception。[事实][Node CLI](https://nodejs.org/docs/latest-v22.x/api/cli.html#--unhandled-rejectionsmode)

#### 架构建议

- Gateway 应把 `uncaughtExceptionMonitor`/`unhandledRejection` 作为 crash marker 的观测入口，记录低基数原因、process uptime、PID、最后安全 operation ID，并准备退出/由外部进程重启；不要尝试恢复“健康运行”。
- 对 accepted Run 只记录 opaque `runId` 和 durable outcome；不要把 rejection reason 的任意 `message`、prompt 或工具输出原样写入日志。

### 3.2 Diagnostic report

#### 外部事实

- Node diagnostic report 的状态为 **Stable**；它写出 JSON summary，适用于开发、测试、生产问题定位，可由 unhandled exception、fatal error、signal 或 API 触发。[事实][Node report](https://nodejs.org/docs/latest-v22.x/api/report.html)
- 报告包含 JS/native stack、V8 heap、平台信息、资源使用、libuv handles、CPU/memory/system limits 等；示例 header 还包括 cwd、command line、PID、Node version 和网络接口等信息。[事实][Node report](https://nodejs.org/docs/latest-v22.x/api/report.html)
- `process.report.getReport([err])` 返回对象；`writeReport([filename][, err])` 写文件。报告目录默认是 Node 当前工作目录；可配置 filename/directory。[事实][Node report](https://nodejs.org/docs/latest-v22.x/api/report.html#processreportwritereportfilename-err)
- `reportOnFatalError`、`reportOnSignal`、`reportOnUncaughtException` 默认均为 false；`reportOnSignal` 在 Windows 不支持。`excludeNetwork` 可排除 networkInterfaces。[事实][Node report configuration](https://nodejs.org/docs/latest-v22.x/api/report.html#configuration)
- Node 22.13.0 新增 `--report-exclude-env`，而报告默认包含环境变量；Node 22.0.0 新增 `--report-exclude-network`。[事实][Node report](https://nodejs.org/docs/latest-v22.x/api/report.html)[Node CLI report options](https://nodejs.org/docs/latest-v22.x/api/cli.html#--report-exclude-env)

#### 架构建议

- 将原始 Node report 视为**敏感诊断文件**，不直接返回 SPA、不直接打包、不进入普通日志。至少默认排除 environment 和 network；对 cwd、commandLine、absolute paths、stack message、libuv endpoints 做 allow-list/脱敏。
- 先保留本地受限的原始报告，再生成一个可导出的 scrubbed projection；导出前还要对整个 bundle 做二次扫描，不能假定 Node report 的字段未来不变。

### 3.3 Source maps

#### 外部事实

- `--enable-source-maps` 不是实验性 CLI 选项；它为 stack traces 启用 Source Map 支持，在 transpiler 场景下尽力把栈定位到原始 source file。[事实][Node CLI — enable-source-maps](https://nodejs.org/docs/latest-v22.x/api/cli.html#--enable-source-maps)
- `node:module` 提供 `module.setSourceMapsSupport(enabled[, options])`；`process.sourceMapsEnabled` 和 `process.setSourceMapsEnabled()` 在 Node 22 文档标为 Stability 1（Experimental），而 CLI 选项本身已稳定。[事实][Node module](https://nodejs.org/docs/latest-v22.x/api/module.html#source-map-support)[Node process](https://nodejs.org/docs/latest-v22.x/api/process.html#processsetsourcemapsenabledval)

#### 架构建议

- 生产错误记录可启用 source maps 以提高 stack 可诊断性，但 bundle 只带映射后的 frame、包版本和稳定 error code；不要把原始 source、source map 内容或 prompt 拼入用户可见响应。注意 source map 可能暴露本地绝对路径。

### 3.4 HTTP server metrics 能获得什么

#### 外部事实

- Node `net.Server.getConnections(callback)` 可异步取得 server 当前并发连接数；这是连接数，不是 HTTP request count/latency/status histogram。[事实][Node net](https://nodejs.org/docs/latest-v22.x/api/net.html#servergetconnectionscallback)
- `http.Server` 原生提供 request/connection/response 生命周期、timeout、keep-alive 和 close 相关 API；应用可在这些生命周期上自行测 request duration、status、active requests、bytes。[事实][Node HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html)
- Node `diagnostics_channel` 的 HTTP built-in channels 包括 `http.server.request.start`、`http.server.response.created`、`http.server.response.finish`，以及 client 对应 channels；built-in channels 这一组文档标为 Stability 1（Experimental）。[事实][Node diagnostics_channel HTTP](https://nodejs.org/docs/latest-v22.x/api/diagnostics_channel.html#http)
- Node `perf_hooks` 可提供 `performance.eventLoopUtilization()` 和 `monitorEventLoopDelay()`；`process.memoryUsage()`、`process.resourceUsage()`、`process.uptime()` 和 `process.getActiveResourcesInfo()` 可用于进程资源/活动资源观测。[事实][Node perf_hooks](https://nodejs.org/docs/latest-v22.x/api/perf_hooks.html)[Node process](https://nodejs.org/docs/latest-v22.x/api/process.html)
- 以上 Node 文档没有给出内建 `/metrics`、Prometheus exposition 或 OTLP exporter；因此 HTTP metrics 需要应用或外部 OTel instrumentation 维护聚合、导出和 cardinality policy。[事实][Node HTTP](https://nodejs.org/docs/latest-v22.x/api/http.html)[Node diagnostics_channel](https://nodejs.org/docs/latest-v22.x/api/diagnostics_channel.html)

#### 架构建议

- v1 最小指标：request duration histogram、active requests gauge/counter、status class、route template、SSE client count、SSE lag/replay-gap counters、event-loop delay、RSS/heap、Pi active runs；以 route/status class/结果码维度为主。
- 使用 `diagnostics_channel` 前应封装成自己的 adapter，因为 Node 官方把这些 built-in channels 标为 Experimental；业务合同不要直接依赖 channel payload 的未声明字段。

## 4. Health/readiness endpoint：RFC 与通行约定

### 外部事实

1. RFC 9110 定义 HTTP 状态码语义。503 表示服务器暂时无法处理请求，通常是过载或维护；如果暂时状态有预计时间，可发送 `Retry-After`。RFC 没有定义 `/health`、`/live`、`/ready` 路径，也没有定义 JSON schema。[事实][RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable)
2. RFC 8631 的 `status` link relation 让 Web service 发现一个表示服务状态的资源；该 RFC 明确不限制该资源使用的具体 representation，因此不是 health/readiness endpoint 标准。[事实][RFC 8631 §5](https://www.rfc-editor.org/rfc/rfc8631.html#section-5)
3. RFC 9457 定义 `application/problem+json` 的通用 HTTP API 问题详情格式，可携带稳定 type/status/title/detail/instance 和扩展成员；它适合表达诊断失败，但没有定义 liveness/readiness。[事实][RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
4. 因此“liveness 表示进程是否活着、readiness 表示是否可接收工作”是通行的运维架构区分，不是 IETF 统一协议事实；路径、字段、依赖清单和状态机仍必须由本项目定义。[事实/边界核验][RFC 8631](https://www.rfc-editor.org/rfc/rfc8631)

### 架构建议

- 提供两个本地、受保护且不含敏感细节的 endpoint：
  - `live`：仅检查 HTTP 进程/事件循环仍能响应；不探测 Pi/SQLite，不因暂时下游故障把“进程活着”判死。
  - `ready`：检查启动迁移/锁/SQLite、Pi runtime、必要 session/project projection 是否完成；closing、migration failure、quarantine 或不可接受的 Pi 状态返回非 ready。
- 200 表示当前检查通过；暂时不能接收工作可使用 503，并按需返回 `Retry-After`。响应只给 `status`、bounded dependency codes、版本/epoch 等，不给路径、环境变量、错误栈、prompt、credentials。
- 若需要机器可读故障细节，可采用 RFC 9457 的 `application/problem+json`，但 `detail` 必须是安全、低基数的诊断文本。

## 5. Support bundle 安全设计可依据的官方规范

### 外部事实

- 没有找到 IETF 或 Node/Pi 专门规定“support bundle”格式、内容或传输协议；只能组合通用 HTTP、日志和秘密保护规范。RFC 8631 的 status resource 不是 support bundle 标准，RFC 9457 是错误响应格式而不是归档格式。[事实][RFC 8631](https://www.rfc-editor.org/rfc/rfc8631)[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
- OWASP Logging 要求排除 token/password/key/PII 等，并防止日志未经授权读取、篡改、删除和注入；这直接适用于 bundle 收集、归档和导出。[事实][OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- Node report 的 environment、command line、cwd、network、stack 和资源信息意味着原始 report 不能自动视为“无敏感数据”。[事实][Node report](https://nodejs.org/docs/latest-v22.x/api/report.html)
- Pi 官方 debug 命令会将 **渲染后的 TUI lines（含 ANSI codes）和发送给 LLM 的最近消息**写入 `~/.pi/agent/pi-debug.log`；这类文件可能包含 prompt、上下文和工具相关数据。[事实][Pi development/debug](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/development.md#debug-command)

### 架构建议

- bundle 使用 allow-list manifest，而不是“打包 logs/目录”：版本、采集时间、Gateway/Pi/Node 版本、启动/ready/crash marker、结构化聚合 counters、脱敏后的错误报告、最近安全 operation IDs、配置键名而非值。
- 明确排除：`auth.json`/API keys/OAuth、环境变量、Pi JSONL、`pi-debug.log` 原文、prompt/assistant/thinking、tool args/results、HTTP headers/cookies/body、源码/source maps、完整路径和网络接口；如确需加入，必须用户显式确认并逐字段脱敏。
- 生成前后做内容扫描和大小上限；使用临时目录、唯一 bundle ID、用户私有文件权限、短保留期；导出清单记录被排除/脱敏的类别，避免支持人员误以为 bundle 完整。
- 若 bundle 通过 Gateway 下载，使用受保护的一次性或短时授权引用；错误响应可用 RFC 9457，但不要把 bundle 内容或本地文件路径放入 `detail`/`instance`。

## 6. Pi SDK/CLI 可安全观察的运行状态与 debug/log 位置

### 外部事实

1. SDK `AgentSession` 暴露 `sessionFile`、`sessionId`、`model`、`thinkingLevel`、`messages`、`isStreaming`，并提供 `subscribe()`、`abort()`、`dispose()`；这说明 Gateway 可在同进程取得生命周期状态，但 `messages` 是会话内容，不是安全诊断字段。[事实][Pi SDK — AgentSession](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md#agentsession)
2. SDK 事件包括 `agent_start/end`、`turn_start/end`、`message_start/update/end`、`tool_execution_start/update/end`、`queue_update`、`compaction_start/end`、`auto_retry_start/end`、`extension_error` 等。`message_update` 和 tool update 是实时内容流，不能无过滤转发到日志或 diagnostics endpoint。[事实][Pi SDK — Events](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md#events)
3. AgentSessionRuntime 替换 session 后，`runtime.session` 会改变，原 session 的 subscriptions 不会自动迁移；runtime creation/replacement failure 会 throw，创建结果带 `runtime.diagnostics`。[事实][Pi SDK — AgentSessionRuntime](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md#createagentsessionruntime-and-agentsessionruntime)
4. Pi SDK 的 `ModelRuntime.checkAuth(provider.id)` 可返回 provider auth/status；runtime API key override 不持久化，`InMemoryCredentialStore` 可避免 credentials 落盘。观察 auth 时应只记录 provider ID 和状态，不记录 key/token/status 原文。[事实][Pi SDK — API Keys and OAuth](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/sdk.md#api-keys-and-oauth)
5. Pi RPC 的 `get_state` 可安全挑选出 `model`（需再次脱敏）、thinkingLevel、isStreaming、isCompacting、queue modes、sessionId、messageCount、pendingMessageCount 等；它也给出 `sessionFile`，该路径不应直接暴露给浏览器。[事实][Pi RPC — get_state](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md#get_state)
6. Pi RPC 还提供 `get_session_stats`，包括 message/tool counts、token usage、cost 和 context usage；这些可作为本地诊断聚合，但仍不应包含消息正文，且 cost/provider/model 信息应按产品隐私策略处理。[事实][Pi RPC — get_session_stats](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md#get_session_stats)
7. Pi RPC 事件通过 stdout 以 JSON lines 流式输出；事件通常没有 id，`bash_execution_update` 在提供 command id 时会带来源 id。RPC `get_messages` 明确返回完整 `AgentMessage` 列表，不能视作安全状态端点。[事实][Pi RPC](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md#events)[Pi RPC — get_messages](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/rpc.md#get_messages)
8. Pi 官方 development 文档说明隐藏 `/debug` 会写 `~/.pi/agent/pi-debug.log`，内容包括带 ANSI 的 TUI lines 和最近发送给 LLM 的消息；源码 `getDebugLogPath()` 以当前 agent dir 拼接 `${APP_NAME}-debug.log`。因此有效位置默认是 Pi agent dir 下的 `pi-debug.log`，但实际 agent dir 可由 Pi 配置/环境覆盖。[事实][Pi debug command](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/development.md#debug-command)[Pi config source](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/config.ts)

### 架构建议

- Gateway 对 SPA 暴露一个安全的“运行时 projection”：`gatewayState`、`readyState`、`activeRunCount`、每个 Run 的 phase/outcome、Pi `isStreaming/isCompacting`、queue counts、retry/compaction counters、last safe error code、replay cursor/lag；不要暴露 Pi 的 `messages`、`sessionFile`、tool update payload 或 debug log。
- Pi event subscription 只映射生命周期事件和 bounded metadata；`message_update`、`thinking_delta`、tool output 只按现有业务 SSE 合同传递给已授权的 transcript consumer，不进入普通 operational log。
- SDK session replacement 时由 Gateway 统一重新绑定 subscription，并把 replacement failure 记录为稳定错误码；不要把异常对象直接序列化给 Vue。

## 7. 最小可核验清单

- [ ] 日志字段 allow-list；OWASP 排除 token/password/key/PII；CR/LF sanitize。
- [ ] JSON 日志顶层 `trace_id`/`span_id`；route 使用低基数模板；不捕获全量 headers/query/body。
- [ ] HTTP server span / `http.server.request.duration` 与 Development 指标分开标注。
- [ ] `uncaughtException` 后同步清理并退出；`unhandledRejection` 与 `rejectionHandled` 成对观测；由外部 monitor 重启。
- [ ] Node report 默认排除 env/network，原始 report 只在受限本地位置；导出前二次 scrub。
- [ ] source maps 只用于安全 stack 定位，不随 bundle 携带 source 内容。
- [ ] liveness/readiness 是项目合同；503/Retry-After 遵守 RFC 语义；失败细节采用安全 problem details。
- [ ] support bundle 是 allow-list、私有权限、大小/保留受限的脱敏归档；不收集 Pi debug/session/message 原文。
- [ ] Pi 仅观察安全状态字段与生命周期事件；`get_messages`、message/tool events、`pi-debug.log` 明确标为内容敏感。
