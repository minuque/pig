# 03 — Canonical Workspace 与 Workspace Access

**阶段：** Phase 0  
**父级场景：** AS-3（Workspace 部分）  
**前置阻塞：** 00、01  
**状态：** 未满足

## 交付范围

为 Local Identity 提供 canonical Workspace 路径预览、明确确认和 Workspace Access；单 Workspace 限制由策略执行。

## 验收标准

- [ ] Workspace 注册分为 preview 与 confirm；确认前不形成授权，确认结果使用平台 Port 返回的 canonical 路径和稳定 `workspaceId`。
- [ ] Workspace Access 关联 Local Identity 与 Workspace；未授权或不匹配的 Workspace 资源请求被拒绝。
- [ ] Workspace 创建 mutation 携带客户端生成的 `commandId`；等价重试返回原结果，不同 payload 复用被拒绝。
- [ ] 最多一个 Workspace 由策略限制，而不是全局单例资源模型或 Repository 契约。
- [ ] 产品和 API 文案不把 Workspace Access 描述为操作系统 sandbox。

## 不在本票

多 Workspace 管理、撤销授权、文件系统 sandbox、Session 资源和 Workspace 授权 UI。

## 当前实现证据

- 仅有内存 `workspaceMap` 和未版本化 `/workspaces` 列表存根。
- 当前通用 `/workspaces` 分支先于 POST 分支，导致创建分支不可达。
- 缺失 canonical 路径 preview/confirm、Local Identity 关联、访问门控、`commandId` 和单 Workspace 策略；无验收项可勾选。
