# Phase 3：Release Hardening

Status: proposed

## Goal

把 Public Beta 能力打包为可安装、可验证、可支持的公开发布物。

## Dependencies

- Phase 2 Exit Criteria 全部满足。

## In Scope

- 通过 npm packed artifact 启动 Gateway 和构建后的 SPA。
- 明确并验证受支持的 Node 版本。
- Windows 和 Linux 安装、启动及升级测试。
- 区分进程存活与服务就绪的 health/readiness。
- 核心旅程支持键盘操作、可见焦点和合理语义名称。
- 窄屏、浅色、深色和系统主题。
- 流式内容滚动行为和主动跳转到最新内容。
- 发布限制、升级规则、安全模型和故障处理文档。
- 发布候选的稳定性与回归测试矩阵。

## UI Scope

本阶段完成发布级视觉、响应式和可访问性加固：

- 统一所有页面、控件、状态、空页面和错误页面的视觉细节。
- 完成浅色、深色和系统主题，并验证对比度。
- 验证完整键盘旅程、焦点顺序、弹层焦点管理和语义名称。
- 控制实时内容的辅助技术播报频率，避免逐 token 播报。
- 验证窄屏、长会话记录、长代码和极端状态文本。
- 补齐首次使用引导和必要的发布限制说明。
- 建立关键界面的 UI 回归检查，但不要求 pixel-perfect 全量门禁。

## Required Invariants

- 继承此前阶段全部 Required Invariants。
- bootstrap 凭证短生命周期、单次使用，且不进入请求日志或浏览器历史。
- 普通更新不改变固定的 Pi 版本。
- 不承诺 macOS、远程 Gateway、多用户或操作系统 sandbox。

## Acceptance Scenarios

1. 同一 packed artifact 可在支持的 Windows、Linux 和 Node 版本上安装并启动。
2. 启动后只监听随机 loopback，bootstrap 凭证不会泄漏到日志或历史。
3. Workspace、Session 和 Run 核心旅程可仅通过键盘完成。
4. 核心界面在窄屏、浅色和深色主题下可用。
5. 用户阅读历史时不会被流式输出强制滚动，并可主动跳转到最新内容。
6. 从上一受支持版本升级后，Workspace 和 Session 仍可访问。
7. readiness 只在 Gateway 可以安全接受请求时成功。

## Exit Criteria

- 发布矩阵全部通过。
- 安装、启动、升级和失败恢复步骤可由发布文档复现。
- `../spec.md` 中的 v2 Release Scenarios 已全部满足，或明确记录为后续范围。
