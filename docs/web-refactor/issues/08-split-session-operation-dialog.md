# 08 — 拆分 Session 操作对话框

**What to build:** 将 Session 重命名、删除及关闭后的焦点恢复从导航组件抽为独立对话框组件；导航只负责列表和打开操作，现有提交、取消、Escape、外点关闭和焦点恢复行为不变。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 重命名和删除对话框从导航组件中移出
- [x] props/emits 契约显式且类型化
- [x] 重命名输入打开后自动聚焦并选中文本
- [x] 关闭后焦点正确返回对应 Session 的菜单按钮
- [x] 不新增仅服务单一调用方的通用焦点抽象
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
