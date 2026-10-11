---
version: alpha
name: pig Workbench
description: A Pi Agent GUI with a near-white conversation shell in light mode, flush opaque sidebar and composer, and a near-black shell in dark mode. Action and focus indigo is separate from link indigo. Sidebar selection is neutral. Category colors are skill, steel, teal, and gray. Text colors sit behind a contrast layer the user can boost. Tokens live in two layers, so metrics are declared once and colors once.

colors:
  primary: "#5e6ad2"
  primary-active: "#4f5bc4"
  on-primary: "#ffffff"
  white: "#ffffff"
  canvas: "#f7f7f8"
  canvas-soft: "#f7f7f8"
  surface: "#ffffff"
  sidebar: "#fcfcfd"
  composer-bg: "#f4f4f5"
  user-prompt-bg: "#e8e8ea"
  popover: "#ffffff"
  ink: "#1b1b1b"
  ink-markdown: "#1b1b1b"
  ink-secondary: "#5c5c5c"
  ink-muted: "#6e6e6e"
  ink-faint: "#8a8a8a"
  link: "#4c56c8"
  border: "#dedede"
  border-subtle: "#e8e8e8"
  interaction-hover: "#e8e8eb"
  interaction-selected: "#e6e6e8"
  accent-skill: "#8160d8"
  accent-steel: "#5b7c9d"
  accent-teal: "#2f8f7b"
  accent-gray: "#8a8d94"
  accent-green: "#52a450"
  success: "#52a450"
  warning: "#d97706"
  danger: "#c94446"
  info: "#5e6ad2"
  success-bg: "#dcfce7"
  info-bg: "#eceef8"
  danger-bg: "#fee2e2"
  mermaid-bg: "#ffffff"
  mermaid-fill: "#eaeef2"
  mermaid-fg: "#1b1b1b"
  mermaid-line: "#d4d4d4"
  mermaid-accent: "#5e6ad2"
  inverse-bg: "#1b1b1b"
  inverse-bg-hover: "#262626"
  inverse-fg: "#ffffff"
  mascot-body: "#fde3b4"
  mascot-snout: "#fda88e"
  mascot-eye: "#012d47"

typography:
  heading-2:
    fontFamily: SystemUI
    fontSize: 26px
    fontWeight: 600
    lineHeight: 1.23
    letterSpacing: -0.4px
  title:
    fontFamily: SystemUI
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.4
  body-md:
    fontFamily: SystemUI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  body-sm:
    fontFamily: SystemUI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
  button:
    fontFamily: SystemUI
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.38
  caption:
    fontFamily: SystemUI
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.38
  eyebrow:
    fontFamily: SystemUI
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.33
  caption-mono:
    fontFamily: GeistMono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33

rounded:
  2xs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 8px
  xl: 16px
  popover: 12px
  code: 10.4px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 28px
  xxl: 32px
---

## Overview

pig 浅色壳层用近白，侧栏贴窗边，输入卡不透明。深色壳层近黑，侧栏略抬升。动作靛用于动作和焦点，链接使用更深的同一色相，侧栏选中使用中性灰。布局包含齐边侧栏与不透明的对话列，导航和窗口控件的对比度低于对话内容。

浅色壳层 `{colors.surface}`（#ffffff），侧栏 `{colors.sidebar}`，输入卡 `{colors.composer-bg}`（#f4f4f5）。深色壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#27272a`。结构色 `{colors.primary}`（#5e6ad2）用于动作和焦点。

深色是同一套分面的中性灰反相：壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#27272a`、用户气泡 `#262628`。次级井用 `#121214`。分类色用 skill / steel / teal / gray。

壳层走 `--surface`，侧栏 `--sidebar`，输入卡 `--composer-bg`。浏览器与桌面颜色一致。浅色是默认入口。

## Token 分层

token 写在 `apps/web/src/style/app.css`，分两层，改一处只改一处。

| 层                | 放什么                       | 说明                                  |
| ----------------- | ---------------------------- | ------------------------------------- |
| `:root` / `.dark` | 颜色真值、尺寸、动效、阴影   | 深色覆盖也写在这里                    |
| `@theme static`   | 字体、字号、字重、间距、圆角 | 只定义一次；`static` 保证变量始终输出 |
| `@theme inline`   | 组件真的写过的 Tailwind 类   | 全部同名指回，不引入新值              |

三点约定：

- 度量（字号、间距、圆角）只写在 `@theme static`，不在 `:root` 再写一遍。
- `@theme inline` 只登记源码里出现过的类，没写过的类不登记。
- 阴影留在 `:root`，因为深色要覆盖；写进 `@theme` 会被烤进工具类，深色覆盖失效。

