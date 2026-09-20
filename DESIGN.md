---
version: alpha
name: pig Workbench
description: A Pi Agent GUI with a near-white conversation shell in light mode, flush opaque sidebar and composer, and a near-black shell in dark mode. Action and focus indigo is separate from link indigo. Sidebar selection is neutral. Category colors are skill, steel, teal, and gray. The layout uses a flush sidebar and an opaque transcript column. Navigation and window controls use lower contrast than transcript content.

colors:
  primary: "#5e6ad2"
  primary-active: "#4f5bc4"
  secondary: "#4c56c8"
  on-primary: "#ffffff"
  canvas: "#f7f7f8"
  canvas-soft: "#f7f7f8"
  surface: "#fcfcfd"
  sidebar: "#ffffff"
  border: "#dedede"
  border-subtle: "#e8e8e8"
  composer-bg: "#ffffff"
  ink: "#1b1b1b"
  ink-secondary: "#5c5c5c"
  ink-muted: "#6e6e6e"
  ink-faint: "#8a8a8a"
  accent-skill: "#8160d8"
  accent-steel: "#5b7c9d"
  accent-teal: "#2f8f7b"
  accent-gray: "#8a8d94"
  accent-orange: "#854d0e"
  accent-orange-deep: "#854d0e"
  accent-green: "#166534"
  danger-bg: "#fee2e2"
  success-bg: "#dcfce7"
  warning-bg: "#fef9c3"
  info-bg: "#eceef8"

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
  lg: 8px
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
    description: "Streaming / warning mark. Semantic warning."
    textColor: "{colors.accent-orange}"
  status-ok:
    description: "Success mark."
    textColor: "{colors.accent-green}"
  status-warn-deep:
    description: "Active-session / emphasis warning text."
    textColor: "{colors.accent-orange-deep}"
  mark-skill:
    description: "Category chip. Memory."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-skill}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-steel:
    description: "Category chip. Skills."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-steel}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-teal:
    description: "Category chip. Tools."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-teal}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  mark-gray:
    description: "Category chip. Other."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-gray}"
    rounded: "{rounded.xs}"
    padding: 2px 6px
  illustration-well:
    description: "Illustration well on ink."
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"

  ex-pricing-tier:
    description: "Quiet card on the conversation surface."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    borderColor: "{colors.border}"
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
    item-divider: "{colors.border}"
  ex-app-shell-row:
    description: "Sidebar row. Selection is neutral."
    backgroundColor: "{colors.canvas-soft}"
    activeIndicator: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.xs} {spacing.sm}"
  ex-data-table-cell:
    description: "Dense table chrome."
    headerBackground: "{colors.canvas-soft}"
    headerTypography: "{typography.eyebrow}"
    bodyTypography: "{typography.body-sm}"
    cellPadding: "{spacing.xs} {spacing.sm}"
    rowBorder: "{colors.border}"
  ex-auth-form-card:
    description: "Form card."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  ex-modal-card:
    description: "Modal surface with border."
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

Pi Agent GUI 浅色壳层用近白，侧栏贴窗边，输入卡不透明白。深色壳层近黑，侧栏略抬升。系统 UI 字号默认 14px。动作靛用于动作和焦点，链接使用更深的同一色相，侧栏选中使用中性灰。布局包含齐边侧栏与不透明的对话列，导航和窗口控件的对比度低于对话内容。

浅色壳层 `{colors.surface}`（#fcfcfd），侧栏 `{colors.sidebar}`，输入卡 `{colors.composer-bg}`。深色壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#1c1c1f`。结构色 `{colors.primary}`（#5e6ad2）用于动作和焦点。控件圆角 `{rounded.lg}`（8px）。

深色是同一套分面的中性灰反相：壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#1c1c1f`、用户气泡 `#262628`。次级井用 `#121214`。分类色用 skill / steel / teal / gray。阶段与栏目标签可用 `{typography.caption-mono}`。

窗体、侧栏、输入卡和菜单均不透明。壳层走 `--surface`，侧栏 `--sidebar`，输入卡 `--composer-bg`。输入卡和菜单使用不透明填充，浏览器与桌面颜色一致。浅色是默认入口。

## Colors

### Brand & Accent

