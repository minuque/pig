# 动效的几条硬约束

- 状态：已采纳
- 代码：`apps/web/src/style/motion.css`（`.settle-in`、`dialog-out`、`.edge-veil-*`、`.edge-fade-menu`、`.brand-peek`）、`apps/web/src/features/session-workbench/hooks/use-composer-dock.ts`

## 背景

工作台动效集中在 `motion.css`。其中几处受渲染管线、库的行为和代码侧读取方式限制，等价写法会产生实际差异，读取值看不出来。

## 决定

### 首屏落位只能用 `backwards`

`.settle-in` 的 `animation-fill-mode` 只能是 `backwards`。`both` / `forwards` 会把结束态的 `translate: 0` 留在输入条外框上，外框因此成为 backdrop root，输入卡的毛玻璃抽不到背后的正文。

### 对话框关闭态单独一条关键帧

对话框进出走 `scale` / `opacity` 独立属性，浮层通用的 `pop-reveal-out` 只动 `transform`，打在对话框上不产生变化，所以 `[data-state="closed"]` 另给 `dialog-out`。

### 滚动边缘渐隐分两种实现

列表与正文用贴边渐变层（`.edge-veil-*`），不用 `mask`：`mask` 会连吸顶元素和滚动条一起压淡。没有吸顶元素的浮层（`.edge-fade-menu`）仍用 `mask`，并多加一层右侧不透明遮罩，让滚动条不跟着淡。两者都由 `scroll()` 时间线驱动，不支持时保持隐藏，退化为无渐隐。

### 品牌头像探头与开屏同源

`.brand-peek` 与开屏的 `pig-peek` 是同一段探头节奏（28% 处的位移与倾角一致），两处关键帧要同步改。

### 停靠时长由代码拼接读取

`--composer-dock-in` / `--composer-dock-out` 在 CSS 里没有字面引用：`use-composer-dock.ts` 按 `--composer-dock-${dock}` 拼名字读值，读不到就是 0。改名或删除 token 前先改那段代码。

## 后果

改这几处前先核上面的条件。fill-mode、mask 与关键帧的取舍产生的是渲染差异，不是时长差异。
