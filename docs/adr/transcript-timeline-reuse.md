# 时间线行与轮靠对象引用复用

- 状态：已采纳
- 代码：`apps/web/src/features/transcript-view/lib/transcript-rows.ts`（`createTimelineRowsBuilder`、`reuseTimelineRows`）、`apps/web/src/features/transcript-view/lib/transcript-turns.ts`（`reuseTimelineTurns`）

## 背景

流式输出每条消息都会重算整条时间线。逐行深比较成本高，而虚拟窗口和 `content-visibility` 的收益依赖未变的行保持同一个对象：引用一变，Vue 就重排那一行，滚动位置和展开态都会抖。

## 决定

按 turn 缓存 `appendTurn` 的结果，输入条目引用没变就直接复用；行级再由 `reuseTimelineRows` 逐条比对，未变化的行返回原对象。合并层（会话层的条目合并）对未变条目保持对象同一性，因此引用比对等价于内容比对，不做深比较。

## 后果

复用正确性依赖合并层的同一性保证：任何在合并层「重新构造同一内容」的改动都会把这里降级成全量重建，表现为流式时整段重排。新增行类型要同时补 `sameToolRow` 一类的等价判断，否则那一类行每次都算作变化。缓存有上限（`TURN_CACHE_LIMIT`），超限淘汰后首次重建是预期行为。
