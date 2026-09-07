---
version: alpha
name: pig Workbench
description: A Pi Agent GUI with cream raised panels in light mode and elevated blue-gray surfaces in dark mode. Action and focus blue is separate from link blue. Sidebar selection is neutral. Sunset and dusk colors are decorative only. The layout uses a sidebar and an opaque transcript column. Navigation and window controls use lower contrast than transcript content.

colors:
  primary: "#637cd2"
  primary-active: "#4d64b7"
  secondary: "#495fad"
  on-primary: "#ffffff"
  canvas: "#f1f2f3"
  canvas-soft: "#fafafb"
  surface: "#ffffff"
  main: "#ffffff"
  panel: "#fcfbf8"
  ink: "#1f2124"
  ink-secondary: "#62656b"
  ink-muted: "#62656b"
  ink-faint: "#9a9da3"
  hairline: "#ecedef"
  accent-sunset: "#ee650d"
  accent-sunset-soft: "#ffc285"
  accent-dusk: "#7c3aed"
  accent-twilight: "#9a72d8"
  accent-breeze: "#6494d2"
  accent-midnight: "#0d1726"
  accent-orange: "#ef720d"
  accent-orange-deep: "#9c3b00"
  accent-green: "#199a4d"
  danger-bg: "#fcecec"
  success-bg: "#e8f5ed"
  warning-bg: "#fdf1e5"
  info-bg: "#e6eaf8"

typography:
  display-1:
    fontFamily: SystemUI
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -2.125px
  display-2:
    fontFamily: SystemUI
    fontSize: 54px
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: -1.875px
  heading-1:
    fontFamily: SystemUI
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1px
  heading-2:
    fontFamily: SystemUI
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.23
    letterSpacing: -0.4px
  heading-3:
    fontFamily: SystemUI
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: -0.25px
  title:
    fontFamily: SystemUI
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.125px
  body-md:
    fontFamily: SystemUI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  body-sm:
    fontFamily: SystemUI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  button:
    fontFamily: SystemUI
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.38
    letterSpacing: 0
  caption:
    fontFamily: SystemUI
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.38
    letterSpacing: 0
  eyebrow:
    fontFamily: SystemUI
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: 0.125px
  caption-mono:
    fontFamily: GeistMono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 1.2px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 28px
  xxl: 32px

components:
  nav-bar:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    padding: 12px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
  button-utility:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 4px 14px
  button-icon-circular:
    backgroundColor: "rgba(15, 17, 21, 0.05)"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  badge-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.full}"
    padding: 4px 8px
  badge-mono:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption-mono}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  feature-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 16px
  feature-card-elevated:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  pricing-plan-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 16px
  pricing-plan-card-featured:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 16px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: 8px
  hero-band:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.heading-2}"
    padding: 32px
  footer:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.caption}"
    padding: 24px
  status-run:
    description: "Streaming / warning mark. Semantic orange."
    textColor: "{colors.accent-orange}"
  status-ok:
    description: "Success mark."
    textColor: "{colors.accent-green}"
  status-warn-deep:
    description: "Active-session / emphasis warning text."
    textColor: "{colors.accent-orange-deep}"
  mark-sunset:
    description: "Decorative sunset chip."
    backgroundColor: "{colors.accent-sunset-soft}"
    textColor: "{colors.accent-midnight}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-sunset-ink:
    description: "Sunset ink on midnight."
    backgroundColor: "{colors.accent-midnight}"
    textColor: "{colors.accent-sunset}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-dusk:
    description: "Decorative dusk/twilight chip."
    backgroundColor: "{colors.accent-twilight}"
    textColor: "{colors.accent-midnight}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-dusk-ink:
    description: "Dusk fill chip."
    backgroundColor: "{colors.accent-dusk}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-breeze:
    description: "Decorative breeze chip."
    backgroundColor: "{colors.accent-breeze}"
    textColor: "{colors.accent-midnight}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  illustration-well:
    description: "Illustration well on midnight."
    backgroundColor: "{colors.accent-midnight}"
    textColor: "{colors.on-primary}"

  ex-pricing-tier:
    description: "Quiet card on the conversation surface."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-pricing-tier-featured:
    description: "Featured surface. Polarity-flipped fill."
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-product-selector:
    description: "Summary card on canvas-soft."
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-cart-drawer:
    description: "Stacked list surface."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    item-divider: "{colors.hairline}"
  ex-app-shell-row:
    description: "Sidebar row. Active ink is primary."
    backgroundColor: "{colors.canvas-soft}"
    activeIndicator: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs} {spacing.sm}"
  ex-data-table-cell:
    description: "Dense table chrome."
    headerBackground: "{colors.canvas-soft}"
    headerTypography: "{typography.eyebrow}"
    bodyTypography: "{typography.body-sm}"
    cellPadding: "{spacing.xs} {spacing.sm}"
    rowBorder: "{colors.hairline}"
  ex-auth-form-card:
    description: "Form card."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-modal-card:
    description: "Modal surface with hairline."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-empty-state-card:
    description: "Empty-state frame."
    backgroundColor: "{colors.canvas-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    captionTypography: "{typography.body-md}"
  ex-toast:
    description: "Toast surface."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm} {spacing.md}"
    typography: "{typography.body-sm}"
