---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  primary: "#5B5BD6"
  primary-hover-light: "#5151CD"
  primary-hover-dark: "#6E6ADE"
  primary-on: "#FFFFFF"
  link-light: "#0B6F88"
  link-dark: "#4CCCE6"
  window-light: "#F2F2F6"
  sidebar-light: "#EEEEF2"
  overlay-light: "#FBFBFF"
  window-dark: "#101012"
  sidebar-dark: "#0A0A0B"
  card-dark: "#17171A"
  overlay-dark: "#1E1E20"
  ink-light: "#3C3C42"
  ink-secondary-light: "#57575E"
  ink-faint-light: "#6B6B72"
  ink-dark: "#E8EAED"
  ink-secondary-dark: "#9DA4AE"
  ink-faint-dark: "#85858C"
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.2px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
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

克制、安静、舒服，表面与文字取 Linear 的冷灰基调。主题色 Radix iris，中性色 Radix slate。

优先级：解决问题 > 易于使用 > 好看美观。界面靠布局和控件本身说话，不靠说明文字和装饰。

## Token 分层

`style/tokens.css` 分三层，组件只读语义层和组件层：

1. **原色阶**：Radix slate、iris 与状态色板由 rt 提供，`tokens.css` 不另写。
2. **语义层**：全站共用，按「表面、前景、边与分割、交互、状态、字、间距、圆角、阴影、动效、图标与控件高、布局、层级」分组。命名一个概念一个词：前景 `fg`、底 `bg`、边 `border`、品牌色 `accent`、状态 `-text` / `-subtle`。
3. **组件层**：只给单个组件或一类内容用，名字以组件开头（`--composer-*`、`--file-tab-*`、`--settings-*`、`--language-*`、`--mascot-*`）。能用语义档就不进这一层。

`/design` 页直接读这些分区注释分组，新增 token 时写进对应小标题下。

## 七条规则

1. **一页一个强调色。** 强调色只用于主操作、选中态、焦点、链接。卡片、区块不铺强调色；侧栏行的悬停与选中只带极淡的主题色底。
2. **一页最多 4 种字号。** 全局只有 4 档，层级靠字重和三级文字色。
3. **默认扁平。** 不叠阴影、不发光、不加毛玻璃。阴影只给真正浮起来的层。
4. **不卡片套卡片。** 卡片里的分组用标题加分割线。
5. **圆角同心。** 内层圆角 = 外层圆角 − 内边距。
6. **规范只有一套。** 按钮、间距、圆角、分割线、弹窗、动画、阴影全站共用。
7. **能用产品表达的，不加文案。** 纯图标按钮的 tooltip 是它的名字；可见文字已写的内容不再用 tooltip 重复。

## 颜色

### 强调色

强调色用 Radix 的 `iris`。`index.html` 与 `ThemeRoot` 的 `data-accent-color="iris"` 把它映射到 `--accent-*`。

- `--accent-solid`：第 9 级。实心主按钮的底，文字用 `--fg-on-accent`（白）。
- 焦点环：第 11 级。深色下文字类用法必须用第 11 级。
- 链接 `--link` 用 cyan，与「进行中」同色：浅色 `#0B6F88`（侧栏 5.0:1），深色 cyan-11。
- 「进行中」不用强调色：运行状态、转圈、上下文进度条与用量环走 `--info-*`（cyan），悬停与选中仍是 iris。
- 一页只出现一个 solid 主按钮，其余用 soft 或 ghost。
- 输入卡的发送 / 停止键与「滚动到底部」用反色（`--bg-inverse` / `--fg-inverse`），不用强调色。反色取中灰（浅色 `#6B6B72` 配白字 5.3:1，深色 `#9DA4AE` 配深字 7.6:1），不用纯黑白。发送键不可用时换 `--bg-emphasis` 底配 `--fg-faint` 图标，不靠降透明度。

### 中性色

中性色用 Radix 的 `slate`（`data-gray-color="slate"`），描边与 rt 基础件的灰阶跟着它走；表面与文字是下表的固定值，取自 Linear 基调。

| 层                             | 浅色                                 | 深色                      | token                         |
| ------------------------------ | ------------------------------------ | ------------------------- | ----------------------------- |
| 窗口、主区                     | `#F2F2F6`                            | `#101012`                 | `--bg`                        |
| 侧栏（主侧栏、抽屉、设置导航） | `#EEEEF2`（比主区深半档）            | `#0A0A0B`（比主区暗一截） | `--bg-sunken`                 |
| 卡片、输入卡、气泡、工具输入   | `#F6F6FA`                            | `#17171A`                 | `--bg-surface`                |
| 浮层                           | `#FBFBFF`                            | `#1E1E20`                 | `--bg-raised`                 |
| 按钮与行悬停 / 选中            | 主题色 `--accent-a3` / `--accent-a4` | `--accent-a3` / `#1A2143` | `--bg-hover`、`--bg-selected` |

文字只有三级，固定色。浅色与表面同一冷色相（OKLCH 色相约 285°），深色主文字与次要文字偏冷蓝（约 258°）：

| 级  | 浅色      | 深色      | 对主区     | 用途                                                       |
| --- | --------- | --------- | ---------- | ---------------------------------------------------------- |
| 主  | `#3C3C42` | `#E8EAED` | 9.8 / 15.8 | 正文、标题                                                 |
| 次  | `#57575E` | `#9DA4AE` | 6.4 / 7.6  | 次要信息                                                   |
| 弱  | `#6B6B72` | `#85858C` | 4.7 / 5.2  | 时间、占位、空状态等弱提示，在主区、侧栏、卡片上都 ≥ 4.5:1 |

