---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  primary: "#3e63dd"
  primary-deep: "#3358d4"
  primary-wash: "#edf2fe"
  on-accent: "#ffffff"
  window-fog: "#f7f7f8"
  card-paper: "#ffffff"
  composer-well: "#f4f4f5"
  prompt-bubble: "#e8e8ea"
  code-well: "#f6f6f6"
  hover-wash: "#e8e8eb"
  selected-wash: "#e6e6e8"
  ink: "#1b1b1b"
  ink-secondary: "#5c5c5c"
  ink-muted: "#6e6e6e"
  ink-faint: "#767676"
  border: "rgba(0, 0, 47, 0.15)"
  border-soft: "rgba(0, 9, 50, 0.12)"
  inverse-ink: "#1b1b1b"
  success-fern: "#15803d"
  warning-amber: "#a16207"
  danger-red: "#dc2626"
  star-amber: "#fbbf24"
  working-blue: "#7cb3ff"
  category-violet: "#8160d8"
  category-steel: "#5b7c9d"
  category-teal: "#2f8f7b"
  category-gray: "#8a8d94"
  mascot-body: "#fde3b4"
  mascot-snout: "#fda88e"
  mascot-eye: "#012d47"
typography:
  heading:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.23
    letterSpacing: "-0.4px"
  title:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
  body-lg:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.38
  eyebrow:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  code:
    fontFamily: "anthropic-mono, ui-monospace, SF Mono, Menlo, Consolas, PingFang SC, Microsoft YaHei, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24.5px"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  card: "12px"
  popover: "12px"
  code: "0.65rem"
  composer: "32px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  xxl: "32px"
components:
  button-solid:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    height: "32px"
    padding: "0 12px"
  button-solid-hover:
    backgroundColor: "{colors.primary-deep}"
    rounded: "{rounded.xs}"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    height: "32px"
    padding: "0 12px"
  icon-button:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    size: "28px"
  badge-soft:
    backgroundColor: "{colors.primary-wash}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.eyebrow}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  text-field:
    backgroundColor: "{colors.card-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    height: "32px"
    padding: "0 8px"
  code-block:
    backgroundColor: "{colors.code-well}"
    textColor: "{colors.ink}"
    typography: "{typography.code}"
    rounded: "{rounded.code}"
    padding: "12px 16px"
  workbench-card:
    backgroundColor: "{colors.card-paper}"
    rounded: "{rounded.card}"
    height: "100%"
  composer-card:
    backgroundColor: "{colors.card-paper}"
    rounded: "{rounded.composer}"
  sidebar-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "28px"
    padding: "0 8px"
  sidebar-row-selected:
    backgroundColor: "{colors.selected-wash}"
    rounded: "{rounded.sm}"
  prompt-bubble:
    backgroundColor: "{colors.prompt-bubble}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: pig 工作台

## Overview

**Creative North Star: "桌面上的工作台"**

窗口底是桌面，主区是一张摆在桌面上的实底卡片，浮层是贴在卡片上方的玻璃片。三者的关系只用亮度与 1px 描边表达：桌面 `#f7f7f8`，工作台面 `#ffffff`，深色下反向为 `#121214` 与 `#18181b`。没有第二套装饰语言，没有渐变背景，也没有为了"高级感"加的阴影堆叠。

气质是柔和、低对比、亲和。柔和来自小步长的表面差与克制的圆角（卡片 12px、浮层 12px、输入卡 32px 连续曲率），低对比指结构面之间只差一档亮度，而不是把文字对比度压到看不清：正文仍有四档中性墨，基线固定按 20% 向对比目标推一档。亲和落在两处：一是 Always 可见的猪猪吉祥物与探头动画，二是完成提示音这类轻量反馈。

密度按工具来定，不按阅读来定。侧栏行 28px、图标 14px、控件 40px、间距基数 4px：同一屏里能放下多组会话与一条长对话，而不会显得拥挤。强调色默认 `#3e63dd`，只占很小面积，并且可以整体换成另外 5 套色相；界面结构在任何一套强调色下都保持中性。

**Key Characteristics:**

