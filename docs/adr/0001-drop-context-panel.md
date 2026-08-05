# 裁切右栏 ContextPanel

决定在 UI 打磨轮裁切右栏 ContextPanel（RUN / SESSION / GATEWAY 状态面板），使中间 chat 区域获得完整宽度。理由：工作台以 workspace + session + chat 为优先落地路径，右栏信息密度低，其承载的重命名/删除与 Gateway 状态在打磨后另有归属。ui-guidelines.md 的"三个主要区域"描述因此过时，需同步更新。

## Status

accepted（重命名/删除与 Gateway 状态的迁移归属待定，见 `docs/adr/0002-*.md` 后续决策）

## Consequences

- App.vue 的右栏 resizer、右侧抽屉与 `fitPanels` 逻辑一并移除。
- 若后续需要状态总览，可作独立视图或对话框回归，而非常驻第三栏。
