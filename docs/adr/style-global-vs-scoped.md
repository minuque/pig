# 全局分片与 SFC scoped 的分工

- 状态：已采纳
- 代码：`apps/web/src/style/components.css`（`[data-menu-*]`、`.glass-panel`）、`apps/web/src/style/motion.css`（`.reveal-menu`、`[data-slot="dialog-content"]`）

## 背景

组件样式默认写在 SFC 的 scoped 样式里。挂到 `body` 的弹层（reka-ui 的 dialog、dropdown、context menu、tooltip，加上命令面板与警告框）经 Teleport 渲染在组件 DOM 之外，scoped 选择器带的 data 属性打不中，写在那里不生效。

## 决定

- 弹层的外观与转场由全局分片承担，选择器认 reka 的 `data-slot` / `data-state` / `data-side` 和项目自己的 `data-menu-*` 标记，不认组件的 scoped 类名。
- 要被调用方覆盖的基础件样式（Lucide 图标基座）用零特异性 `:where()`，调用方的 `size-*` 工具类与 SFC scoped 样式都能改写它。
- 动效类与减动效覆盖集中在 `motion.css`。它超过 500 行的行数上限是刻意的：拆开会让同一段动画的加载与 `prefers-reduced-motion` 兜底分居两处。

## 后果

弹层样式改在 `components.css` / `motion.css`，不要搬回 SFC。新增弹层复用 `data-menu-*` 与 `reveal-*` 一套标记，不另写 scoped 样式。
