# 07 — Workspace 与 Session UI 骨架

**阶段：** Phase 0  
**父级场景：** AS-3、UI Scope  
**前置阻塞：** 00、03、04  
**状态：** 满足

## 交付范围

建立可延续的信息架构：Workspace 授权、Session 导航、创建入口和当前 Session 页面，并提供基础反馈、响应式布局、设计变量和无障碍基线。

## 验收标准

- [x] 用户可完成 Workspace 路径预览、明确确认和授权；重复提交被即时反馈和阻止。
- [x] UI 提供 Session 列表、创建入口和当前 Session 页面，状态以稳定 `workspaceId`/`sessionId` 为键，不持有 Pi 对象。
- [x] Workspace 与 Session 流程具有可观察的 Loading、Empty 和 Error 状态，错误包含可操作提示和稳定关联信息。
- [x] 代表性宽屏下导航与内容同时可见；代表性窄屏下当前 Session 上下文与核心操作仍可访问，代码/内容不撑破页面。
- [x] 建立基础颜色、间距、正文/等宽字体和可见焦点变量；状态不只依赖颜色，核心操作具有可访问名称并可用键盘到达。

## 不在本票

完整组件库、视觉精修、多 Workspace、Session rename/delete/search/pagination、Prompt/Transcript/Run 实时 UI。

## 当前实现证据

- `packages/web/src/App.vue` 通过 `/api/v1/workspaces/preview` 与 `/confirm` 实现预览后明确授权；异步期间禁用操作并在处理函数中二次防重入。
- `packages/web/src/App.vue` 通过 `/api/v1/workspaces/:workspaceId/sessions` 加载和创建 Session，并使用 `/sessions/:sessionId` 路由；客户端仅保存 API DTO 和稳定 ID。
- `packages/web/src/api.ts` 复用 fragment bootstrap 约定，立即从历史中移除 secret，并为 API 错误提供错误码、重试提示和客户端 request ID。
- `packages/web/src/App.vue` 覆盖 Workspace/Session 的 Loading、Empty、Error，提供宽屏双栏及 `700px` 以下可开关 Session 导航；长 ID 使用换行避免溢出。
- `packages/web/src/App.vue` 定义基础设计变量、正文/等宽字体、可见 `:focus-visible`，使用原生控件、ARIA 名称和“符号 + 文本”状态。
- `packages/web/src/api.test.ts` 验证错误提示保留错误码、稳定关联 ID 和重试动作；`pnpm --filter @no-pi-no-gang/web test` 通过（1 test），`pnpm typecheck` 通过。
