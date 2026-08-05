# 12 — Session 与 Workspace 特性样式迁回组件

**What to build:** 将 Session 导航、Transcript、Session 操作对话框和 Workspace 授权界面的特性样式迁回对应 SFC；保持现有布局、状态、响应式和无障碍表现。

**Blocked by:** 07（收敛 Transcript 滚动状态所有权）、08（拆分 Session 操作对话框）

**Status:** ready-for-agent

- [x] Session、Transcript 与 Workspace 特性样式分别与所属组件共置并使用 scoped
- [x] 全局样式删除对应组件内部类选择器
- [x] 导航展开、Transcript 状态、Dialog 和移动端表现保持不变
- [x] 减少动效偏好继续得到正确处理
- [x] typecheck 通过，vitest 全绿，浏览器验收无视觉回归
