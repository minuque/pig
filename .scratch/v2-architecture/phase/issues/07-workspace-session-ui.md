# 07 — Workspace 与 Session UI 骨架

**阶段：** Phase 0  
**父级场景：** AS-3、UI Scope  
**前置阻塞：** 00、03、04  
**状态：** 未满足

## 交付范围

建立可延续的信息架构：Workspace 授权、Session 导航、创建入口和当前 Session 页面，并提供基础反馈、响应式布局、设计变量和无障碍基线。

## 验收标准

- [ ] 用户可完成 Workspace 路径预览、明确确认和授权；重复提交被即时反馈和阻止。
- [ ] UI 提供 Session 列表、创建入口和当前 Session 页面，状态以稳定 `workspaceId`/`sessionId` 为键，不持有 Pi 对象。
- [ ] Workspace 与 Session 流程具有可观察的 Loading、Empty 和 Error 状态，错误包含可操作提示和稳定关联信息。
- [ ] 代表性宽屏下导航与内容同时可见；代表性窄屏下当前 Session 上下文与核心操作仍可访问，代码/内容不撑破页面。
- [ ] 建立基础颜色、间距、正文/等宽字体和可见焦点变量；状态不只依赖颜色，核心操作具有可访问名称并可用键盘到达。

## 不在本票

完整组件库、视觉精修、多 Workspace、Session rename/delete/search/pagination、Prompt/Transcript/Run 实时 UI。

## 当前实现证据

- `packages/web/src/App.vue` 已有 Workspace/Session/Transcript/Prompt 的静态三区域骨架，并引用部分设计变量。
- 所有 Workspace/Session 数据和按钮均为硬编码或未绑定；缺失授权流程、Session 路由、API 状态、Loading/Empty/Error、窄屏布局和可验证键盘旅程。
- 当前 `pnpm typecheck` 在 Web 包失败：Vue/vue-router 依赖与 Vue 类型配置尚未建立。
- 静态骨架不足以完整满足任一验收项，因此暂不勾选。
