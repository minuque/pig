---
version: alpha
name: pig Workbench
description: A local-first agent workbench with cool bluish-neutral surfaces in light mode and near-black surfaces in dark mode. One blue is reserved for actions, links, focus, and selection. Sunset and dusk colors are decorative only. The layout uses a sidebar and an opaque transcript column. Navigation and window controls use lower contrast than transcript content.

colors:
  primary: "#4176e6"
  primary-active: "#2d5fc4"
  secondary: "#0e3074"
  on-primary: "#ffffff"
  canvas: "#ffffff"
  canvas-soft: "#f9fafb"
  surface: "#ffffff"
  ink: "#0f1115"
  ink-secondary: "#353638"
  ink-muted: "#5c5f66"
  ink-faint: "#8b8f97"
  hairline: "#e5e7eb"
  accent-sunset: "#ff7a17"
  accent-sunset-soft: "#ffc285"
  accent-dusk: "#7c3aed"
  accent-twilight: "#c4b5fd"
  accent-breeze: "#a0c3ec"
  accent-midnight: "#0d1726"
  accent-orange: "#dd5b00"
  accent-orange-deep: "#793400"
  accent-green: "#1aae39"

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
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.43
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
    description: "Featured surface — polarity-flipped fill."
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

本地桌面工作台使用冷蓝灰浅色表面和近黑深色表面。系统 UI 字号默认 14px。业务蓝只用于动作、链接、焦点和选中。布局包含侧栏与不透明的对话列，导航和窗口控件的对比度低于对话内容。

浅色侧栏 `{colors.canvas-soft}`，对话列 `{colors.surface}`。结构色 `{colors.primary}`（#4176e6）只用于发送、链接、选中、focus。控件圆角 `{rounded.lg}`（12px）。

深色是同一套分面的近灰反相：对话 `#151517`、侧栏 `#1b1b1c`、缝 `#2c2c2e`。装饰用 sunset / dusk / twilight / breeze。阶段与栏目标签可用 `{typography.caption-mono}`。

常驻工作台只把原生材质给侧栏（macOS vibrancy / Windows acrylic），启动等待态可短暂全屏透出原生材质。对话列不透明。输入卡在桌面用不透底的 canvas-soft/surface 混合（亚克力窗上 CSS backdrop-filter 会透到系统材质）。浏览器无桌面标记时，侧栏也不透明。浅色是默认入口。

## Colors

### Brand & Accent

- **Business Blue** (`{colors.primary}` — #4176e6)：发送、链接、选中、focus。深色同样用这一档，提亮为 `#679efe`。
- **Pressed Blue** (`{colors.primary-active}` — #2d5fc4)：主按钮按下。
- **Deep Navy** (`{colors.secondary}` — #0e3074)：反相带。

装饰（状态点、插图、次要标记）：

- `{colors.accent-sunset}` / `{colors.accent-sunset-soft}`
- `{colors.accent-dusk}` / `{colors.accent-twilight}`
- `{colors.accent-breeze}` / `{colors.accent-midnight}`

`{colors.accent-midnight}` 只作插图井。

### Surface

- **White** (`{colors.canvas}` / `{colors.surface}` — #ffffff)：对话列、卡片、输入。
- **Cool Mist** (`{colors.canvas-soft}` — #f9fafb)：侧栏、页底、次级井。
- **Hairline** (`{colors.hairline}` — #e5e7eb)：栏缝与控件边。

### Text

- **Ink** (`{colors.ink}` — #0f1115)
- **Charcoal** (`{colors.ink-secondary}` — #353638)
- **Slate** (`{colors.ink-muted}` — #5c5f66)
- **Ash** (`{colors.ink-faint}` — #8b8f97)

### Semantic

- Success → `{colors.accent-green}`
- Warning / 运行 → `{colors.accent-orange}`（强调 `{colors.accent-orange-deep}`）
- Danger → `app.css` 独立红

sunset 是装饰，orange 是语义。

### Dark

同一套分面的近灰反相，写在 `app.css` `.dark`。

| 角色    | 值        |
| ------- | --------- |
| 对话底  | `#151517` |
| 侧栏    | `#1b1b1c` |
| 主字    | `#ebeef2` |
| 缝      | `#2c2c2e` |
| primary | `#679efe` |

## Typography

### Font Family

**`SystemUI`**：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif`。

代码与 `{typography.caption-mono}`：Geist Mono / SF Mono / JetBrains Mono / Consolas。

`{typography.caption-mono}` 用于阶段、栏目标签，大写 + 正 tracking。

### Hierarchy

| Token                       | Size | Weight | Line Height | Use                    |
| --------------------------- | ---- | ------ | ----------- | ---------------------- |
| `{typography.display-1}`    | 64px | 700    | 1.0         | 展示标题               |
| `{typography.display-2}`    | 54px | 700    | 1.04        | 展示标题               |
| `{typography.heading-1}`    | 40px | 700    | 1.1         | 大节标题               |
| `{typography.heading-2}`    | 26px | 600    | 1.23        | 欢迎页标题             |
| `{typography.heading-3}`    | 22px | 600    | 1.27        | 卡片标题               |
| `{typography.title}`        | 16px | 600    | 1.4         | 栏标题                 |
| `{typography.body-md}`      | 14px | 400    | 1.43        | 工作台正文             |
| `{typography.body-sm}`      | 14px | 400    | 1.43        | 侧栏、导航、对话元数据 |
| `{typography.button}`       | 14px | 500    | 1.43        | 按钮                   |
| `{typography.caption}`      | 13px | 400    | 1.38        | 辅助说明               |
| `{typography.eyebrow}`      | 12px | 600    | 1.33        | 徽章、小标签           |
| `{typography.caption-mono}` | 12px | 400    | 1.33        | 阶段 / 栏目标签        |

headline 只在欢迎页。栏标题 600，按钮 500。

## Layout

### Spacing

8px 基准。侧栏内边距 12/6；列表行 28–32px；对话列与输入卡默认 748px，≥1400px 占主栏 60%。

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
| 1 — Soft | 一层轻阴影 | chatInput 卡   |
| 2 — Pop  | 稍深，仍短 | 菜单、抽屉     |

深色卡和栏用 hairline。桌面侧栏深度来自原生材质。

## Shapes

| Token            | Value  | Use                         |
| ---------------- | ------ | --------------------------- |
| `{rounded.xs}`   | 4px    | 小标签                      |
| `{rounded.sm}`   | 6px    | 折叠条、次要芯片            |
| `{rounded.md}`   | 8px    | 列表行                      |
| `{rounded.lg}`   | 12px   | composer、New Session、气泡 |
| `{rounded.xl}`   | 16px   | 大容器                      |
| `{rounded.full}` | 9999px | 圆形图标钮、徽章            |

壳层圆角 0。发送是 28px primary 圆钮。

## Do's and Don'ts

- 浅色：侧栏软底，对话白底。
- 深色：`#151517` / `#1b1b1c` / 缝 `#2c2c2e`。
- `{colors.primary}` 用于动作和选中。
- 工作台 14px 系统字；标签可用等宽大写。
- chatInput / New Session：`{rounded.lg}`。
- 常驻工作台的原生材质只进侧栏；启动等待态可短暂全屏透出。桌面折叠保留 rail。
- 装饰走 sunset / dusk / breeze。