### 派生写法

圆角从单一基数派生，改 `--radius` 即整档跟随：

| token                             | 算式                        |
| --------------------------------- | --------------------------- |
| `--radius`                        | 基数 8px                    |
| `--radius-2xs`                    | `calc(var(--radius) - 6px)` |
| `--radius-xs`                     | `calc(var(--radius) - 4px)` |
| `--radius-sm`                     | `calc(var(--radius) - 2px)` |
| `--radius-md` / `--radius-lg`     | `var(--radius)`             |
| `--radius-xl`                     | `calc(var(--radius) + 8px)` |
| `--radius-popover`                | `calc(var(--radius) + 4px)` |
| `--radius-code` / `--radius-full` | 独立，不在网格上            |

间距从 Tailwind 的基数派生，不维护第二套刻度：`--spacing-md` 等于 `calc(var(--spacing) * 4)`。

字号里与 Tailwind 重合的三档直接引用：`--text-title` 用 `--text-base`，`--text-body-md` 与 `--text-body-sm` 用 `--text-sm`，`--text-eyebrow` 与 `--text-caption-mono` 用 `--text-xs`。其余档位是自定义尺寸，写死。

## Color

### Surface

- **Surface**（`{colors.surface}` — #ffffff）：壳层（对话列）。
- **Sidebar**（`{colors.sidebar}` — #fcfcfd）：侧栏，贴窗边。
- **Border subtle**（`{colors.border-subtle}`）：内部分割线，比 border 淡一档。
- **Composer**（`{colors.composer-bg}` — #f4f4f5）：输入卡不透明填充。
- **Canvas**（`{colors.canvas}` — #f7f7f8）：次级井，也是页面底。
- **Border**（`{colors.border}`）：控件与对话列外沿，比 border-subtle 深一档。
- **User prompt**（`{colors.user-prompt-bg}` — #e8e8ea）：用户消息气泡。

深色下 `--border` 比 `--border-subtle` 亮，与浅色同向：外沿更显眼，内线更淡。

### Text

- **Ink**（`{colors.ink}` — #1b1b1b）：正文与主文字。
- **Ink markdown**（`{colors.ink-markdown}`）：对话区 markdown 正文，与 ink 同值，单独命名以便将来分开调。
- **Charcoal**（`{colors.ink-secondary}` — #5c5c5c）
- **Slate**（`{colors.ink-muted}` — #6e6e6e）
- **Ash**（`{colors.ink-faint}` — #8a8a8a）
- **Link**（`{colors.link}` — #4c56c8）：链接色相与动作靛同族，但更深。

### 文字对比度

文字色不直接消费真值，而是走一层派生，用户可以整体加对比度。

- `--contrast-boost`：0% 到 100%，默认 0。设置项「文字对比度」，存储键 `pig.contrast`。
- `--contrast-target`：浅色 `#000000`，深色 `#ffffff`。
- `--contrast-ink` 等四档：`color-mix(in oklab, 原值 calc(100% - var(--contrast-boost)), var(--contrast-target) var(--contrast-boost))`。

0% 时派生值等于原值，渲染完全不变。拉高后浅色文字变深、深色文字变浅，四档顺序保持。

组件一律用 `color: var(--contrast-ink*)` 取文字色。背景、边框、阴影继续用原值。Tailwind 的 `text-ink*` 类经 `@theme inline` 指向同一层。

首帧由 `index.html` 的引导脚本读 `pig.contrast` 写入 `--contrast-boost`，避免闪烁。

### Semantic

- Success → `{colors.success}`，井 `{colors.success-bg}`
- Warning / 运行 → `{colors.warning}`
- Info 井 `{colors.info-bg}`
- Danger → `{colors.danger}`，井 `{colors.danger-bg}`
- 分类色 `{colors.accent-skill}` / `{colors.accent-steel}` / `{colors.accent-teal}` / `{colors.accent-gray}`，不作结构填充

### Reference palette

颜色采用 Linear 近白/近黑表面与靛色交互分层。分割线按墨色透明度推导。

| 角色         | 浅色      | 深色      |
| ------------ | --------- | --------- |
| 壳层         | `#ffffff` | `#0f0f11` |
| 侧栏         | `#fcfcfd` | `#161618` |
| 选中行       | `#e6e6e8` | `#2c2c31` |
| 输入卡       | `#f4f4f5` | `#27272a` |
| 菜单         | `#ffffff` | `#1c1c1f` |
| 用户气泡     | `#e8e8ea` | `#262628` |
| 链接         | `#4c56c8` | `#9aa3ea` |
| 行内代码     | `#e8e8ea` | `#262628` |
| 行内代码文字 | `#1b1b1b` | `#e3e4e6` |
| primary      | `#5e6ad2` | `#606acc` |

