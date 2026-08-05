# Session 路由显式包含 Workspace

将 Session 的规范路由定为 `/workspaces/:workspaceId/sessions/:sessionId`，并移除无法可靠恢复跨 Workspace Session 的 `/sessions/:sessionId`。URL 必须同时标识 Workspace 与 Session，才能在刷新和分享后直接恢复正确的 Active Workspace；目标资源不存在或不可访问时回到 `/` 欢迎页，不自动选择其他 Session。本决策取代 ADR-0002 中的旧路径形式，同时保留由路由驱动 Session 切换的原则。

## Status

accepted
