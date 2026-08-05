# 对齐落地细节：Workspace select、Enhance 交互、附件携带、ComposerBar 状态行

ADR-0006 对齐决策的落地细节四则。

## Status

accepted

## Decision

1. **SessionWelcome 的 Workspace 选择**：保留独立控件行（select 视觉对齐原型控件），不收入 `+` 菜单——必填项需保持可见。
2. **Enhance 交互完整保留**：enhancing 阶段 shimmer 文本 + 旋转渐变边框（替代编辑）+ 右侧 spinner；完成后替换内容 + Revert pill；失败回退原文。接口承载位置见后续 ADR。
3. **附件携带方式（先 UI 后传输）**：Attachment Chip 完整实现（图片/文件图标、移除、进出场动效）；发送时以文本形式拼入 prompt（文件名列表），真正上传挂载后置。
4. **ComposerBar 状态行**：status badge、队列提示、取消 Run、Steer 保留在 frame 上方，frame 内部按原型结构。

## Consequences

- Enhance 的 DOM/状态结构（phase: idle/enhancing/enhanced、preEnhanceHTML、Revert）按原型实现。
- 附件拼接格式为实现细节，由实现者定（如 `[附件: 名1, 名2]`）。
- 状态行与 frame 的视觉衔接（间距、宽度）需在实现时对齐 token。
