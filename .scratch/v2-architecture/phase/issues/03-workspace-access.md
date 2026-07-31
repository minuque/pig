# 03 — Canonical Workspace 与 Workspace Access

**阶段：** Phase 0  
**父级场景：** AS-3（Workspace 部分）  
**前置阻塞：** 00、01  
**状态：** 满足

## 交付范围

为 Local Identity 提供 canonical Workspace 路径预览、明确确认和 Workspace Access；单 Workspace 限制由策略执行。

## 验收标准

- [x] Workspace 注册分为本机目录选择、preview 与 confirm；选择器取消无错误且可重试，确认前不形成授权，确认结果使用平台 Port 返回的 canonical 路径和稳定 `workspaceId`。
- [x] Workspace Access 关联 Local Identity 与 Workspace；未授权或不匹配的 Workspace 资源请求被拒绝。
- [x] Workspace 创建 mutation 携带客户端生成的 `commandId`；等价重试返回原结果，不同 payload 复用被拒绝。
- [x] 最多一个 Workspace 由策略限制，而不是全局单例资源模型或 Repository 契约。
- [x] 产品和 API 文案不把 Workspace Access 描述为操作系统 sandbox。

## 不在本票

多 Workspace 管理、撤销授权、文件系统 sandbox、Session 资源和 Workspace 授权 UI。

## 当前实现证据

- `packages/gateway/src/server/Gateway.ts` 提供 Bearer 鉴权后的 `POST /api/v1/workspaces/select-directory`、`/preview` 与 `/confirm`；`NodePlatformPort` 通过 PATH 中的 `pwsh` 打开 Windows 原生文件夹选择器并安全解析 JSON 输出，取消返回 `path: null`，不视为错误。
- 目录选择由本机 Gateway 触发，不使用也不声称使用浏览器 File System Access API；选择成功后仍通过 `PlatformPort.canonicalizeWorkspacePath` 执行 canonical preview，preview 不写入 Workspace 或授权。
- confirm 创建稳定随机 `workspaceId`，并在 `workspaceAccess` 中显式绑定 `LocalIdentityId` 与 `WorkspaceId`；Workspace 列表仅返回当前 Identity 可访问项，按 ID 读取对未认证请求返回 401、无匹配 Access 返回 403。
- `packages/contracts/src/index.ts` 的 `InMemoryCommandExecutor` 缓存等价 `commandId` 的原 Promise，并以 `CommandConflictError` 拒绝不同 payload 复用；Gateway 将其稳定映射为 409 `COMMAND_ID_CONFLICT`。
- 最多一个 canonical Workspace 由 `SingleWorkspaceStrategy` 执行；第二个不同 canonical 路径返回 409 `SINGLE_WORKSPACE_LIMIT`，资源模型和 Repository 契约未加入单例约束。
- API 仅使用 Workspace Access 授权术语，没有将其表述为操作系统 sandbox；未实现文件系统 sandbox。
- `packages/gateway/test/workspace-access.test.ts` 覆盖目录选择 endpoint 的 Bearer 鉴权、取消与重试成功，以及 preview 不授权、canonical confirm、稳定 ID 等价重试、payload 冲突、资源门控及单 Workspace 策略。
