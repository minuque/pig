# 05 — 拆分 AttachmentMenu

**What to build:** 将附件“+”菜单和附件 chip 列表抽为独立组件，继续保留图片/文件选择、移除动画和当前附件名标记拼接行为，并复用统一后的 reka-ui 菜单基座。

**Blocked by:** 02（Composer 弹出菜单统一到 reka-ui）、04（拆分 PromptEditor）

**Status:** ready-for-agent

- [x] 附件菜单和 chip 列表形成职责单一的组件
- [x] props/emits 契约显式且类型化
- [x] 图片/文件选择、移除和现有文本拼接格式保持不变
- [x] 组件卸载后无残留监听或定时器
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
