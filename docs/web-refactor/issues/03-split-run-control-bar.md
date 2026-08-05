# 03 — 拆分 RunControlBar

**What to build:** 将 Composer 顶部的 Run 状态徽标、队列提示、Steer 与取消操作抽为独立组件，通过显式类型化的 props/emits 保持单向数据流，现有运行和禁用行为不变。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] RunControlBar 只负责 Run 状态展示和操作入口
- [x] props/emits 契约显式且类型化
- [x] running、queued、cancelling 状态的提示和按钮禁用逻辑保持不变
- [x] Steer 与取消 Run 行为无回归
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
