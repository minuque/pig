---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  primary: "#5E6AD2"
  primary-dark: "#5E6AD2"
  primary-hover-light: "#4C56B8"
  primary-hover-dark: "#6B77DC"
  primary-on: "#FFFFFF"
  link-light: "#0B6F88"
  link-dark: "#4CCCE6"
  window-light: "#FFFFFF"
  sidebar-light: "#F7F8F8"
  overlay-light: "#FBFBFC"
  window-dark: "#101012"
  sidebar-dark: "#0D0D0E"
  card-dark: "#17171A"
  overlay-dark: "#1C1C1F"
  ink-light: "#282A30"
  ink-secondary-light: "#4C5159"
  ink-muted-light: "#6A707C"
  ink-dark: "#E8EAED"
  ink-secondary-dark: "#9DA4AE"
  ink-muted-dark: "#7C8490"
typography:
  heading:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.2px"
  title:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, PingFang SC, Microsoft YaHei, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24.5px"
rounded:
  control: "6px"
  card: "8px"
  dialog: "12px"
  pill: "9999px"
spacing:
  2xs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  2xl: "32px"
---

# Design System: pig 工作台

## 基调

克制、安静。表面、文字、强调色取 Linear 的冷灰与靛（`#5E6AD2`）；悬停走中性灰，选中铺极淡的靛；cyan 只给链接与进行中。

优先级：解决问题 > 易于使用 > 简洁美观。UI 不抢注意力，靠布局和控件本身说话，不靠说明文字和装饰。

## Token 分层

`apps/web/src/style/tokens.css` 分三层，组件只读后两层：

1. **原值**：各色彩家族的实色与文字色、7 个标识色 `--hue-*`，只写 hex / rgba，不引外部色板。
2. **语义层**：全站共用，一个概念一个词：`fg`、`bg`、`border`、`accent`、状态 `-text` / `-subtle`。
3. **组件层**：只给一类组件用，以组件名开头（`--composer-*`、`--glass-*`、`--language-*`、`--mascot-*`）。能用语义档就不进这一层。

新 token 写进对应分区注释下，`/design` 页按这些注释分组。

## 规则

1. **一页一个强调色。** 强调色只给主操作、焦点、选中底；活动态走 cyan；卡片、区块不铺强调色。
2. **最多 4 种字号。** 层级靠字重和三级文字色。
3. **默认扁平，有阴影就用环。** 只有浮起来的层才有阴影和毛玻璃；有阴影的表面用 `box-shadow: 0 0 0 var(--border-width) …` 画环，不写 `border`（`border` 会在圆角内侧留割裂线）。
4. **不卡片套卡片。** 卡片里分组用标题加分割线。
5. **圆角同心。** 内层 = 外层 − 内边距。
6. **规范只有一套。** 按钮、间距、圆角、分割线、弹窗、动画、阴影全站共用。业务组件用基础件时不补外观（圆形、描边、阴影、毛玻璃），尺寸只取组件自带档位。
   Why：补出来的外观让同一种控件在不同地方长得不一样。
   <!-- 2026-11-21：「关闭按钮默认用 s size」，去掉 toast 关闭键的圆形外挂样式 -->
7. **能用产品表达的，不加文案。** 纯图标按钮的 tooltip 是它的名字，不重复可见文字。

## 颜色

### 强调色与活动态

| token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--accent-solid` / `-hover` | `#5E6AD2` / `#4C56B8` | `#5E6AD2` / `#6B77DC` | 主按钮、发送键、指示器、选中描边；字配 `--fg-on-accent` |
| `--accent-text` | indigo-11 | indigo-11 | 强调文字、`--focus-color` / `--focus-ring` |
| `--bg-selected` | accent 11% | accent 16%（默认预设实色 `#1A2143`） | 选中底 |
| `--bg-hover` | fg 6% | white 6% | 悬停底 |
| `--info-*` | `#0B6F88` | cyan-11 | 链接 `--link`、运行状态、转圈、进度条、用量环 |

