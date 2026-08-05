# Session 切换由路由驱动

决定让 vue-router 真正驱动 session 切换：`/sessions/:sessionId` 成为 session 视图的唯一路径，URL 可刷新恢复、可分享。理由：Session 是跨 Gateway 生命周期可恢复的聚合（CONTEXT.md），URL 是其天然恢复锚点。实现时发现并修复了刷新恢复被破坏的 bug（workspace 首次加载误清 session 选择）。

## Status

superseded by ADR-0005

## Consequences

- `HomePage.vue` 死代码需处理（删除或改造为空态视图，另行决策）。
- `/` 根路径的行为（重定向或空态）另行决策。