---

## Overview

Pi Agent GUI 浅色用奶油色抬升面板，深色用抬升的蓝灰表面。系统 UI 字号默认 14px。动作蓝用于动作和焦点，链接使用更深的同一色相，侧栏选中使用中性灰。布局包含侧栏与不透明的对话列，导航和窗口控件的对比度低于对话内容。

浅色侧栏 `{colors.canvas-soft}`，对话列 `{colors.main}`，分组与输入卡 `{colors.panel}`。深色侧栏 `#17181a`、对话列 `#111214`、分组与输入卡 `#232427`。结构色 `{colors.primary}`（#637cd2）用于动作和焦点。控件圆角 `{rounded.lg}`（12px）。

深色是同一套分面的冷灰反相：对话 `#111214`、侧栏 `#17181a`、输入卡与分组 `#232427`、用户气泡 `#1f2022`、缝 `#2e3033`。次级井用 `#1c1d1f`。装饰用 sunset / dusk / twilight / breeze。阶段与栏目标签可用 `{typography.caption-mono}`。

窗体、输入卡和菜单均不透明。侧栏走 `--sidebar`，对话列 `--main`，分组与输入卡 `--panel`。输入卡和菜单使用不透明填充，浏览器与桌面颜色一致。浅色是默认入口。

## Colors

### Brand & Accent

