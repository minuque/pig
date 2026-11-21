# 助手正文的间距与对齐

- 状态：已采纳
- 代码：`apps/web/src/style/markdown.css`（`.prose`）、`apps/web/src/features/transcript-view/components/markdown/MarkdownContent.vue`

## 背景

助手正文由 `@comark/vue` 渲染，每个 Markdown 根块各包一层 `.comark-content`（在 `MarkdownContent.vue` 里设成 `display: contents`）。块间距与列表缩进只能按这个结构算。

## 决定

- 块间距只有一个来源：`.comark-content + .comark-content > *` 的 `margin-top: 10px`。标题前后另调（上 20、后 6），因为标题领起下文，不该等距浮在两段中间。
- 列表的 `padding-inline-start: 20px` 同时是任务项复选框的基准：`li.task-list-item > input` 用 `margin-inline: -20px 0.25em` 挂进圆点位，13px 复选框加右距再加源文里的一个空格，正好占满 20px。改缩进、复选框尺寸或右距要一起重算，否则任务项与普通项文字左缘错开。
- 行内码左右补 `0.2em`：中文正文里反引号两侧通常不留空格，不留外边距就和前后文字贴住。折行靠 `box-decoration-break: clone` 让每段各带圆角。

## 后果

改 `.prose` 的字号或列表缩进时，20px 是任务列表的硬基准，负外边距与右距要跟着改。
