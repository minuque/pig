# 输入框对齐 input_ref.vue 原型（视觉 + 交互结构 + 功能），Skill 暂不接入

`prototype/input_ref.vue` 作为 ComposerBar 与 SessionWelcome 两个输入框的视觉与交互参考：对齐其卡片 frame 视觉语言（hairline、圆角、icon-btn、暗色、动效）、`+` 菜单与右下操作行的交互结构，并引入 Enhance prompt 与 Attachment chip 功能；Skill Pill（含 `/` 菜单）暂不接入。

## Status

accepted

## Context

- 当前两个输入框（ComposerBar、SessionWelcome）为 textarea + select + 普通按钮的形态，与原型差距大。
- 原型的 enhance / attachment / model picker 在代码库中无任何后端概念（grep 无匹配），均为 mock。
- Execution Profile（模型 + thinking level，admission 冻结）是既有术语，Model Picker 与之的关系见后续 ADR。
- ADR-0003：保持手写 CSS + token 体系，参考组件按需摘抄。

## Decision

- 对象范围：ComposerBar 与 SessionWelcome 都改，视觉语言统一。
- 对齐层次：视觉 + 交互结构 + 功能（enhance、attachment、model picker）。
- 编辑器：textarea 换成 contentEditable（为未来技能标签铺路，即使当前不接入 skill）。
- Skill Pill 与 `/` 命令菜单暂不实现，`+` 菜单不包含 Skills 项。

## Consequences

- 输入框区域脱离纯 token 默认样式，引入原型中的局部视觉语言（frame、动效、暗色覆盖）。
- enhance、attachment 的端到端实现需要新增后端能力或先以 mock/文本拼接落地（见后续 ADR）。
- 未来接入 Skill 时无需再改编辑器形态，只需在 contentEditable 内实现 pill 插入与 `/` 菜单。