- **Action Blue** (`{colors.primary}` — #637cd2)：动作、焦点和控件选中指示。深色提亮为 `#89a2f3`，主按钮字色为黑。链接走 `--link`（#495fad / `#acc2ff`），侧栏选中背景走 `--interaction-selected`。
- **Pressed Blue** (`{colors.primary-active}` — #4d64b7)：主按钮按下。
- **Link Blue** (`{colors.secondary}` — #495fad)：链接用更深的同一色相。

装饰（状态点、插图、次要标记）：

- `{colors.accent-sunset}` / `{colors.accent-sunset-soft}`
- `{colors.accent-dusk}` / `{colors.accent-twilight}`
- `{colors.accent-breeze}` / `{colors.accent-midnight}`

`{colors.accent-midnight}` 只作插图井。

### Surface

- **Conversation** (`{colors.main}` — #ffffff)：对话列。
- **Panel** (`{colors.panel}` — #fcfbf8)：侧栏分组与输入卡。
- **Surface** (`{colors.surface}` — #ffffff)：卡片。
- **Canvas** (`{colors.canvas}` — #f1f2f3)：次级井。
- **Secondary well** (`{colors.canvas-soft}` — #fafafb)：侧栏和页面底。
- **Hairline** (`{colors.hairline}` — #ecedef)：栏缝与控件边。

### Text

- **Ink** (`{colors.ink}` — #1f2124)
- **Charcoal** (`{colors.ink-secondary}` — #62656b)
- **Slate** (`{colors.ink-muted}` — #62656b)
- **Ash** (`{colors.ink-faint}` — #9a9da3)

### Semantic

- Success → `{colors.accent-green}`，井 `{colors.success-bg}`
- Warning / 运行 → `{colors.accent-orange}`（强调 `{colors.accent-orange-deep}`），井 `{colors.warning-bg}`
- Info 井 `{colors.info-bg}`
- Danger → `app.css` 独立红，井 `{colors.danger-bg}`

sunset 是装饰，orange 是语义。

### Reference palette

颜色基准来自 `.tmp/light.png` 和 `.tmp/dark.png` 的平坦区域与实心字形采样。

| 角色         | 浅色      | 深色      |
| ------------ | --------- | --------- |
| 对话底       | `#ffffff` | `#111214` |
| 侧栏         | `#fafafb` | `#17181a` |
| 选中行       | `#e7e9eb` | `#313236` |
| 输入卡/分组  | `#fcfbf8` | `#232427` |
| 输入边框     | `#e0e2e5` | `#3a3c40` |
| 菜单         | `#ffffff` | `#232427` |
| 菜单边框     | `#ecedef` | `#2e3033` |
| 用户气泡     | `#f7f8f9` | `#1f2022` |
| 链接         | `#495fad` | `#acc2ff` |
| 行内代码     | `#f2f2f3` | `#2b2c2f` |
| 行内代码文字 | `#1f2124` | `#f2f3f4` |
| 行内代码边   | `#ecedef` | `#2e3033` |

动作蓝以 `#637cd2` 为准。sunset / dusk 仍只作分类装饰。

### Dark

同一套分面的冷灰反相，写在 `app.css` `.dark`。

| 角色        | 值        |
| ----------- | --------- |
| 对话底      | `#111214` |
| 侧栏        | `#17181a` |
| 输入卡/分组 | `#232427` |
| 用户气泡    | `#1f2022` |
| 主字        | `#f2f3f4` |
| 次级字      | `#a5a8ad` |
| 弱字        | `#6c6f75` |
| 缝          | `#2e3033` |
| primary     | `#89a2f3` |

## Typography

### Font Family

**`SystemUI`**：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`。

代码与 `{typography.caption-mono}`：ui-monospace / SF Mono / Menlo / Consolas。

`{typography.caption-mono}` 用于阶段、栏目标签，大写 + 正 tracking。

对话 Markdown 正文字号 `{typography.body-md}`，行高 `1.8`（`--ms-leading-body`）。行内代码底 `--inline-code`，边 `hairline`。

### Hierarchy

| Token                       | Size | Weight | Line Height | Use                      |
| --------------------------- | ---- | ------ | ----------- | ------------------------ |
| `{typography.display-1}`    | 64px | 700    | 1.0         | 展示标题                 |
| `{typography.display-2}`    | 54px | 700    | 1.04        | 展示标题                 |
| `{typography.heading-1}`    | 40px | 700    | 1.1         | 大节标题                 |
| `{typography.heading-2}`    | 26px | 600    | 1.23        | 欢迎页 / 空 Session 短句 |
| `{typography.heading-3}`    | 22px | 600    | 1.27        | 卡片标题                 |
| `{typography.title}`        | 16px | 600    | 1.4         | 栏标题                   |
| `{typography.body-md}`      | 14px | 400    | 1.43        | 工作台正文               |
| `{typography.body-sm}`      | 14px | 400    | 1.43        | 侧栏、导航、对话元数据   |
| `{typography.button}`       | 14px | 500    | 1.43        | 按钮                     |
| `{typography.caption}`      | 13px | 400    | 1.38        | 辅助说明                 |
| `{typography.eyebrow}`      | 12px | 600    | 1.33        | 徽章、小标签             |
| `{typography.caption-mono}` | 12px | 400    | 1.33        | 阶段 / 栏目标签          |

headline 只在展示场合。欢迎短句用 heading-2。栏标题 600，按钮 500。

## Layout

### Spacing

8px 基准。侧栏内边距 12/6；列表行 28–32px；输入卡固定 748px、Transcript 正文固定 732px 居中，侧栏拖拽只改变两侧留白。

### Shell

两栏铺满视口。桌面折叠保留 rail（56px，macOS 桌面 90px）。&lt;900px 左栏为抽屉。

### Responsive

| Name    | Width   | 变化                         |
| ------- | ------- | ---------------------------- |
| Desktop | ≥901px  | 两栏 + rail 折叠             |
| Tablet  | 521–900 | 抽屉                         |
| Mobile  | ≤520px  | 顶栏压缩，phase 文字收成圆点 |

## Elevation & Depth

| Level    | Treatment  | Use            |
| -------- | ---------- | -------------- |
| 0 — Flat | hairline   | 栏、列表、对话 |
| 1 — Soft | 一层轻阴影 | composer 卡    |
| 2 — Pop  | 稍深，仍短 | 菜单、抽屉     |

深色卡和栏用 hairline。输入卡和菜单填充 100%，避免底下的文字改变其颜色。

## Shapes

| Token            | Value  | Use                       |
| ---------------- | ------ | ------------------------- |
| `{rounded.xs}`   | 4px    | 小标签                    |
| `{rounded.sm}`   | 6px    | 折叠条、次要芯片          |
| `{rounded.md}`   | 8px    | 列表行                    |
| `{rounded.lg}`   | 12px   | 输入卡、New Session、气泡 |
| `{rounded.xl}`   | 16px   | 大容器                    |
| `{rounded.full}` | 9999px | 圆形图标钮、徽章          |

壳层圆角 0。发送是 28px primary 圆钮。

## Do's and Don'ts

- 浅色：侧栏软底，对话白底，分组与输入卡奶油色。
- 深色：对话 `#111214`、侧栏 `#17181a`、输入卡与分组 `#232427`、用户气泡 `#1f2022`、缝 `#2e3033`。
- `{colors.primary}` 用于动作和选中。
- 工作台 14px 系统字；标签可用等宽大写。
- composer / New Session：`{rounded.lg}`。
- 桌面与网页的输入卡、菜单均用实色。桌面折叠保留 rail。
- 装饰走 sunset / dusk / breeze。
