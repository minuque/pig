# 09 — 瘦身 App 工作台壳

**What to build:** 将左栏拖拽、键盘调宽、移动端抽屉和欢迎页首次提交编排移入职责明确的组合式函数，使入口组件只保留应用功能组合和布局结构。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] 拖拽调宽、方向键调宽和窗口变化适配保持不变
- [x] 移动端打开、关闭导航抽屉的行为保持不变
- [x] 欢迎页仍按“创建 Session → 发送首条 Run → 清空输入”执行
- [x] 入口组件不再直接维护上述流程的实现细节
- [x] 新组合式函数职责聚焦，不声明未发生的复用需求
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
