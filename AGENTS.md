# AGENTS.md

pig 是 Pi-first Web GUI（local-first）。pnpm monorepo：`apps/web`（Vue 3 + TS）+ `packages/gateway`（Node thin host）。

## 架构红线

- Pi 拥有 Agent Truth：禁止实现第二套 Agent Loop / Session / Transcript / Prompt / Steer / Abort / Model / Tools。
- 跨进程用官方 `@earendil-works/pi-*` 协议：禁止自建 PiClient、wire protocol、事件 envelope、reconnect state machine。
- pig 只拥有 UI Truth：路由、draft、滚动、theme、Snapshot/Transcript 展示投影。
- 新增 Agent 能力优先用 Pi Extension / Skill / Package。

完整契约见 `docs/refactor.md`；UI 契约见 `docs/ui-guidelines.md`。

## 代码

- Vue SFC 顶层区块顺序：template → script → style。
- 平台无关 UI 不直接依赖 `fetch`、`WebSocket`、`sessionStorage`、`location`、Node API 或 Pi Host internals。
- UI 遵循 `DESIGN.md`。

## 验收

- 浏览器验收默认交接给用户，不擅自启动服务。
- 改动后跑 `pnpm check`。