- 外观预设（`paper` / `ocean` / `grove` / `iris`）由 `utils/theme-palette.ts` 从 `canvas + accent` 推导表面、文字与强调色阶；`--tone-*` 读推导结果。
- 发送键强调色实心，停止键 `--danger-solid`，不可用时换 `--bg-emphasis` 底配 `--fg-secondary`，不降透明度。「滚动到底」用反色 `--bg-inverse` / `--fg-inverse`。

### 中性色

| 层 | 浅色 | 深色 | token |
| --- | --- | --- | --- |
| 窗口、主区 | `#FFFFFF` | `#101012` | `--bg` |
| 侧栏、抽屉、设置导航 | `#F7F8F8` | `#0D0D0E` | `--sidebar` |
| 卡片、输入卡、气泡 | `#F7F8F8` | `#17171A` | `--bg-surface` |
| 浮起的实色表面 | `#FBFBFC` | `#1C1C1F` | `--bg-raised` |

| 文字 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--fg` | `#282A30` | `#E8EAED` | 正文、标题 |
| `--fg-secondary` | `#4C5159` | `#9DA4AE` | 次要信息 |
| `--fg-muted` | `#6A707C` | `#7C8490` | 占位、时间戳、弱图标 |

- 描边：`--border-subtle` / `--border` / `--border-strong`，浅色 black alpha，深色 white `4.5% / 7% / 13%`。分割线只用 1px `--border-subtle`。
- 控件外框 `--border-input`；遮罩 `--overlay`；`color="neutral"` 读 `--bg-muted` / `--fg-secondary`。

### 状态色

- 基础件 `color` 取 `accent` / `neutral` / `info` / `success` / `warning` / `danger`，项目图标与首字母徽章另可取 7 个标识色。组件写成 `data-tone`，只读 `--tone` / `--tone-text` / `--tone-subtle` / `--tone-border`。
- 状态族命名 `--*-solid` / `--*-text` / `--*-subtle`（浅底浅色 8%、深色 16%）。
- 悬停、按下不另定色，叠 `--bg-hover` / `--bg-emphasis`。
- 默认不加脉冲，`StatusIndicator` 需要引起注意时才开 `pulse`。

### 例外

`--language-*`（代码块语言图标）、Mermaid 深色配色（`mermaid.css`）、`--mascot-*`、`--favorite`、`--brand-mark-bg`、`--theme-wire-*` 与强度滑条渐变：语义档没有对应值，可以直接写色。

## 字号

| token | 默认 | S | L | 用途 |
| --- | --- | --- | --- | --- |
| `--text-meta` | 12 | 11 | 13 | 辅助信息、分组标题、时间、标签 |
| `--text-body` | 14 | 13 | 15 | 正文、按钮、菜单、列表行 |
| `--text-title` | 16 | 15 | 17 | 会话标题、弹层标题 |
| `--text-heading` | 24 | 24 | 24 | 页面大标题 |
| `--text-code` | 13 等宽 | 12 | 14 | 代码、路径、快捷键（可单独设 10–16） |

- 字重只用 400、500、600。
- 对话区 Markdown 与项目缩写字母不受这几档约束。

## 圆角

| token | 值 | 给谁 |
| --- | --- | --- |
| `--radius-control` | 6 | 按钮、图标按钮、选择框、输入框、标签、菜单项、侧栏行 |
| `--radius-card` | 8 | 卡片、面板、代码块、浮层、工具卡片 |
| `--radius-dialog` | 12 | 对话框、命令面板、设置里的分行卡片 |
| `--composer-radius` | 18 | 输入卡 |
| `--radius-pill` | 9999 | 胶囊、圆形按钮 |

嵌套写 `calc(外层 - 内边距)`，太小用 `max()` 兜到 `--radius-control` 一半。菜单例外：外 8、内边距 4、项 6。

## 阴影与表面

