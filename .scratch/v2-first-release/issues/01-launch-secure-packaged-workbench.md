# 01 — 启动安全的打包工作台

**What to build:** 用户可通过 npm CLI 在受支持的 Node 版本上启动打包后的本地工作台。进程独占 Application Data Root、绑定随机 loopback 端口，并通过一次性 fragment bootstrap 建立当前进程有效的浏览器 credential；不可信网页或请求不能越过 Gateway access seam。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] 从打包后的 npm artifact 启动 CLI，可禁止自动打开浏览器并可选择独立 Application Data Root。
- [ ] CLI 拒绝低于 22.19.0 的 Node，且只绑定 `127.0.0.1` 的随机端口。
- [ ] bootstrap secret 只出现在 URL fragment，具有两分钟有效期、单次使用语义，且交换后发放进程级 HttpOnly、SameSite=Strict credential 与 session-bound CSRF token。
- [ ] authority、Origin、Fetch Metadata、Cookie 和 CSRF 校验按契约拒绝非法请求；产品不启用 CORS 或接受 preflight。
- [ ] 浏览器可在认证成功后加载打包 SPA 的基础 Workbench Shell。
