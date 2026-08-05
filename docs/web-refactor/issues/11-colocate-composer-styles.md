# 11 — Composer 特性样式迁回组件

**What to build:** 将 Composer、RunControlBar、PromptEditor、AttachmentMenu 和模型选择相关样式迁回各自 SFC；保持视觉和动效不变，使全局样式不再依赖这些组件的内部结构。

**Blocked by:** 06（Composer 收敛为编排壳）

**Status:** ready-for-agent

- [x] 各 Composer 子组件的特性样式与组件共置并使用 scoped
- [x] 全局样式删除对应内部类选择器
- [x] 公共设计 token 和真正跨组件的基线样式继续保留在全局
- [x] 深色模式、减少动效和响应式行为保持不变
- [x] typecheck 通过，vitest 全绿，浏览器验收无视觉回归