| 表面 | 写法 |
| --- | --- |
| 提示、悬停卡、拖拽中的行、滚动到底按钮 | `--shadow-popover` |
| 对话框、抽屉、图片预览 | `--shadow-dialog` |
| 命令面板、警告框 | `--glass-*` |
| 菜单、下拉、选择框浮层、浮卡、toast | `--float-bg` + `--float-shadow` + `--glass-filter` |
| 输入卡 | `--composer-bg` + `--glass-filter` + `--composer-inset` + `--composer-shadow`；聚焦只加深外环 |
| 静态卡片 | `--bg-surface` 或 1px `--border` inset 细线，二选一，不加阴影 |

- 环都已写进上面的阴影 token，组件只写一行 `box-shadow: var(--…)`，不补 `border`。
- 分行卡片用 `CardList` + `CardRow`（`@components/ui/card`），不自写行线与内边距。

## 控件

- 按钮四变体：`solid` 主操作（一页一个）、`secondary`（`--bg-muted` 底）、`outline`（透明底，单环 `--outline-shadow`，环色取文字色：浅色 24%、深色 16%）、`ghost`（悬停才铺 `--bg-hover`）。
- 选择框 surface 变体读 `--control-bg` + `--control-shadow`（一圈环加淡投影，不加内高光）。
- outline / ghost 的图标常态 `--fg-muted`，悬停、选中（`data-active` / `aria-pressed`）、展开、弹层打开时随文字提亮。
- **可交互的行、触发器、图标按钮：常态 `--fg-secondary` 或 `--fg-muted`，悬停、展开、选中时文字和图标一律提亮到 `--fg`，状态色绝不与常态同色。侧栏行整行悬停只提亮标题，meta 与行内按钮等到自己被悬停才提亮。**
  Why：状态色与常态一样，就看不出能点、已展开或已选中。
  <!-- 2026-11-21：「tool-run 和 tool-row hover/expanded 状态色缺失」「为啥这5个按钮 selected/hover 颜色亮度要弱一档」 -->
- **显示模型名的地方，前面一律加 `VendorMark`（传模型的 provider）。**
  Why：和模型选择器一致，一眼认出供应商。
  <!-- 2026-11-21：「模型名称前补上模型icon」 -->
- `TextFieldRoot` 的 `invalid` 表达错误态（危险色内环与焦点环）。
- 设置行 = 标题 + 一行说明 + 控件。项目缩写用灰色 soft Badge。

## 间距与尺寸

- 间距 `--space-2xs/xs/sm/md/lg/xl/2xl` = 4/8/12/16/24/28/32。
- 控件高 `--control-sm/md/lg` = 28/32/36；图标按钮与侧栏行默认 28，菜单项与输入卡控件 32。
- 图标 `--icon-sm/md/lg/xl` = 12/14/16/32，线宽 `--icon-stroke`。
- 头部高 `--header-height` 44；macOS 标题条 `--titlebar-inset` 44。

## 层级

- 局部容器内：`--z-behind` / `--z-raise` / `--z-sticky` / `--z-overlay` = -1 / 1 / 2 / 3。
- 全局浮层：`--z-resizer` / `--z-window-controls` / `--z-menu` / `--z-drawer` / `--z-modal` / `--z-popover` / `--z-drag` = 1 / 1 / 10 / 20 / 30 / 35 / 40。菜单、下拉、浮卡、提示挂 body，取 `--z-popover`。
- stylelint 禁止 SFC 里写 `--*` 声明与非零数字 `z-index`。

## 动画

浮层进 140ms、出 100ms，只动透明度与位移；对话框用 `scale` 0.98 → 1 加透明度；主题切换 200ms cross-fade。动效只表达在跑、层级变化、状态切换，遵守 `prefers-reduced-motion`。关键帧收在 `motion.css`。

## 不要

- 不加第二个强调色、装饰色、渐变、光晕。
- 不给静止的卡片、侧栏、工具栏加阴影或毛玻璃。
- 不加第 5 种字号、第 4 级文字灰。
- 不写产品本身已经说清楚的文案。
