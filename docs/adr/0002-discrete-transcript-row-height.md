---
status: proposed
---

# Transcript 行高只走离散态

Markstream 虚拟时间线把行高变化写进总高和 `scrollTop`。思考折叠的高度动画、短助手估高保底 160、Tool Call 从折叠 48 跳到展开，都会让滚动条抽。测进时间线的高度只允许离散态：思考是标题，或标题加 180 槽。Tool Call 折叠一行，展开一次跳。不 fork 库，外层不做高度过渡。

## Considered options

- 给 markstream 打补丁或防抖 ResizeObserver。绑死库版本，升级后再抖。
- 外层高度动画。动画帧就是连续测量，症状更重。
- 估高宁可偏高（短助手保底 160）。侧栏拖拽已松手再解冻。保底让上翻历史边滚边纠。
- 离散态行高（采纳）。过渡用 opacity。展开靠一次测量。

## Consequences

思考流式增量在固定槽内滚。用户点开 Tool Call 允许一次跳。估高贴近折叠态，去掉 160 保底。单测锁两态策略，不锁算术。
