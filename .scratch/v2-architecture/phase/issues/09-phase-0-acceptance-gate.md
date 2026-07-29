# 09 — Phase 0 安全审计与验收门禁

**阶段：** Phase 0  
**父级场景：** AS-1 至 AS-10、全部 Exit Criteria  
**前置阻塞：** 01–08  
**状态：** 未满足

## 交付范围

本票只负责集成验证和证据归档，不重新实现前序能力。逐项证明 Phase 0 的 10 个 Acceptance Scenarios、Foundation Constraints、Required Invariants 和 Exit Criteria。

## 验收标准

- [ ] 建立 AS-1 至 AS-10 的追踪矩阵；每项关联自动化测试，或记录可重复命令、环境、期望结果和实际结果。
- [ ] 敏感 canary 验证日志不含 credential、完整 prompt、Transcript 和工具 payload；Gateway 仅监听随机 loopback。
- [ ] 架构检查证明包依赖、Pi Adapter、Repository、Session Index、平台路径、授权和策略边界符合 Phase 0 Foundation Constraints。
- [ ] 端到端验证覆盖 `Workspace → Session → Prompt → Streaming → terminal Transcript reload`、Cancel 后新 Run、并发拒绝、进程内 mutation 幂等和 Gateway 重启发现。
- [ ] 安全渲染测试证明模型 HTML 不会作为受信任 HTML 执行，并覆盖危险链接/事件属性。
- [ ] 验收证据证明未依赖 Phase 1+ 能力；Deferred 项未被作为 Phase 0 契约引入。

## 场景追踪

| 场景 | 主要责任票 | 证据 |
| --- | --- | --- |
| AS-1 | 01 | 待补 |
| AS-2 | 01 | 待补 |
| AS-3 | 03、04、07 | 待补 |
| AS-4 | 04、06、08 | 待补 |
| AS-5 | 06、08 | 待补 |
| AS-6 | 05、08 | 待补 |
| AS-7 | 02、04 | 待补 |
| AS-8 | 00、03–06 | 待补 |
| AS-9 | 00、06、08 | 待补 |
| AS-10 | 08 | 待补 |

## 当前实现证据

- 当前仓库没有测试脚本、测试文件、Vitest 配置或可重复验收记录，AS-1 至 AS-10 均未完整通过。
- 当前 `pnpm typecheck` 失败于 Web 包的 Vue/vue-router 依赖和 Vue 类型配置，尚不具备阶段门禁基础。
- 已确认的局部实现只有 package 边界、随机 loopback 绑定和 Adapter 调用边界，不能替代端到端场景证据。
- `PiRuntimeAdapterImpl.createRun()` 会记录 prompt 片段，违反敏感日志不变量。
