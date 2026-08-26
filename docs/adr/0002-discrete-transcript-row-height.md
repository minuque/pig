---
status: proposed
---

# Transcript 使用闭合测量边界和离散行高

Markstream 根据已测行高维护虚拟总高和滚动锚点。卡顿与滚动条抖动有两个独立根因：每个 Assistant Message 挂载时重复创建 `useColorMode`，会用全局禁动画样式触发整页强制回流；`measureRef` 挂在 `.row`，但 Assistant Message、Tool Call 和思考占位的底部外边距折叠到测量边界之外，虚拟总高持续低于实际占用高度。思考高度动画、Tool Call 展开和流式内容更新会放大这两个问题，但不是最先修的根因。

## Decision

按以下顺序处理，前一项通过验收后再做下一项：

1. 主题状态只创建一次。`useColorScheme` 返回同一组共享状态，虚拟行不再各自调用 `useColorMode`。挂载历史 Assistant Message 不得插入全局禁动画样式或强制读取布局。
2. `measureRef` 覆盖整行实际占用高度。`.row` 建立独立格式化上下文，收住子组件外边距；行间距不得落在测量边界之外。估高和测高使用同一个包含间距的行高契约。
3. 外层行高只走离散态。思考只有标题态和“标题加固定 180px 视口”态，流式增量在内部滚动；移除 `grid-template-rows` 高度动画，只保留不影响布局的 opacity。Tool Call 折叠态固定，展开或折叠各允许一次测量和一次锚点修正。
4. Tool Call 展开态按 TranscriptItem id 保存。虚拟卸载后重新挂载不得悄悄折叠，也不得用折叠高度覆盖展开态缓存。
5. 估高贴近默认折叠态，删除短 Assistant Message 的 160px 保底。长 Markdown 继续交给 Markstream 节点虚拟化。`overscan`、minimap 几何读取和缓存策略只在上述根因修复后按性能轨迹调整。

现有 `markstream-vue` 补丁只处理正文宽度缓存。本方案不把行高、锚点或 ResizeObserver 防抖继续塞进依赖补丁。

## Verification

使用至少 100 行、包含 Assistant Message、Tool Call 和思考内容的 Transcript 验收：

- 滚动 300px 时，挂载 Assistant Message 不产生由 `useColorMode` 引起的长任务；1 倍 CPU 下不得出现超过 50ms 的对应主线程任务。
- 每个已挂载虚拟项的实际外高与 Markstream 记录高度误差不超过 1px。同一历史区间往返第二次，未改内容时 `scrollHeight` 漂移不超过 1px。
- 思考流式增长不改变外层行高。思考切换和 Tool Call 切换各只产生一次离散总高变化，用户上翻期间不连续回写 `scrollTop`。
- 增加一个浏览器滚动回归，覆盖测量边界、主题初始化次数和离散态；纯函数单测只锁状态策略，不重复锁像素算术。

## Considered options

- 给 Markstream 增加行高补丁或防抖 ResizeObserver。它只能掩盖错误测量，还会继续扩大现有版本补丁。
- 保留外层高度动画。动画每帧都会进入 ResizeObserver、虚拟总高和锚点回写链路。
- 只提高估高或保留 160px 保底。它减少首帧低估，却不能修复外边距漏测和重复主题初始化。
- 关闭虚拟化。短期不抖，但长 Session 会把全部 Markdown 和 Tool Call 留在 DOM。

## Consequences

思考展开不再有高度动画。Tool Call 展开状态需要一份按 id 保存的当前 Session UI 状态。主题状态成为单一共享实例。实现不新增依赖，不扩大 Markstream 补丁；先修测量正确性，再决定是否缩小 overscan 或减少 minimap 布局读取。
