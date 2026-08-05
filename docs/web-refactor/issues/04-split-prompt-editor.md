# 04 — 拆分 PromptEditor

**What to build:** 将 contenteditable 编辑区、Prompt Enhance 三态、Revert、光标管理、外部草稿同步和相关动画抽为独立组件；保留现有 Enhance 接入扩展点及全部编辑行为。

**Blocked by:** 02（Composer 弹出菜单统一到 reka-ui）、03（拆分 RunControlBar）

**Status:** ready-for-agent

- [x] 编辑区与外部 prompt 保持明确的双向绑定契约
- [x] 外部草稿恢复后编辑器内容正确同步
- [x] Enhance 保持 enhancing、enhanced、revert 和失败回退原文行为
- [x] 裸 Enter 发送、Shift+Enter 换行、IME 组合期间放行
- [x] 组件卸载后无残留定时器、AbortController 或事件监听
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
