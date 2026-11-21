# asChild 的触发器不写自己的 data-slot

- 状态：已采纳
- 代码：`apps/web/src/components/ui/dialog/DialogTrigger.vue`（触发器的 `data-slot` 绑定），同样的分支在 collapsible、context-menu、dropdown-menu、hover-card、popover、tooltip 的 Trigger 上

## 背景

reka-ui 的 `asChild` 让触发器把渲染让给调用方给的子元素，我们同时用 `data-slot` 给自家触发器打标记供样式选择。两件事落在同一个元素上时，谁写 `data-slot` 就决定样式命中谁。

## 决定

`asChild` 为真时不传 `data-slot`（`props.asChild ? forwarded : { ...forwarded, "data-slot": "…" }`），标记留给子元素自己。

## 后果

`asChild` 用法下自家触发器的 `data-slot` 样式不生效，这是预期的：调用方子元素有自己的标记。新增 Trigger 组件必须照抄这个分支，否则会盖掉调用方子元素的 `data-slot`。
