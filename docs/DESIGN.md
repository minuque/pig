# Design System: pig 工作台

只记偏好与规则。token 取值、组件外观与整页效果以 design-lab（`/design`）为准，本文不抄数值。

## 偏好

克制、安静。表面、文字、强调色取 Linear 的冷灰与靛；悬停走中性灰，选中铺极淡的靛；cyan 只给链接与进行中。

优先级：解决问题 > 易于使用 > 简洁美观。UI 不抢注意力，靠布局和控件本身说话，不靠说明文字和装饰。

## Token 与样式写法

- `packages/ui/src/styles/tokens.css`（设计系统）与 `apps/web/src/style/tokens.css`（应用）分三层：原色阶 → 语义层（`fg`、`bg`、`border`、`accent`、状态 `-text` / `-subtle`）→ 组件层（以组件名开头）。组件只读后两层，能用语义档就不进组件层。
- 新 token 写进对应分区注释下，`/design` 按这些注释分组。
- 基础件用平铺、最小的 `:where([data-slot=…])` 写默认外观，颜色经 `data-tone` 读 `--tone-*`。
- 业务微调写 SFC scoped 样式，选择器带 data 属性压过 `:where()`；不用 `!important`，模板里不堆工具类。
- SFC 不声明 `--*`，不写裸 hex / rgb / `color-mix`，不写非零 `z-index`；动画只用 `motion.css` 的类与 `@keyframes`。缺档先补 token 再写组件。
- 尺寸不写死：高度、行高、间距读 `--control-*`、`--space-*`、`--text-*`，图标读 `--icon-*`。

## 规则

1. **一页一个强调色。** 强调色只给主操作、焦点、选中底；活动态走 cyan；卡片、区块不铺强调色。
2. **最多 4 种字号。** 层级靠字重（400 / 500 / 600）和三级文字色。对话区 Markdown 不受此约束。
3. **默认扁平，有阴影就用环。** 只有浮起来的层才有阴影和毛玻璃；环写进阴影 token，组件只写一行 `box-shadow: var(--…)`，不补 `border`。
4. **不卡片套卡片。** 卡片里分组用标题加分割线；分行卡片用 `CardList` + `CardRow`。
5. **圆角同心。** 内层 = 外层 − 内边距，太小用 `max()` 兜到 `--radius-control` 一半。
6. **规范只有一套。** 业务组件用基础件时不补外观（圆形、描边、阴影、毛玻璃），尺寸只取组件自带的 `s` / `m`。
   Why：补出来的外观让同一种控件在不同地方长得不一样。
7. **能用产品表达的，不加文案。** 纯图标按钮的 tooltip 是它的名字，不重复可见文字。
8. **布局密度两档。** `html[data-density]` 取 `normal`（默认）或 `compact`；compact 只改 token，组件不按密度写分支。

## 颜色

- 基础件 `color` 取 `accent` / `neutral` / `info` / `success` / `warning` / `danger`，项目图标与首字母徽章另可取 7 个标识色。
- 悬停、按下不另定色，叠 `--bg-hover` / `--bg-emphasis`。分割线只用 `--border-subtle`。
- 发送键强调色实心，停止键 `--danger-solid`；不可用时换 `--bg-emphasis` 底配 `--fg-secondary`，不降透明度。
- 默认不加脉冲，`StatusIndicator` 需要引起注意时才开 `pulse`。
- 例外：`--language-*`、Mermaid 深色配色、`--favorite`、`--theme-wire-*` 与强度滑条渐变可以直接写色。

## 表面

- 提示、悬停卡、拖拽中的行：`--shadow-popover`；对话框、抽屉、图片预览：`--shadow-dialog`。
- 菜单、下拉、浮卡、toast：`--float-bg` + `--float-shadow` + `--glass-filter`；命令面板、警告框：`--glass-*`。
- 输入卡上方的状态条：`--bg-raised` + 环，上圆角 `--radius-dialog`，底部伸进输入卡。
- 命令、文件浮板按菜单表面挂 body，离输入卡 8px；浮板打开时隐藏状态条，二者不叠放。
- 静态卡片：`--bg-surface` 或细线环二选一，不加阴影。
- 菜单、下拉、浮卡、提示挂 body，取 `--z-popover`。

## 控件

- 按钮四变体：`solid` 主操作（一页一个）、`secondary`、`outline`、`ghost`（悬停才铺底）。
- **可交互的行、触发器、图标按钮：常态 `--fg-secondary` 或 `--fg-muted`，悬停、展开、选中时文字和图标提亮到 `--fg`，状态色绝不与常态同色。侧栏行整行悬停只提亮标题，meta 与行内按钮等到自己被悬停才提亮。**
  Why：状态色与常态一样，就看不出能点、已展开或已选中。
- **显示模型名的地方，前面一律加 `VendorMark`。**
  Why：和模型选择器一致，一眼认出供应商。
- **通知一律走 `notify()`（`@pig/ui/toast`），显示在右下角。页面上已能看到同样内容的传 `transient: true`，5 秒后消失；只有页面别处看不到的错误才常驻。**
  Why：同一条报错在 toast 和页面里各留一份，常驻的 toast 只是重复。
- 关闭按钮默认 `s`。`TextFieldRoot` 用 `invalid` 表达错误态。
- 设置行 = 标题 + 一行说明 + 控件。项目缩写用灰色 soft Badge。

## 动画

浮层只动透明度与位移，对话框加轻微 `scale`。动效只表达在跑、层级变化、状态切换，遵守 `prefers-reduced-motion`。

## 不要

- 不加第二个强调色、装饰色、渐变、光晕。
- 不给静止的卡片、侧栏、工具栏加阴影或毛玻璃。
- 不加第 5 种字号、第 4 级文字灰。
- 不写产品本身已经说清楚的文案。
