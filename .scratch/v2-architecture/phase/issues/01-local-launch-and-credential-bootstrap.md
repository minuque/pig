# 01 — 本地启动与 Credential Bootstrap

**阶段：** Phase 0  
**父级场景：** AS-1、AS-2  
**前置阻塞：** 00  
**状态：** 部分满足

## 交付范围

在 Windows 本地开发环境启动 Gateway 与 SPA；Gateway 仅绑定随机 `127.0.0.1` 端口；通过短生命周期、单次使用的浏览器 bootstrap credential 建立固定 Local Identity。

## 验收标准

- [x] Gateway 使用端口 `0` 绑定 `127.0.0.1`，并返回实际随机端口；代码中不存在非 loopback 监听路径。
- [x] 一条有记录的开发命令可以在 Windows 启动 Gateway 和 SPA。
- [x] Bootstrap secret 生命周期有限、进程内单次使用，建立成功后映射到当前 Gateway 进程内稳定的 Local Identity。
- [x] Credential 传输适配与 Local Identity/授权逻辑分离，核心授权不依赖 Cookie 等单一传输机制。
- [x] 除 bootstrap 所需入口外，无有效 credential 的 `/api/v1` 请求被拒绝；有效 credential 可以进入后续 Workspace Access 检查。
- [x] Credential、bootstrap secret、Cookie、完整 URL secret 不进入应用日志或浏览器历史。

## 不在本票

Workspace 授权、Session/Run API、远程访问、任意 host 绑定、跨 Gateway 重启 credential。

## 当前实现证据

- 已满足：`packages/gateway/src/index.ts` 的 `Gateway.start()` 调用 `listen(0, "127.0.0.1")`。
- 已有但不足：存在 `/credential` 内存映射，但它接受任意可重复 credential，生成的 identity 不稳定，也没有限时、单次 bootstrap 或 transport adapter。
- 缺失：Gateway/SPA 启动入口、API 鉴权、Workspace Access 衔接及敏感 credential 日志/历史验证。当前 `/sessions`、`/workspaces`、`/sse` 均可匿名访问。
