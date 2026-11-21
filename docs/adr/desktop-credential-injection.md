# 桌面壳的网关凭证注入范围

- 状态：已采纳
- 代码：`apps/desktop/src/main/urls.ts`（`gatewayTrustUrls`、`isLoopbackHttpOrigin`、`parseGatewayOriginArg`）、`apps/desktop/src/main/index.ts`（`trustLoopback`）

## 背景

渲染进程经 `pig://app` 访问本机 gateway 的 HTTP 接口，请求要带上 gateway 启动时生成的 launch token。桌面壳同时会打开外部链接、加载打包后的静态文件，所以凭证注入的匹配式不能覆盖整机流量。

## 决定

- `onBeforeSendHeaders` 只匹配 `http://127.0.0.1:<gateway 端口>/*` 与 `ws://127.0.0.1:<gateway 端口>/*`，端口取 gateway 实际监听的端口。
- 注入的网关地址（`--pig-gateway-origin`）只接受 `http:` + `127.0.0.1` + 空路径、空查询、无凭据的形式，其余丢弃。

## 后果

同机其它端口的服务收不到 `Authorization`，`pig://` 之外的主机地址也不会被当成网关。代价是改端口、换主机名（如 `localhost` 或 IPv6 回环）或允许非回环地址都会让注入失配或把 token 漏给别的服务，这三处要一起改。
