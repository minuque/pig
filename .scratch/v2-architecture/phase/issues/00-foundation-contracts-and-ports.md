# 00 — Foundation Contracts 与 Ports

**阶段：** Phase 0
**父级场景：** Exit Criteria 2–3
**前置阻塞：** 无
**状态：** 满足

## 交付范围

固定后续票据必须复用的边界：browser-safe contracts、稳定标识、版本化 API 与 SSE 信封、Repository/平台 Ports、进程内 mutation 幂等执行器，以及单 Workspace/单 active Run 策略接口。

## 验收标准

- [X]  `web`、`gateway`、`contracts`、`testkit` 保持独立；生产代码不依赖 `testkit`，`contracts` 不依赖 Vue、DOM、Node 或 Pi SDK。
- [X]  Workspace、Session、Run、Local Identity、Command 使用稳定且不可互换的标识；公共 API 位于 `/api/v1`。
- [ ]  REST 资源、mutation、错误和统一 SSE 事件信封具有共享 schema；Run 事件至少携带 `sessionId`、`runId` 和 `type`。
- [ ]  业务逻辑依赖 Workspace Repository、Run Repository、Session Index 和平台路径 Port；Windows 路径规则不散落在业务逻辑中。
- [ ]  进程内 Command Executor 对每个 mutation 支持：等价 `commandId` 重试返回原结果，不同 payload 复用返回稳定冲突。
- [ ]  单 Workspace 与全局单 active Run 由可替换策略表达，不进入资源模型或 Repository 契约。

## 不在本票

具体 Workspace、Session、Run、SSE 和 UI 行为；跨进程重启的 durable 幂等、revision、SQLite ledger。

## 当前实现证据

- 已满足：四个 workspace package 已建立；`web`/`gateway` 只依赖 `contracts`，`contracts` 无运行时依赖，`testkit` 未被生产包依赖。证据：各 package 的 `package.json`、`packages/contracts/src/index.ts`。
- 已有但不足：contracts 定义了 Workspace、Session、Run、LocalIdentity、CommandId 和 Pi Adapter 接口，但 ID 仍是普通 `string`，路由未版本化，没有共享 schema/事件信封。
- 缺失：Repository、Session Index、平台路径 Port、Command Executor 和策略接口。
- 已实现：稳定标识（branded types）、版本化 (CONTRACT_VERSION)、SSE 事件信封、Repository 接口、Platform Port、Command Executor、策略接口。
