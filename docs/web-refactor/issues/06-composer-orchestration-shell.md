# 06 — Composer 收敛为编排壳

**What to build:** Composer 只组合 RunControlBar、PromptEditor、AttachmentMenu、模型选项和发送动作，移除子组件已接管的状态、DOM 操作和样式逻辑，保持发送、排队、Steer、取消、Enhance 与附件行为不变。

**Blocked by:** 03（拆分 RunControlBar）、04（拆分 PromptEditor）、05（拆分 AttachmentMenu）

**Status:** ready-for-agent

- [x] Composer 只保留子组件组合和发送流程编排
- [x] 删除与 defineModel 完全同构的双向 computed 包装
- [x] 子组件状态和逻辑不在 Composer 中重复存在
- [x] 发送、排队、Steer、取消、Enhance 和附件流程保持不变
- [x] typecheck 通过，vitest 全绿，浏览器验收无回归