- 单一实底卡片承载工作区，四周 8px 留白，1px radix 灰阶描边（`--border`），12px 圆角。卡底与描边都由 rt Card 的伪元素画（`::before` 底、`::after` 1px 环，圆角是画出来的曲线）；环抬到 `z-index: 4`，否则会被卡片内 `z-index: 2/3` 的头部与浮层盖掉上下两边。rt 原生 surface 环取 gray-a5，在 `rt.css` 里改指 `--border`，让同页卡片一个色。
- 表面之间只差一档亮度；层级用位置、描边与遮罩，不用阴影。
- 浮层统一磨砂玻璃：`#ffffff` 80% 不透明度 + `blur(16px)` + `saturate(1.14)`。
- 中性结构 + 稀用强调色 + 独立语义色，三者互不越界。
- 4px 基数派生全部间距与圆角，任何一处改档位整片跟随。

## Colors

中性骨架上挂一层稀用强调色和一套状态色；色相克制，深浅两套各自成套。

### Primary

- **指示灯靛蓝** (#3e63dd, Radix indigo-9)：`--primary`。用在 rt 实心按钮底、选中态强调、链接底座与焦点环内侧。它从不铺大面积，也不作卡片或行的背景。
- **指示灯靛蓝·深** (#3358d4, indigo-10)：`--primary-active`。悬停与按下时的同色相下压一档。
- **指示灯靛蓝·洗** (#edf2fe, indigo-3 / `--accent-a3`)：`--info-bg`、soft 徽章底、拖放引导的浅底。
- **反白** (#ffffff)：`--primary-foreground`，落在 `#3e63dd` 上的文字与图标。

强调色可切 8 套：indigo（默认）、blue、sky、cyan、teal、green、orange、red。切色只改 `html` 上的 `data-accent-color` 与配套的 `data-gray-color`，组件一律读 `--accent-*` 语义别名，没有为某套色写死的地方。

### Neutral

- **窗口雾** (#f7f7f8)：`--background`，也是 `--window-surface`。窗口底与侧栏底，深色下变成 `#121214`。
- **卡片纸白** (#ffffff)：`--card`、`--workbench-surface`、`--popover`、`--toolbar-background`。工作台卡片与主区工具栏，深色下 `--workbench-surface` 变为 `#18181b`（比窗口底浅一档，这是深色下唯一的"抬起"手段）。
- **输入卡槽** (#f4f4f5)：`--composer-background`。拖放引导标签与输入卡的浅底，深色下 `#27272a`。
- **用户气泡灰** (#e8e8ea)：`--user-prompt-background`，右对齐的用户消息底，深色下 `#262628`。
- **代码槽** (#f6f6f6)：`--code-background`，行内码、代码块头、图表底，深色下 `#1a1a1c`。
- **悬停洗涤** (#e8e8eb) 与 **选中洗涤** (#e6e6e8)：`--interaction-hover` 与 `--sidebar-selected`。列表行与图标按钮的两种态，深色下 `#26262b` 与 `#2c2c31`。
- **墨** (#1b1b1b)：`--foreground`，正文与标题，深色下 `#e3e4e6`。
- **次墨** (#5c5c5c) / **弱墨** (#6e6e6e) / **淡墨** (#767676)：`--foreground-secondary`、`--foreground-muted`、`--foreground-faint`，组成四档文字层级；占位文字由淡墨 62% 混出，是第五档，只给 placeholder。
- **描边** 与 **弱描边**：只有 `--border` 与 `--border-soft` 两个，直接取 radix 的 alpha 灰阶（浅色 gray-a6 `rgba(0,0,47,.15)`、gray-a5 `rgba(0,9,50,.12)`，深色随色板自动切）。卡片、对话框、面板与表格用前者；分隔线、井槽、输入框与媒体描边用后者。不再维护独立色值，也不写深色覆盖。
- **反色墨** (#1b1b1b)：`--inverse-background`，反色主按钮的底；深色下换成 `#fafafa`。

### Tertiary

状态与分类色只表意，不作结构填充。

- **成功蕨绿** (#15803d / 深色 #34d399)：`--success`，完成态图标与文字。
- **警告琥珀** (#a16207 / #facc15)：`--warning`。
- **危险红** (#dc2626 / #f87171)：`--danger`，删除、错误与 denied 步骤。
- **星标琥珀** (#fbbf24 / #f5b44a)：`--star`，会话置顶标记。
- **运行蓝** (#7cb3ff)：`--state-working`，会话运行中状态点。
- **分类紫** (#8160d8) / **钢蓝** (#5b7c9d) / **静绿** (#2f8f7b) / **中性灰** (#8a8d94)：`--accent-skill`、`--accent-steel`、`--accent-teal`、`--accent-gray`，用于 skill 与来源标签的图标区分，深色下各提亮一档。
- **吉祥物三色** (#fde3b4 身、#fda88e 鼻、#012d47 眼)：`--mascot-*`，猪猪取 logo 原色，深浅两套主题共用，不参与主题映射。

**The Rare Accent Rule.** 强调色只允许出现在实心按钮、选中态高亮、焦点环、链接、运行中状态点这五处。任何卡片底、行底、区块背景都不许用强调色；面积缩到最小，它的指示作用才成立。

**The One-Step Surface Rule.** 任意两个相邻结构面之间只差一档亮度（浅色 `#f7f7f8` → `#ffffff`，深色 `#121214` → `#18181b`），跨过两档就等于造了第三个平台。层级交给位置、描边和遮罩，不交给颜色。

## Typography

**Display Font:** anthropic-sans（可变字重 300–800，随包 woff2，回退 -apple-system / Segoe UI / PingFang SC / Microsoft YaHei）
**Body Font:** 同 anthropic-sans
**Label/Mono Font:** anthropic-mono（回退 ui-monospace / SF Mono / Menlo / Consolas）

**Character:** 一套随包的可变无衬线承担全部界面与正文，等宽字体只出现在代码、路径、token 数与快捷键。中文落到 PingFang SC 与微软雅黑，行高按中文可读性定在 1.43–1.6，比英文站常见的 1.4 略松。

### Hierarchy

- **Heading** (600, 26px / 1.23 / letter-spacing -0.4px)：首屏空态标题与设置里的分节标题。全项目只有这一处 26px，其它地方不出现展示级字号。
- **Title** (500, 16px / 1.4)：会话标题、弹层标题、首屏问候语。
- **Body Large** (400, 16px / 1.5)：消息正文的大号档，随字号设置变化。
- **Body** (400, 14px / 1.43)：默认正文与列表行。转录区行高另设 1.6（`--ms-leading-body`），保证长段落可读。
- **Caption** (400, 13px / 1.38)：按钮文字、次要说明、时间戳。
- **Meta** (400, 13px / 1.43)：比 Body 小一档的辅助信息，如 token 数、耗时、模型名。
- **Eyebrow** (500, 12px / 1.33)：分组标题（今天 / 近 7 天）、标签前缀，不加大写转换，中文没有大小写。
- **Code** (400, 13px / 24.5px mono)：代码块、行内码、文件路径、diff。
- **Heading breathing room**：Markdown 内标题字号收得很窄，h1=h2=正文 +4px、h3=+2px、h4–h6 回到正文，避免长回答里标题喧宾夺主。

字号有三档（小 / 中 / 大），通过 `html[data-font-size]` 覆盖 `--text-*`：小档正文 12px、代码 12px；大档正文 16px、按钮 15px、代码 15px。26px 标题与 16px 标题不随档变化。

**The Four-Ink Rule.** 文字只有四档中性墨（#1b1b1b / #5c5c5c / #6e6e6e / #767676），加一档 62% 透明占位。第五种"更淡的灰"不存在：需要更弱就用档位和字号，不要混新灰。

**The Boost Rule.** 所有可读文字都走 `--contrast-foreground*` 派生层，设置里的对比度提升按权重把四档墨推向纯黑或纯白。新文字必须挂派生变量，不许直接读 `--foreground`，否则设置失效。

## Layout

布局是一维水平双栏加一张主卡片，不引入栅格系统。

**窗口结构。** 窗口底（`--window-surface`）铺满；左侧栏默认 280px（`--left-width` 初始值，`@property` 注册后宽度可动画），可拖 8px 把手调宽，双击复位，聚焦后 `←` / `→` 每次 16px；主区四周留 8px（`--workbench-inset` = `--space-xs`），里面就是 12px 圆角的工作台卡片。侧栏折叠用宽度过渡 200ms（`--duration-normal` + `--ease-smooth`）到 0 并 `visibility: hidden`，不用 `display: none`，保留过渡空间；`Ctrl/Cmd+B` 切换。

**窄屏。** 断点 900px。以下侧栏变成抽屉：`position: fixed`、宽 `min(88vw, 360px)`、`translateX(-105%)` 进出、`--shadow-drawer` 抬起、底色改为实底 `--background`（半透明窗口下也要可读）；工作台卡片去掉描边与圆角铺满，视口高度用 `100dvh`。

**密度。** 间距基数 4px（`--spacing`），刻度 `--space-xxs/xs/sm/md/lg/xl/xxl` = 4/8/12/16/24/28/32px。控件高 40px（`--size-control`），图标按钮 28px（`--size-icon-button`），侧栏行与工具栏行 28px（`--size-nav-rail`），图标 14px 配 13px 正文，描边线宽 1.75px（保证 14px 下仍足 1px）。触屏（`pointer: coarse`）把菜单行抬到 44px。

**窗口铬。** 头部高只有一个来源：`--header-height`（44px，即 28px 图标按钮加上下各 8px）。macOS 的浮层标题条 `--titlebar-inset` 同取 44px，红绿灯在 44px 条带里居中；Windows 与 Linux 取 0，Windows 的系统窗控 overlay 也取 44px，与头部同一行。侧栏顶距、拖拽带、卡片头、banner 顶距四处都读这两个值，不再各写一套平台公式。

Windows 自画三个窗控（总宽 138px，单钮高 44px，头部右侧让出 146px）。macOS 保留原生红绿灯，品牌行与头部左侧让出 68px（`--size-mac-traffic-lights`）加 8px 间隙。Linux 保留原生边框，页面内不留标题条、不画窗控。Windows 用 acrylic 材质，macOS 用 `under-window`，页面只负责留出透明区域。

**最大化。** Windows 与 Linux 最大化时 `main` 去掉内缩、卡片去掉描边与圆角，内容贴边；左侧 8px 栅栏留给侧栏拖拽把手。macOS 的缩放窗保持内缩。

**正文列。** 对话正文列宽默认 680px（`--chat-user-width`），由右侧宽度手柄独立调节，与侧栏宽度解绑；首次绘制前用 7rem 占位，避免输入条跳位。

**弹层。** 设置对话框 80rem × 52rem（最小高度 34rem），左侧导航列 11rem（窄态 2.75rem），正文最大 64rem。侧栏抽屉宽 360px（`--size-drawer`）。

**The Decoupled Measure Rule.** 正文列宽只由它自己的手柄决定，永远不跟随侧栏宽度。拖动侧栏时正文不重排，主视口在拖拽期间冻结。

## Elevation & Depth

平铺加浮层玻璃。卡片、侧栏、工具栏都平铺：没有阴影，靠 1px 描边与一档亮度差区分。真正抬起来的只有浮层（菜单、气泡、对话框、抽屉）和输入卡。

浮层统一走 `.surface-float`：底色 `color-mix(in srgb, var(--glass-tint) 80%, transparent)`，加 `backdrop-filter: blur(16px) saturate(1.14)`（深色 `saturate(1.08)`），整体底子是 `--glass-tint`（浅色为纸白、深色为 `#1c1c1f` 略抬一层的卡片色）。退场时模糊随进度降到 0，进出各配 140ms / 100ms 的 `--ease-menu`。

输入卡是唯一的例外：浅色下有一道 `0 12px 28px -18px rgb(0 0 0 / 40%)` 的软阴影，让它浮在对话之上；深色下阴影换成 `inset 0 1px 0 rgb(255 255 255 / 3%)` 的内高光，靠材质而不是投影表达抬起。

### Shadow Vocabulary

- **popover** (`0 1px 2px rgba(0,0,0,0.02), 0 1px 1px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)`)：`--shadow-popover`，下拉菜单、气泡、悬浮工具条。
- **card** (`0 1px 2px rgb(0 0 0 / 0.05), 0 2px 8px rgb(0 0 0 / 0.04)`)：`--shadow-card`，工具步骤卡与 Markdown 卡片。
- **soft** (四层 0.01–0.04 透明度叠加，`0 4px 18px rgba(0,0,0,0.04)` 收尾)：`--shadow-soft`，需要轻微存在感的中层容器。
- **elevated** (四层位移叠加 + `0 0 0 0.5px rgba(0,0,0,0.08)` 细描)：`--shadow-elevated`，需要明确高于内容层的浮起件。
- **float** (`0 4px 16px rgba(0,0,0,0.2)`)：`--shadow-float`，小浮层与拖拽预览。
- **drawer** (`0 0 32px rgba(0,0,0,0.2)`)：`--shadow-drawer`，窄屏侧栏抽屉。
- **modal** (`0 16px 48px rgba(0,0,0,0.18)`)：`--shadow-modal`，对话框与设置。
- **logo** (`0 1px 2px rgba(15,17,21,0.06), 0 8px 20px rgba(15,17,21,0.08)`)：`--shadow-logo`，首屏 logo 与品牌徽标。

深色把这套值整体加深（modal 到 0.6），并把 `elevated` 的细描边反向成白色 0.07。

**The Flat-By-Default Rule.** 静止态的结构面没有阴影。阴影只属于浮层、输入卡和对话框；给卡片或侧栏加阴影就是把层级语言推翻。

## Shapes

圆角由一个基数派生：`--radius` 8px，推出 3/4/6/8/12/16px（`--radius-1` 到 `--radius-6`，`--radius-xs` 4px、`--radius-sm` 6px、`--radius-md` 8px）。卡片与浮层各加 4px，取 12px（`--radius-card`、`--radius-popover`）。代码块独立取 `0.65rem`（约 10.4px），胶囊一律 `9999px`（`--radius-pill`）。改 `--radius` 一处，整片跟随。

输入卡是唯一有专属形状的部件：32px 圆角（`--composer-radius`）配 `corner-shape: superellipse(1.5)`，比 `squircle` 关键字更克制一档，形成连续曲率的鹅卵石轮廓。同一套角部形状也给菜单浮层用，两者看起来属于同一个家族。

描边一律 1px（`--border-width`）。卡片、对话框、面板与表格用 `--border`（浅色 gray-a6 ≈ 15%，深色 ≈ 19%），分隔线、井槽、输入框与媒体描边用 `--border-soft`（浅色 ≈ 12%，深色 ≈ 14%）。不使用 2px 或更粗的边框来表达状态，状态交给颜色与图标。

**The One Radius Rule.** 半径只从派生刻度取，SFC 里不写裸 `px` 半径。ic 按钮、行、卡片、浮层各自对应一档，需要新档先补 `tokens.css`。

## Components

### Buttons

克制的方形小件：`rt-BaseButton` 提供骨架，包装组件只补 `data-*` 与尺寸映射。

- **Shape:** 跟随派生刻度，s 3px、m 4px、l 6px（`--radius-1/2/3`）。
- **Sizes:** `s` 24–28px、`m` 32px、`l` 40px（`RT_SIZE` 把 s/m/l 映射到 rt 的 1/2/3 档，第 4 档 48px 明确不用）。
- **Primary:** `solid` 变体，底 `--primary`（#3e63dd），字 `--primary-foreground`（#ffffff），内边距 `0 12px`（m 档）。
- **Hover / Focus:** `solid` 悬停压到 `--primary-active`（#3358d4）；焦点统一 `.ring-focus` / `--focus-ring` = `0 0 0 3px var(--accent-a4)`，危险态用 `--focus-ring-danger`；全局 `:focus-visible` 取消默认 outline，由这套环接管。
- **Disabled:** `--opacity-disabled` 0.55，光标 `default`。
- **Loading:** 内容 `visibility: hidden` 保留占位，`Spinner` 绝对居中，读屏名由隐藏副本补回。
- **Icon Button:** 28 × 28px（`--size-icon-button`），图标 14px 加 2px 内缩（`--icon-button-pad`），悬停 `--hover-quiet`（前景 5%）。
- **反色主按钮:** `--inverse-background`（浅色 #1b1b1b / 深色 #fafafa），悬停 `--inverse-background-hover`。用于需要比强调色更中性的主动作。

### Composer（签名组件）

整张输入卡是界面的签名件：一颗靠在对话底部的鹅卵石，浮在工作台面上。

- **Shape / Depth:** 32px 圆角 + `superellipse(1.5)`，1px 描边 `rgb(0 0 0 / 0.08)`（深色白 0.08），浅色软阴影、深色内高光。
- **Layout:** 紧凑态单行高 48px（控件 32 + 上下 8），左侧回形针，右侧模型 chip、思考强度、上下文环与圆形发送键；展开态切成两行，正文上、动作行下，正文内边距 14px / 16px / 8px。
- **Controls:** 32px 圆形（`--size-composer-control`），模型名后接 `·` 与思考强度文字（如 `Claude Fable 5 · Minimal`），发送键在可发送时填 `--primary`，不可发送时取浅洗底。
- **Attachments:** 附件缩略图 8px 间距排成一行，超限与不支持类型在卡内提示，不弹层。
- **Motion:** 停靠首屏 ↔ 会话用 420ms / 470ms（`--duration-dock-in/out`），高度折叠与展开 180ms `--ease-fold`。

### Sidebar Rows

- **Shape:** 行高 28px（`--size-nav-rail`），圆角 6px（`--radius-sm`），左右内边距 8px。
- **States:** 悬停 `--hover-quiet`（前景 5% 透明洗涤），选中 `--sidebar-selected`（#e6e6e8），运行中在标题前挂 `--state-working` 状态点，未读加粗，草稿用弱墨。
- **Groups:** 分组标题用 Eyebrow（12px、500）；项目组图标随展开状态在 `folder` 与 `folder-open` 之间切换，不再另挂折叠箭头，右侧只留列表操作（新建会话、筛选）；列表滚动到边缘时 24px 渐隐遮罩（`--edge-fade-band`，由 `scroll()` 时间线驱动），菜单类窄遮罩 12px。
- **Header:** 品牌行高 28px，图标按钮 28 × 28px，窗口拖拽区与红绿灯占位由桌面平台决定。

### Transcript

- **正文列:** 最大宽 680px（可调），居中；行高 1.6。
- **User Message:** 右对齐，底 `--user-prompt-background`（#e8e8ea），圆角 8px，内边距 8px × 12px，最宽 90%。
- **Tool Steps:** 每次工具调用一张卡：1px `--border` 描边、12px 圆角、`--shadow-card`、头行 28px 带图标与状态；读文件与编辑卡最多预览 8 行，超出的折叠成"展开"。
- **Diff / Tables:** 表格 1px `--border` 描边、表头 `--code-background` 底；diff 增行 `--success` 88% 混纸白，删行 `--danger` 88% 混纸白。
- **Inline / Block Code:** mono 13px / 24.5px，底色 `--code-background`，块圆角 `0.65rem`，带复制与行号按钮。
- **状态:** 思考、工具执行、等待之间用灰阶文字阶梯表达，不做彩色进度条；运行时长与 token 数用 Meta 档。
- **文件类型标:** 卡片头与工具行的文件胶囊用 `markstream-vue` 的 `getLanguageIcon()` 出彩色语言徽标（TS、JSON 等），这是 Solar 家族之外的**登记例外**：那套颜色本身就在传达语言信息，换成单色 Solar 图标会丢掉这一层。其余功能性图标仍一律走 Solar。

### Badges & Chips

- **Style:** `solid` / `soft` / `surface` / `outline` 四变体，尺寸同按钮三档。
- **Soft:** 语义色 15% 混入背景得到浅底（`--success-bg`、`--danger-bg`、`--info-bg`），文字用同色相的深一档；红底上的破坏色文字单独用 `--danger-on-tint`（浅色 #b91c1c）保证 4.5:1。
- **Shape:** 胶囊 9999px，内边距 2px × 8px，Eyebrow 字号。

### Dialogs, Menus & Popovers

- **Basis:** rt `Dialog` / `AlertDialog` / `DropdownMenu` / `ContextMenu` / `Tooltip` 包装，浮层内容必须包一层 `ThemeRoot`，否则飞出文档流后拿不到 rt 面板与阴影 token。
- **Surface:** `.surface-float` 玻璃底，12px 圆角，`--shadow-popover`（对话框用 `--shadow-modal`），遮罩 `--scrim`（浅色黑 40% / 深色 55%）。
- **Rows:** Dropdown 与 Context menu 默认 rt 的 m 档：28px 行 / 13px 字；内边距收到 s 档（4px 内容边距、8px 左右项边距），左右等宽。Context menu 用 soft 变体。
- **悬停与破坏性项:** soft 档悬停取 `--accent-a4` 淡底（跟随当前 accent）；破坏性项给 `data-accent-color="red"`，文字 red-11、悬停 red-a4，走 rt 原生色阶，不再用自定义 `data-variant` 自己上色。
- **选中项:** 用 `--accent-a3` 淡底标记，悬停升到 `--accent-a4`；不在左侧留白放勾，避免与项自带的前置图标叠成双标记。
- **Motion:** 进出 140ms / 100ms，`--ease-menu`；对话框进场 180ms。

### Segmented Control, Switch, Slider, Text Field

设置面板里的四个基础件都直接复用 rt 外观，只接间距与圆角刻度。`TextField` 沿用 rt 的描边与内阴影焦点，滑条的填充色由 `--effort-fill`（`--primary` 40% 混白）算在当前元素上，不在 `:root` 算死。

### Card, Kbd, Link, HoverCard, RadioCards, Select

这六个也是 rt 原样接入：props → `rt-*` 类名，尺寸统一对外只给 s/m/l（映射 rt 的 1/2/3）。两处需要知道的结构：

- `Select` 的尺寸由 Root 下发（`select-context`），触发器与内容都按它上 `rt-r-size-*`；内容必须包 `ThemeRoot`，否则 `--radix-select-*` 那组变量拿不到。
- `RadioCards` 的列宽与间距落成内联属性（`grid-template-columns` + `var(--space-N)`），因为 rt 的列/间距工具类在 `utilities.css`，本项目没引那一层；`.rt-Grid` 只提供 `display: grid` 与对齐。

## Do's and Don'ts

### Do:

- **Do** 只消费 `style/app.css` 引出的 token：颜色、间距、圆角、阴影、动效都取变量，SFC 里只写 scoped 微调。
- **Do** 用 `--space-*` 与 `--radius-*` 刻度：`gap-sm`、`rounded-md`、`p-sm`，而不是数字刻度（不要 `gap-3`）。
- **Do** 把浮层抬起来：菜单、气泡、对话框用 `.surface-float` + `--shadow-popover`，并把内容包进 `ThemeRoot`。
- **Do** 用 `--contrast-foreground*` 派生层写字，统一跟随 20% 的对比基线。
- **Do** 动画走 `motion.css` 的类与 `@keyframes`，新增前先在那里补；统一用 `--ease-smooth` / `--ease-out` / `--ease-menu`。
- **Do** 触屏上把可点行抬到 44px（`--size-control + --space-xxs`），沿用已有的 `pointer: coarse` 规则。
- **Do** 中文文案按 1.43–1.6 行高排版，标题字重停在 600，不为了醒目跳到 700。

### Don't:

- **Don't** 在 SFC 里写裸 hex、`rgb()`、`color-mix()`，也不要新声明 `--*`；缺档先补 `tokens.css`。
- **Don't** 给卡片、侧栏或工具栏加阴影，那会推翻平铺 + 浮层两分法。
- **Don't** 用强调色铺卡片底、区块底或行底；它只做指示（见 The Rare Accent Rule）。
- **Don't** 堆第二档中性灰：表面之间只差一档亮度，文字只用四档墨。
- **Don't** 自己设计基础件。按钮、徽章、输入框、弹层、开关、滑条、分段控制都已经在 `components/ui/` 包过 rt，外观由 rt 的 `data-*` 与 prop 决定。
- **Don't** 堆工具类去压 rt：scoped 选择器带 data 属性，特异性已经高于 rt 的 0-1-0，不需要 `!important`。
- **Don't** 给静态内容加入场动画；动效只表达"在跑"、层级变化与状态切换，并遵守 `prefers-reduced-motion`。
- **Don't** 把 48px 控件档、2px 以上描边、26px 之外的展示级字号带进新界面。
