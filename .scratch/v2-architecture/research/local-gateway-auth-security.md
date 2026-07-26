# 本地 Agent Gateway 认证与浏览器安全事实调研

> 范围：绑定随机 loopback 端口、由 npm CLI 启动、服务同源 SPA 的 Node/Hono Gateway。本文只记录规范/官方资料核验结果，并把“事实”和“工程建议”分开；不替项目决定最终方案。资料访问日期：本次调研时点。

## 0. 先区分安全边界

### 规范/事实

- HTTP 的 `Host` 表示请求目标 URI 的 authority；HTTP/1.1 请求必须有 `Host`，服务端据此确定目标主机。它是路由/目标信息，不是加密证明，也不能单独证明请求来自 SPA。见 [RFC 9110 §7.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.2)。
- DNS rebinding 的关键在于：浏览器页面的来源（origin）与解析后的连接地址不是同一件事。OWASP 将 DNS rebinding 列为缺少适当 DNS 绑定/校验时可绕过同源限制的风险；Host header 未验证也会导致应用按攻击者提供的主机名生成链接或选择虚拟主机。见 [OWASP C8](https://top10proactive.owasp.org/the-top-10/c8-leverage-browser-security-features/)、[OWASP Host Header Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection)。
- loopback 绑定限制的是网络监听范围，不会自动阻止同一用户会话中另一个网页、浏览器扩展、本机进程或非浏览器 HTTP 客户端访问该端口。浏览器把 `localhost`、`127.0.0.0/8`、`::1/128` 视为“potentially trustworthy”与 Secure Context 的问题，和“谁有权调用本地 HTTP 服务”不是同一个认证结论。见 [W3C Secure Contexts §3.1、§5.2](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)。

### 工程建议（不是规范强制）

- 把 loopback 绑定视为减小暴露面的第一层，而不是认证。对每个请求在业务处理前做**精确的 Host/authority allowlist**：固定允许的 scheme、主机字面量和当前随机端口；拒绝任意 DNS 名称、异常端口、重复/畸形 Host。不要把未经信任代理验证的 `X-Forwarded-Host` 当作替代值。
- Host 校验通过后仍检查 `Origin` 与 Fetch Metadata；Host、Origin、Cookie/Authorization 共同构成检查链，而非互相替代。不要用 Host 或 Origin 单独当作凭据。

## 1. Host、Origin 与 Fetch Metadata

### 1.1 Host 与 DNS rebinding

### 规范/事实

- HTTP 目标 URI 的 authority 包含 host 和 port；服务器应把收到的 Host 与请求目标的 authority 一致性作为请求解析的一部分，且 HTTP/2/3 使用 `:authority`。见 [RFC 9110 §7.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.2)。
- OWASP 的测试材料明确指出：服务器经常按 Host 选择虚拟主机；未验证 Host 可导致攻击者控制重定向、链接或缓存键。见 [OWASP WSTG：Host Header Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection)。

### 工程建议

- 不要根据 Host 动态生成“可信 origin”再回显给客户端；应先将 Host 解析成规范化的 `(scheme, hostname, port)`，与启动时保存的预期值逐字段比较。若支持 `localhost` 和 `127.0.0.1` 两个入口，应意识到它们是不同 host，Cookie 作用域也不同；这应是显式兼容决定，不应由任意 Host 自动放行。
- 不把“请求连接到了 127.0.0.1”当作足够条件：DNS rebinding/Host 注入的防线是拒绝非预期 Host；本机非浏览器客户端仍可直接构造任意 Host，因此还需要真正的凭据校验。

### 1.2 Origin 校验

### 规范/事实

- Origin 是浏览器描述发起请求的来源（scheme、host、port）的请求头；跨源请求通常携带它，同源的某些 GET/导航请求可能没有。`Origin` 属于浏览器控制的 forbidden request header，页面脚本不能通过 Fetch/XHR 任意改写，但服务器不能假设所有客户端都是浏览器。见 [WHATWG Fetch §Origin header](https://fetch.spec.whatwg.org/#http-origin)、[MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin)。
- `null` 是可能的 Origin 值（例如某些隐私/opaque-origin 场景），不能把任意存在的 Origin 都视为可信。见 [MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin)。
- 同源策略限制脚本读取跨源响应；CORS 是服务器向浏览器声明哪些跨源响应可被读取的协议，不是服务端认证协议。见 [WHATWG Fetch §CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)、[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)。

### 工程建议

- 对需要 Cookie/会话的 API，精确比较 `Origin` 与启动时的 SPA origin（scheme、host、port 全部匹配）；不接受任意后缀、通配符或 `null`。对无 Origin 的请求不能直接放行写操作：按兼容性需要进入 Fetch Metadata/Referer/独立 CSRF token 的回退链。
- 只校验 Origin 仍不是认证：`curl` 等非浏览器客户端可伪造该头。Origin 校验主要解决浏览器跨站上下文，Cookie/会话或未来客户端凭据解决“是谁”。

### 1.3 Fetch Metadata

### 规范/事实

- Fetch Metadata 定义 `Sec-Fetch-Site`、`Sec-Fetch-Mode`、`Sec-Fetch-Dest`、`Sec-Fetch-User`；`Sec-Fetch-Site` 的合法值包括 `same-origin`、`same-site`、`cross-site`、`none`，表达发起方与目标的关系。见 [W3C Fetch Metadata §2.3](https://www.w3.org/TR/fetch-metadata/#sec-fetch-site-header)。
- `Sec-` 前缀使这些请求头不能被网页 JavaScript 修改；规范同时说明扩展、重定向和用户代理上下文会影响其值。见 [W3C Fetch Metadata §4.2](https://www.w3.org/TR/fetch-metadata/#sec-fetch-prefix)、[§2.3](https://www.w3.org/TR/fetch-metadata/#sec-fetch-site-header)。
- 头可能缺失（旧浏览器、非浏览器客户端、隐私/中间件处理）；OWASP 明确要求 Fetch Metadata 方案保留 Origin/Referer 等回退，且将其描述为防御纵深。见 [OWASP CSRF Prevention：Fetch Metadata](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#fetch-metadata-headers)。

### 工程建议

- 对状态改变 API，浏览器请求可将 `Sec-Fetch-Site: cross-site`、通常的 `same-site`（若不信任其他同站 origin）拒绝；`same-origin` 才进入正常处理。`none` 更适合只读/顶层导航策略，不应未经方法和 CSRF 约束就放行写操作。
- Fetch Metadata 缺失时使用明确的回退策略；不能把“头不存在”当成“同源”。若响应依赖这些头，按规范提示设置相应 `Vary`，例如 `Vary: Sec-Fetch-Site, Origin`。见 [W3C Fetch Metadata §4.1](https://www.w3.org/TR/fetch-metadata/#integration-with-fetch)。

## 2. Bootstrap token 与凭据泄露

### 2.1 一次性交换

### 规范/事实

- RFC 6749 对 authorization code 的安全语义是：应在短时间后过期，客户端不得重复使用；重复使用必须拒绝。它还警告通过用户代理重定向传送的 code 可能出现在浏览器历史和 HTTP Referer 中。见 [RFC 6749 §4.1.2](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2)、[§10.5](https://www.rfc-editor.org/rfc/rfc6749.html#section-10.5)。这不是本地 Gateway 自定义 bootstrap token 的直接规范，但可作为“一次性短期兑换凭据”的高权威先例。

### 工程建议

- 将 CLI 启动时生成的 bootstrap token 视为一次性 bearer capability，而不是长期 API 密钥：使用密码学安全随机值；绑定本次 Gateway 实例/端口（如适用）；设置短过期；兑换成功后原子地标记已消费；重放、过期、格式错误均拒绝；不要把它继续用于每个 API 请求。
- 兑换接口与普通 API 认证接口应是独立 seam：`bootstrap -> 会话凭据`。未来受控远程客户端可以在同一认证验证接口下增加明确的客户端凭据类型/策略，而不必把本地 bootstrap token 直接暴露成远程长期凭据。这里是架构建议，不是产品方案。

### 2.2 启动 URL：fragment 与 query

### 规范/事实

- URI fragment 由用户代理解释，不参与 scheme-specific retrieval；HTTP 请求目标不包含 fragment。见 [RFC 3986 §3.5](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.5)、[RFC 9110 §7.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-7.1)。
- query 属于 HTTP URI 的请求目标；fragment 不会发送给 HTTP 服务器。见 [RFC 3986 §3.3–§3.5](https://www.rfc-editor.org/rfc/rfc3986.html#section-3.5)。
- RFC 6749 特别指出经用户代理传递的凭据可能通过历史和 Referer 暴露；这是把长期/高价值 token 放进 URL query 的已知风险。见 [RFC 6749 §10.5](https://www.rfc-editor.org/rfc/rfc6749.html#section-10.5)。

### 工程建议

- 若必须由 SPA 从 CLI 启动 URL 取得 bootstrap token，`#fragment` 能避免 token 出现在初始 HTTP 请求、服务器访问日志和常规 HTTP Referer 中；SPA 读取后应尽快用 History API 清除。它**不是机密存储**：同页面脚本、XSS、浏览器历史/地址栏、扩展或用户复制仍可能看到它。
- 不把 session/access token 放在 query；query 会到服务器并可能进入访问日志、代理日志、历史及后续泄露链。bootstrap 也不应在页面上停留超过兑换所需时间。若选择 query 是为了让服务端直接读取，则必须把上述泄露面当作明确的风险，而不是把 HTTPS/loopback 误认为能消除它。

## 3. Cookie 语义与本地 HTTP 现实

### 3.1 属性事实

- `HttpOnly` 阻止脚本通过 `document.cookie` 等非 HTTP API 读取 Cookie，但 Cookie 仍会随 JavaScript 发起的 `fetch()`/XHR 请求发送；因此 HttpOnly 防窃取的一部分，不等于防 CSRF。见 [MDN Set-Cookie：HttpOnly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly)、[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。
- `SameSite=Strict` 只在同站上下文发送；`Lax` 允许较窄的跨站场景，主要是顶层安全方法导航；`None` 允许跨站发送，并且必须同时有 `Secure`。未指定时，现代浏览器通常采用 Lax 的默认行为，但应显式设置而不要依赖默认。见 [MDN Set-Cookie：SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesite)。
- `Secure` 表示仅在 HTTPS 请求发送，但 MDN 明确记录了 `localhost` 的例外；不安全站点通常不能设置 Secure Cookie，而 `localhost` 设置时 HTTPS 要求被忽略。这个例外不能自动外推到所有浏览器对 `http://127.0.0.1` 的行为。见 [MDN Set-Cookie：Secure](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure)。
- Secure Contexts 把 `127.0.0.0/8`、`::1/128` 和符合规则的 `localhost` 视为 potentially trustworthy，是 Web API 的安全上下文判定；它不等价于 MDN 对 Secure Cookie 的 localhost 例外。见 [W3C Secure Contexts §3.1](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)、[§5.2](https://www.w3.org/TR/secure-contexts/#localhost)。
- `Path` 决定浏览器在哪些请求路径发送 Cookie；它不是安全边界，也不能阻止另一路径的脚本读取 Cookie。见 [MDN Set-Cookie：Path](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#path)。
- `Max-Age` 是秒数；0 或负数立即过期；同时存在 `Max-Age` 与 `Expires` 时以 `Max-Age` 为准。两者都没有时是 session cookie，通常在客户端会话结束时删除。见 [MDN Set-Cookie：Max-Age](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber)、[Session cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#session_cookie)。
- `__Host-` 前缀要求 Secure、`Path=/`、不得有 `Domain`，并要求从安全（HTTPS）页面设置；它提供 host-wide、host-only 的约束。不要假定普通 HTTP localhost 上即使能设置 `Secure`，也必然满足所有 `__Host-` 前缀实现约束。见 [MDN Set-Cookie：Cookie prefixes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes)。

### 3.2 工程建议

- 会话 Cookie 的最小候选语义通常是：`HttpOnly`、显式 `SameSite=Strict`（若业务导航兼容性允许，否则评估 Lax 的跨站顶层导航语义）、`Path=/`、短且明确的 `Max-Age`；在 HTTPS 部署加 `Secure`。是否使用 `__Host-`、是否允许持久会话、Max-Age 数值均需结合产品生命周期决定。
- 本地 `http://localhost` 与 `http://127.0.0.1` 应分别在目标浏览器/版本验证 Secure Cookie 的设置、回送、删除和前缀行为；不要用“loopback 是 secure context”替代 Cookie 兼容性测试。若必须跨浏览器稳定使用 `Secure`/`__Host-` 语义，HTTPS（本地受信证书或其他明确机制）的取舍需要单独决策。
- 删除 Cookie 时必须复用相同的 name、host/domain 作用域和 Path；否则可能只删除了另一个 Cookie 条目（该结论来自 Cookie 按作用域匹配的语义，属性细节见 [RFC 6265 §4.1.2](https://www.rfc-editor.org/rfc/rfc6265.html#section-4.1.2) 和 [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)）。

## 4. CSRF：SameSite/Origin 是否足够

### 规范/事实

- CSRF 的根本条件是浏览器自动携带已有凭据（尤其 Cookie）执行攻击者诱导的请求；HttpOnly 不改变这一点。见 [OWASP CSRF](https://owasp.org/www-community/attacks/csrf)、[MDN HttpOnly](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly)。
- OWASP 建议现代浏览器可用 Fetch Metadata 加标准 Origin/Referer 校验；也明确说明要考虑缺少这些头的客户端/浏览器，并把 token、SameSite、Origin/Referer、Fetch Metadata 作为不同层次的措施。见 [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。
- CORS 失败通常阻止攻击页面读取响应，但简单请求、表单导航等不需要预检；所以“关闭 CORS”不能单独防止带 Cookie 的状态改变。见 [WHATWG Fetch §CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)、[OWASP CSRF](https://owasp.org/www-community/attacks/csrf)。

### 工程建议

- 对所有 Cookie 认证的非幂等/状态改变 API，建议保留独立 CSRF token（同步 token 或双提交变体）或一个等价、明确证明覆盖所有请求来源的 CSRF 方案；不要把 SameSite、Origin 或 Fetch Metadata 单独当作永久替代。特别是要覆盖：无 Origin、缺少 `Sec-Fetch-*`、顶层导航、同站但非同源来源、非浏览器客户端和未来客户端。
- 只读 GET/SSE 应保持无副作用；不能用“GET 不需要 CSRF”掩盖 GET 的业务写入。Token 的传输方式应避开 URL query，通常由同源 SPA 通过响应/DOM 或受保护接口取得，并在写请求中显式提交。

## 5. SSE 与 EventSource 认证边界

### 规范/事实

- EventSource 构造器接受 URL 和 `EventSourceInit`；`withCredentials` 默认 `false`，设为 `true` 时将跨源连接的 credentials mode 设为 include。见 [WHATWG HTML §9.2.2](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)、[MDN EventSource()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)。
- EventSource API 没有类似 `fetch()` 的任意 request headers 选项；规范算法只允许用户代理设置必要的 SSE/Fetch 头。因此浏览器原生 EventSource 不能直接配置 `Authorization: Bearer ...`。见 [WHATWG HTML EventSource 构造与请求算法](https://html.spec.whatwg.org/multipage/server-sent-events.html#the-eventsource-interface)。
- 跨源 EventSource 若使用 credentials，需要服务端返回精确的 `Access-Control-Allow-Origin` 和 `Access-Control-Allow-Credentials`；通配 `*` 不能与凭据模式组合。见 [WHATWG Fetch §CORS protocol and credentials](https://fetch.spec.whatwg.org/#http-cors-protocol)、[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)。
- SSE 是单向服务器到客户端的事件流；Hono 的 `streamSSE` 会设置 `text/event-stream` 等流响应语义。见 [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)。

### 工程建议

- 同源 SPA 的 SSE 优先复用已建立的 HttpOnly 会话 Cookie；EventSource 的 URL 不承载长期 bearer token。跨源受控客户端未来若必须使用 EventSource，要单独设计 CORS、credentials 和凭据生命周期；不能假定 EventSource 能发自定义 Authorization header。
- SSE 端点只读、无副作用；在连接建立时照常做 Host、Origin/Fetch Metadata、会话认证。若未来客户端需要自定义 header/更丰富的握手认证，浏览器端可评估 `fetch()` 流式读取或其他协议，但这不属于 EventSource 本身的能力。
- 不建议用 query token 解决 EventSource 的 header 限制：它会扩大日志、历史、Referer 和监控系统的暴露面；若不得不用，token 应是短期、一次性、最小权限，并按上述 URL 泄露风险评估。

## 6. CORS 默认关闭与未来远程客户端 seam

### 规范/事实

- 同源 SPA 调用同源 API 不需要 CORS。CORS 是为跨源读取开放响应的机制；未授予 CORS 时浏览器仍可能发出某些跨源请求，只是脚本不能读取响应。见 [WHATWG Fetch](https://fetch.spec.whatwg.org/#http-cors-protocol)、[MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)。
- Hono 的 `cors()` 中间件文档显示：若调用但不配置 `origin`，默认 `Access-Control-Allow-Origin` 为 `*`；`credentials` 另行控制 `Access-Control-Allow-Credentials`。这意味着“应用默认不启用 CORS”和“Hono cors() 的默认配置”不能混为一谈。见 [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)。

### 工程建议

- 本地模式默认不注册全局 CORS 中间件、不返回 `Access-Control-Allow-Origin: *`，也不动态反射任意 Origin。未来确需远程客户端时，仅为明确的 API 路径和明确 allowlist 开启 CORS，并精确回显允许的 Origin；凭据模式不使用 `*`。
- 在认证层保留与 HTTP 传输解耦的接口：请求上下文先由 Host/来源策略过滤，再由“本地会话 Cookie / 未来受控客户端凭据”验证，最后由授权层检查能力。这样可以保留远程认证 seam，而不把本地 loopback、浏览器来源或 CORS 误当成远程认证。

## 7. 最小验证清单（事实转为可测试断言）

以下是建议的验证项，不是已采用的产品方案：

1. 任意非预期 Host、端口、DNS 名称、`X-Forwarded-Host` 均不能使服务回显/重定向到该值或进入 API。
2. 从外站页面发起带 Cookie 的简单 GET/POST、表单、跨站导航：写 API 被 Host + Origin/Referer + Fetch Metadata/CSRF 策略拒绝。
3. 缺少 `Origin` 或 `Sec-Fetch-*` 的请求不能绕过写 API 的回退策略；非浏览器客户端伪造这些头仍必须缺少有效会话/CSRF 凭据才能失败。
4. bootstrap token：过期、重复兑换、并发双兑换、错误实例/端口、错误来源均失败；兑换后日志和错误响应不包含原 token。
5. `#fragment` token 不出现在初始 HTTP request-target/访问日志；SPA 兑换后 URL 被清理；query token 的日志/Referer/历史风险有测试或明确接受记录。
6. 目标浏览器分别测试 `http://localhost`、`http://127.0.0.1`（必要时 IPv6）：Secure Cookie 设置、回送、删除、SameSite 和 `__Host-` 前缀行为。
7. SSE：无会话失败；同源 Cookie 会话成功；EventSource 不依赖自定义 Authorization header；跨源 credentials 只有显式 allowlist 时才成功。

## 直接来源索引

- [RFC 3986：URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986.html)
- [RFC 6265：HTTP State Management Mechanism](https://www.rfc-editor.org/rfc/rfc6265.html)
- [RFC 6749：OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html)
- [RFC 9110：HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [WHATWG Fetch](https://fetch.spec.whatwg.org/)
- [WHATWG HTML：Server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/)
- [W3C Secure Contexts](https://www.w3.org/TR/secure-contexts/)
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [MDN Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin)
- [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN EventSource()](https://developer.mozilla.org/en-US/docs/Web/API/EventSource/EventSource)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP C8：Leverage Browser Security Features](https://top10proactive.owasp.org/the-top-10/c8-leverage-browser-security-features/)
- [OWASP Host Header Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/17-Testing_for_Host_Header_Injection)
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)
- [Hono Cookie Helper](https://hono.dev/docs/helpers/cookie)
- [Hono Streaming Helper](https://hono.dev/docs/helpers/streaming)