动作靛以 `#5e6ad2` 为准。分类色不进品牌。

### Dark

同一套分面的中性灰反相，写在 `app.css` `.dark`。`.dark` 只挂在 `html` 上，和 `:root` 是同一个元素，所以派生色自动跟随，不必在 `.dark` 里重复。

| 角色     | 值        |
| -------- | --------- |
| 壳层     | `#0f0f11` |
| 侧栏     | `#161618` |
| 输入卡   | `#27272a` |
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
| `{typography.heading-2}`    | 26px | 600    | 1.23        | 欢迎页 / 空 Session 短句 |
| `{typography.title}`        | 16px | 400    | 1.4         | 栏标题                   |
| `{typography.body-md}`      | 14px | 400    | 1.43        | 工作台正文               |
| `{typography.body-sm}`      | 14px | 400    | 1.43        | 侧栏、导航、对话元数据   |
| `{typography.button}`       | 13px | 500    | 1.38        | 按钮                     |
| `{typography.caption}`      | 13px | 400    | 1.38        | 辅助说明                 |
| `{typography.eyebrow}`      | 12px | 600    | 1.33        | 徽章、小标签             |
| `{typography.caption-mono}` | 12px | 400    | 1.33        | 阶段 / 栏目标签          |

字号档只改界面与消息文字。设置项「字体大小」的 s / m / l / xl 四档在运行时改 `--text-*`，所以字号变量必须保持可覆盖，不能把像素值写死进工具类。

## Layout

### Spacing

8px 基准，从 Tailwind 的 `--spacing` 基数派生。侧栏内边距 12/6；列表行 28–32px；输入卡与 Transcript 正文跟随内容宽度手柄（正文 680–920px，默认 732px）。

### Shell

两栏铺满视口。桌面折叠保留 rail（56px，macOS 桌面 90px）。<900px 左栏为抽屉。

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

深色卡和栏用 `{colors.border}`。侧栏贴窗边，与对话列只留外沿细线。输入卡填充 100%，避免底下的文字改变其颜色；悬浮输入条下方的留白条带同样补底色。菜单、对话框与提示气泡共用同一份不透明底（`--composer-bg`），全站不用背景模糊。

阴影有 8 档：`--shadow-soft`、`--shadow-elevated`、`--shadow-card`、`--shadow-float`、`--shadow-popover`、`--shadow-modal`、`--shadow-drawer`、`--shadow-logo`。深色整份重写。

## Shapes

| Token               | Value   | Use                |
| ------------------- | ------- | ------------------ |
| `{rounded.2xs}`     | 2px     | 极小控件           |
| `{rounded.xs}`      | 4px     | 小标签             |
| `{rounded.sm}`      | 6px     | 折叠条、次要芯片   |
| `{rounded.md}`      | 8px     | 列表行             |
| `{rounded.lg}`      | 8px     | 菜单、气泡、主按钮 |
| `{rounded.code}`    | 0.65rem | 代码块             |
| `{rounded.popover}` | 12px    | 浮层、工具卡       |
| `{rounded.xl}`      | 16px    | 大容器             |
| `--composer-radius` | 32px    | 输入卡胶囊         |
| `{rounded.full}`    | 9999px  | 圆形图标钮         |

壳层圆角 0。发送是 28px primary 圆钮；运行中无文本时同一圆钮换成墨色实心圆 + 11px 圆角方块（停止）；输入卡为胶囊形，动作行贴胶囊底边。

## Do's and Don'ts

- 浅色：壳层 `{colors.surface}`，侧栏与输入卡白底，侧栏贴窗边。
- 深色：壳层 `#0f0f11`、侧栏 `#161618`、输入卡 `#27272a`、用户气泡 `#262628`。
- `{colors.primary}` 用于动作和焦点。选中走中性灰。
- 工作台 14px 系统字；标签可用等宽大写。
- 控件圆角 `{rounded.lg}`。输入卡胶囊 `--composer-radius`（32px），发送仍是圆钮。
- 桌面与网页的输入卡均用实色。桌面折叠保留 rail。
- 分类走 skill / steel / teal / gray。
- 新增文字色一律走 `--contrast-*`，不要直接消费 `--ink*`；背景和边框继续用原值。
- 新增度量写进 `@theme static`，不要写回 `:root`。
