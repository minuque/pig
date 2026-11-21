# 样式分片的分层与顺序

- 状态：已采纳
- 代码：`apps/web/src/style/app.css`（`@import` 列表）、`apps/web/src/style/reset.css`（`:focus-visible`）、`apps/web/src/style/components.css`（`.surface-float`）

## 背景

样式按用途拆成分片，由 `app.css` 统一 `@import`。库（reka-ui 等）的默认值也要能被压住，而分片之间的先后、以及是否写进 `@layer`，都会改变谁赢。

## 决定

- `reset.css` 进 `base` 层：它的取值最低，任何组件的声明都该赢它。
- `tokens.css` 排第一：后面的分片都读它的自定义属性。
- `globals.css` 不进层，且排在所有分片之后：库的默认值不在任何层里，只有同样不分层、又排在更后的声明才压得住。
- 默认焦点环写在 `reset.css` 的 `base` 层：组件与库自带的焦点样式优先级更高，不会叠出双框。
- `components.css` 的 `.surface-float` 写在颜色原子类之后：同一元素同时带 `.bg-*` 时，按后出的一条取实色底。

## 后果

调整 `app.css` 的 `@import` 顺序，或给 `globals.css` 加层，会整体翻转它与库的优先级，表现是原生控件与弹层基线被库样式盖住。新增分片默认进层；只有要和库抢默认值的规则才写进不分层的 `globals.css`。