描边只有 `--border`（gray-a4）与 `--border-subtle`（gray-a3）。分割线只用 1px `--border-subtle`。

### 状态色

文字色（`--success-text`、`--info-text`、`--warning-text`、`--danger-text`）配同色相浅底（`--*-subtle`）。成功取 Radix green 第 11 级与第 3 级 alpha；信息取 cyan：深色文字 cyan-11、填充 cyan-9，浅色文字 `#0B6F88`（侧栏 5.0:1）、填充 `#0A7F9C`（4.0:1），底为 cyan 第 3 级 alpha；警告、危险用项目自定色值，深浅各一套。进度条与用量环用 `--info-solid` 实色填充。不用实色填充，不加光晕。状态色只在真有状态时出现。

### 例外

- `--language-*`：代码块语言图标，只在代码块里。
- Mermaid 图：浅色用 pele 自带的默认配色；深色在 `mermaid.css` 接 `--mermaid-*`（底 `#101012`、填充 `#17171A`、线 `#2A2A2E`）。
- `--mascot-*`：吉祥物插画，深浅共用 logo 原色。

## 字号

| token            | 默认    | S 档 | L 档 | 用途                           |
| ---------------- | ------- | ---- | ---- | ------------------------------ |
| `--text-meta`    | 12      | 11   | 13   | 辅助信息、分组标题、时间、标签 |
| `--text-body`    | 14      | 13   | 15   | 正文、按钮、菜单、列表行       |
| `--text-title`   | 16      | 15   | 17   | 会话标题、弹层标题             |
| `--text-heading` | 24      | 24   | 24   | 页面大标题                     |
| `--text-code`    | 13 等宽 | 12   | 14   | 代码、路径、快捷键             |

- 字重只用 400、500、600。
- 界面字号档 S/M/L 缩放辅助、正文、标题三档，页面大标题不动；代码字号直接选 px（10–16，默认 13），只改 `--text-code`，`--text-code-line` 固定不动，文件面板按它算行位置。
- `--monogram-size` 是图形尺寸，不算字号。
- 对话区 Markdown 排版对齐 cc-wrapper，不受四档约束。

## 圆角

| token               | 值   | 给谁                                 |
| ------------------- | ---- | ------------------------------------ |
| `--radius-control`  | 6    | 按钮、输入框、标签、菜单项、侧栏行   |
| `--radius-card`     | 8    | 卡片、面板、代码块、图片、下拉、浮层 |
| `--radius-dialog`   | 12   | 对话框、设置里的分行卡片             |
| `--composer-radius` | 32   | 输入卡                               |
| `--radius-pill`     | 9999 | 胶囊、圆形按钮                       |

- rt 的 `--radius-1..6` 在 `rt.css` 接到这三档。
- 嵌套写 `calc(外层 - 内边距)`；结果太小时用 `max()` 兜到 `--radius-control` 的一半。rt 菜单：外 8、内边距 4、项取 `--radius-control` 6，比同心值 4 大 2px。

## 阴影与层级

| token               | 给谁                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `--shadow-popover`  | 下拉、菜单、提示、悬停卡、拖拽中的行、滚动到底按钮                         |
| `--shadow-dialog`   | 对话框、抽屉、图片预览                                                     |
| `--composer-shadow` | 输入卡：1px 内环描边加内侧淡阴影（`--composer-inset`），浅色再加底部柔投影 |

- 浮层与对话框阴影全用 rt 原值（自带 1px 外环）：`.radix-themes` 内 `--shadow-popover` 指向 rt `--shadow-5`，`--shadow-dialog` 指向 `--shadow-6`。
- 浮层底色是实色 `--bg-raised`（`.surface-float`），不透明，不模糊。
- 卡片用 1px `--border` 描边、不铺底；描边与底色差只用一种。
- 分行卡片一律用 `CardList` + `CardRow`（`@components/ui/card`），不自写行线与内边距：12 圆角，行左右 16、上下 12，行线贴边；`interactive` 加悬停底；`bleed` 不带左右内边距，内容自己读 `--card-padding`。对话里的工具卡片留 8 圆角，与代码卡一致。
- 焦点环：`--focus-ring` = 2px 实色第 11 级；危险态 `--focus-ring-danger`。

## 间距与尺寸

- 间距基数 4px：`--space-2xs/xs/sm/md/lg/xl/2xl` = 4/8/12/16/24/28/32。
- 控件高三档：`--control-sm/md/lg` = 28/32/40（图标按钮与侧栏行 28，菜单项与输入卡控件 32，输入框 40）。
- 图标四档：`--icon-sm/md/lg/xl` = 12/14/16/32，线宽 `--icon-stroke`。
- 头部高 `--header-height` 44px；macOS 标题条 `--titlebar-inset` 44px，其余平台 0。

## 动画

浮层进出 140ms / 100ms，只动透明度与位移。动效只表达在跑、层级变化与状态切换，遵守 `prefers-reduced-motion`。

## 组件

- 设置行只有标签和控件，没有说明文字。
- 项目缩写用灰色 soft Badge；上下文用量图用强调色同色系深浅区分各段。

## 不要

- 不加第二个强调色、装饰色、渐变、光晕、毛玻璃。
- 不给静止的卡片、侧栏、工具栏加阴影。
- 不加第 5 种字号，不加第 4 级文字灰。
- 不写说明产品本身已经说清楚的文案。
