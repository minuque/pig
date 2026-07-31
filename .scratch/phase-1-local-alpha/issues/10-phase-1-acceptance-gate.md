# 10 — Phase 1 验收门禁

**What to build:** 为 Phase 1 的 Acceptance Scenarios、Required Invariants 和 Exit Criteria 建立可重复的集成验证与证据，证明核心工作台达到本地日常可用。

**Blocked by:** 01 — 持久化多 Workspace Access；02 — 可管理的 Session 列表；03 — Pi Runtime Execution Profile；04 — 按 Session 调度 Run；05 — 取消 Queued 与 Active Run；06 — Steer 当前 Running Run；07 — 隔离 Session 客户端状态；08 — 落地日常可用工作台；09 — Windows Packed Artifact Smoke Test

**Status:** ready-for-agent

- [ ] 建立 Phase 1 八个 Acceptance Scenarios 的追踪矩阵，并关联自动化测试或可重复验证步骤。
- [ ] 证明多个 Workspace Access 之间不存在资源泄漏，取消授权后新请求无法继续访问。
- [ ] 证明 Session 分页、重命名和删除结果跨 Gateway 重启保持一致。
- [ ] 证明同 Session FIFO、跨 Session 有界并行、queued/active 取消及 Steer 目标约束具有确定性。
- [ ] 证明 Execution Profile 在 admission 后冻结，Session 切换不会混淆草稿、实时内容或 Run 状态。
- [ ] 检查 SQLite 不包含 Pi 会话记录副本、实时增量、完整 prompt 或工具 payload。
- [ ] 在 Windows 上重复执行 packed artifact 安装与启动 smoke test。
- [ ] 统一测试、类型检查、lint、格式检查和构建全部通过，并记录环境与实际结果。
- [ ] Phase 2、Phase 3 的 Deferred 能力未被作为本阶段契约引入。
