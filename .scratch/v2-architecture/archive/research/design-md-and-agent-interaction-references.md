# DESIGN.md 与 Agent 交互参考核验

## Google Labs DESIGN.md

Google Labs 的 [`DESIGN.md` 草案规范](https://github.com/google-labs-code/design.md)把设计系统表示为两层：

1. YAML front matter：规范性的机器可读 tokens，包括 colors、typography、spacing、rounded 与 component mappings；token reference 使用 `{path.to.token}`。
2. Markdown body：解释设计意图，标准章节依次为 Overview、Colors、Typography、Layout、Elevation & Depth、Shapes、Components、Do's and Don'ts。

官方规范仍处于 alpha。项目采用该结构时应固定实际使用的 spec/CLI 版本，并把 lint（broken references、section order、contrast 等）纳入验收，不能浮动依赖 `latest`。

来源：

- [Google Labs DESIGN.md repository](https://github.com/google-labs-code/design.md)
- [Google Labs format specification](https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md)

## Notion design source

[`getdesign.md` 的 Notion 分析](https://getdesign.md/notion/design-md)将其概括为适合 workspace/productivity 工具的 warm minimalism、serif headings 与 soft surfaces。可观察预览强调安静 chrome、暖中性色、清晰 ink hierarchy、hairline、克制的单一主操作色，以及 4/8/12px 的紧凑矩形层级。

该资产主要分析公开可见的 Notion 品牌/营销表面，不是本项目的产品规范，也没有完整覆盖本项目的 Dark、流式 Agent、工具状态、键盘和恢复状态。项目必须把它改写为自己的 DESIGN.md，不能原样复制 marketing hero、贴纸、多彩卡片、超大 display type 或大面积留白。

## AIcss interaction source

[`AIcss`](https://www.aicss.dev/#components)展示的 Agent 会话模式包括：

- Thinking 与展开后的 reasoning；
- web search、file diff、image generation 等 tool/action state；
- text response、streaming text、inline citation、code block；
- task list、data/comparison table；
- AI Agent Input。

适合本项目借鉴的是 Codex-like transcript grammar：按时间内联活动、紧凑且可展开的 reasoning/tool rows、append-in-place streaming、可复制 code、底部 Agent input，以及状态而非聊天气泡主导的层级。

组件详情页实际提供 React、Vue、Svelte 三种 copy-paste 实现；用户截图已确认 `FileDiff.vue` 等 Vue 源码可直接查看和复制。因此 AIcss 不只是视觉参考，也可作为项目自有 Vue 组件的实现起点。它不是产品 contract 或运行时组件库：复制后仍必须改接 Pi/Gateway types、无障碍行为和 Notion-derived `DESIGN.md` tokens。

本次核验仍未在公开页面找到明确的源码仓库或许可证链接；在许可证确认前不把代码提交进项目。Image generation、citation、comparison table、专用 file diff 等未被当前 v1 contract 支持的模式不会仅因存在 Vue 示例而进入范围。
