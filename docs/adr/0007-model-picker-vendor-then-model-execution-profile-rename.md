# Model Picker 两级选择（供应商 → 模型），Execution Profile 更名为 Model Preset

输入框的模型选择改为原型式 Model Picker：`+` 菜单内呈现，先按供应商分组选择，再选具体模型；SessionWelcome 控件行内用两级联动 select（必填项保持可见）。**Execution Profile 概念保留并更名为 Model Preset**（模型 + thinking level 组合，admission 冻结语义不变）；thinking level 保留在概念内。模型目录由 gateway 提供。

## Status

accepted

## Context

- Execution Profile 原为 Run admission 时冻结的模型 + thinking level 组合（CONTEXT.md 既有术语）。
- 曾讨论剔除 Execution Profile 与去除 thinking level，均被否决；结论为概念保留、名词更换。
- 前端 profiles 数据当前由 gateway 提供；模型目录改由 gateway 提供（bootstrap 或新端点），前端不硬编码。

## Decision

- **ComposerBar 重写为 ChatInput**：旧实现整条链路（profile select、发送/排队/Steer 逻辑、契约引用等）移除不复用；welcome 与新 ChatInput 共用新建的选择器组件。
- 输入框底部操作行结构：`+` 按钮旁放置两个同风格选择器（模型选择器 + 思考强度选择器），联动；二者均不进 `+` 菜单。
- 模型选择器点击弹出弹框（popover 形态，参考截图）：单栏纵向，顶部搜索框（按模型/供应商名过滤），按供应商分组展示模型条目（名称 + 可选标签 + 选中勾，当前项高亮）；底部不设"管理模型"入口（无后端概念）；保留品牌图标。
- 思考强度选择器为同风格下拉（如截图 "Max" 样式，Low/Medium/High 单选），位于模型按钮右侧。
- **联动语义**：模型切换会影响思考强度选项——某模型不支持当前 level 时置灰或自动修正。
- 模型目录由 gateway 提供（含 picker 展示所需的品牌/描述元数据）。
- contracts/gateway 链路中 ExecutionProfile 类型重命名为 ModelPreset（字段 model + thinkingLevel 不变，run/steer 请求形状不变），thinking level 校验与冻结语义保留。

## Consequences

- 全局重命名：contracts 类型、gateway admission/scheduler、前端使用点，机械替换。
- 前端发送链路载荷形状不变（model + thinkingLevel），仅类型名与 UI 呈现更新。
- 输入框底部行宽度预算：`+` + 两个选择器 + 右侧按钮区，需在实现时验证紧凑布局。