- **Action Indigo** (`{colors.primary}` — #5e6ad2)：动作、焦点。深色保持 `#606acc`，主按钮字色为白。链接走 `--link`（#4c56c8 / `#9aa3ea`），侧栏选中背景走 `--interaction-selected`。
- **Pressed Indigo** (`{colors.primary-active}` — #4f5bc4)：主按钮按下。深色 `#555fbf`。
- **Link Indigo** (`{colors.secondary}` — #4c56c8)：链接用更深的同一色相。深色 `#9aa3ea`。

分类（用量环、次要标记）：

- `{colors.accent-skill}` / `{colors.accent-steel}`
- `{colors.accent-teal}` / `{colors.accent-gray}`

### Surface

- **Surface** (`{colors.surface}` — #fcfcfd)：壳层（对话列）。
- **Sidebar** (`{colors.sidebar}` — #ffffff)：侧栏，贴窗边。
- **Border subtle** (`{colors.border-subtle}`)：墨 8%，内部分割线。
- **Composer** (`{colors.composer-bg}` — #ffffff)：输入卡。
- **Canvas** (`{colors.canvas}` — #f7f7f8)：次级井。
- **Secondary well** (`{colors.canvas-soft}` — #f7f7f8)：页面底。
- **Border** (`{colors.border}`)：墨 12%，控件与对话列外沿，比 border-subtle 深一档。

### Text

- **Ink** (`{colors.ink}` — #1b1b1b)
- **Charcoal** (`{colors.ink-secondary}` — #5c5c5c)
- **Slate** (`{colors.ink-muted}` — #6e6e6e)
- **Ash** (`{colors.ink-faint}` — #8a8a8a)

### Semantic

- Success → `{colors.accent-green}`，井 `{colors.success-bg}`
- Warning / 运行 → `{colors.accent-orange}`（强调 `{colors.accent-orange-deep}`），井 `{colors.warning-bg}`
- Info 井 `{colors.info-bg}`
- Danger → `app.css` 独立红，井 `{colors.danger-bg}`

orange 保留兼容命名，映射到黄色警告色。

### Reference palette

颜色采用 Linear 近白/近黑表面与靛色交互分层。分割线按墨色透明度推导。辅助文字和状态色按可读性加深。

| 角色         | 浅色      | 深色      |
| ------------ | --------- | --------- |
| 壳层         | `#fcfcfd` | `#0f0f11` |
| 侧栏         | `#ffffff` | `#161618` |
| 选中行       | `#e6e6e8` | `#2c2c31` |
| 输入卡       | `#ffffff` | `#1c1c1f` |
| 菜单         | `#ffffff` | `#1c1c1f` |
| 用户气泡     | `#e8e8ea` | `#262628` |
| 链接         | `#4c56c8` | `#9aa3ea` |
| 行内代码     | `#e8e8ea` | `#262628` |
| 行内代码文字 | `#1b1b1b` | `#e3e4e6` |
| primary      | `#5e6ad2` | `#606acc` |

动作靛以 `#5e6ad2` 为准。分类色不进品牌。

### Dark

同一套分面的中性灰反相，写在 `app.css` `.dark`。

| 角色     | 值        |
| -------- | --------- |
| 壳层     | `#0f0f11` |
| 侧栏     | `#161618` |
| 输入卡   | `#1c1c1f` |
| 用户气泡 | `#262628` |
| 主字     | `#e3e4e6` |
| 次级字   | `#b8b9bc` |
| 弱字     | `#9a9b9e` |
| 淡字     | `#7e7f83` |
| primary  | `#606acc` |
| 主按钮字 | `#ffffff` |

## Typography

### Font Family

**`SystemUI`**：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`。

代码与 `{typography.caption-mono}`：ui-monospace / SF Mono / Menlo / Consolas。

`{typography.caption-mono}` 用于阶段、栏目标签，大写 + 正 tracking。

对话 Markdown 正文字号 `{typography.body-md}`，行高 `1.8`（`--ms-leading-body`）。行内代码底 `--inline-code`，边 `--border`。

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

| Level    | Treatment              | Use                                                   |
| -------- | ---------------------- | ----------------------------------------------------- |
| 0 — Flat | border / border-subtle | 列表、对话列外沿用 border；内部分割线用 border-subtle |
| 1 — Soft | 细线，不用阴影分层     | 输入卡                                                |
| 2 — Pop  | 稍深，仍短             | 菜单、抽屉                                            |

深色卡和栏用 `{colors.border}`。侧栏贴窗边，与对话列只留外沿细线。输入卡和菜单填充 100%，避免底下的文字改变其颜色。

## Shapes

| Token            | Value  | Use                |
| ---------------- | ------ | ------------------ |
| `{rounded.xs}`   | 4px    | 小标签             |
| `{rounded.sm}`   | 6px    | 折叠条、次要芯片   |
| `{rounded.md}`   | 8px    | 列表行             |
| `{rounded.lg}`   | 8px    | 菜单、气泡、主按钮 |
| `{rounded.xl}`   | 16px   | 大容器             |
| `{rounded.full}` | 9999px | 圆形图标钮、徽章   |

壳层圆角 0。发送是 28px primary 圆钮。

## Do's and Don'ts

- 浅色：壳层 `{colors.surface}`，侧栏与输入卡白底，侧栏贴窗边。
- 深色：壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#1c1c1f`、用户气泡 `#262628`。
- `{colors.primary}` 用于动作和焦点。选中走中性灰。
- 工作台 14px 系统字；标签可用等宽大写。
- 控件圆角 `{rounded.lg}`。输入卡用胶囊。
- 桌面与网页的输入卡、菜单均用实色。桌面折叠保留 rail。
- 分类走 skill / steel / teal / gray。
