# v2 实施阶段

本目录把 [`../spec.md`](../spec.md) 中的目标架构拆成可独立验收的增量阶段。`spec.md` 仍是最终架构、安全边界和发布范围的规范来源；本目录只规定能力的落地顺序。

跨阶段 UI 原则见 [`ui-guidelines.md`](ui-guidelines.md)；各阶段只在自己的 `UI Scope` 中规定当期实现深度。

Current phase: Phase 0（planning）

## 阶段

| 阶段 | 目标 | 文档 |
| --- | --- | --- |
| Phase 0 | 打通最小端到端闭环 | [phase-0-mvp.md](phase-0-mvp.md) |
| Phase 1 | 达到本地日常可用 | [phase-1-local-alpha.md](phase-1-local-alpha.md) |
| Phase 2 | 补齐恢复、一致性和异常处理 | [phase-2-public-beta.md](phase-2-public-beta.md) |
| Phase 3 | 完成公开发布加固 | [phase-3-release.md](phase-3-release.md) |

## 执行规则

- 按顺序实施；后续阶段默认继承前序阶段能力。
- 每个阶段只实现其 `In Scope` 和 `UI Scope`，不得提前引入 `Deferred` 能力。
- 阶段拆分不改变 `spec.md` 中的数据所有权、组件边界和安全底线。
- Phase 0 可以限制能力数量，但必须固定稳定标识、Run 生命周期、契约信封、Pi Adapter、Repository 和授权边界。
- UI 遵循 `ui-guidelines.md`：Phase 0 定骨架，Phase 1 打磨核心体验，Phase 2 处理异常与恢复，Phase 3 完成发布加固。
- Issue 应关联一个阶段及其验收场景，避免直接按完整目标架构展开。
- 一个阶段的 Exit Criteria 全部满足后，才进入下一阶段。
