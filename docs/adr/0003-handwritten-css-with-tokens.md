# 样式体系保持手写 CSS + token，shadcn 按需摘抄

决定本轮不全面迁移 shadcn-vue，保持现有手写组件类 + DESIGN.md token 体系（app.css，Tailwind v4 `@theme` 已映射），shadcn-vue 组件按需摘抄（如 badge）。理由：现有 token 与组件类已覆盖全部组件，全面迁移是重写而非打磨；文档选型中的 shadcn-vue 定位为"组件生态参考"，而非强制依赖。

## Status

accepted

## Consequences

- 新组件优先使用 token + Tailwind utility；仅复杂交互组件（Dialog、Select 等）参考 shadcn-vue 实现。
- 防止未来将"迁移到 shadcn-vue"误当作欠债修复。
