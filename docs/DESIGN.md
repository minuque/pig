---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  primary: "#5E6AD2"
  primary-dark: "#6672DC"
  primary-hover-light: "#4C56B8"
  primary-hover-dark: "#747FE5"
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

克制、安静、舒服，表面、文字与强调色取 Linear 的冷灰与靛。强调色是 `#5E6AD2`；悬停走中性灰，选中铺极淡的一层靛；描边取 black / white alpha；链接与进行中的 cyan 只管活动态。

优先级：解决问题 > 易于使用 > 好看美观。界面靠布局和控件本身说话，不靠说明文字和装饰。

## Token 分层

`apps/web/src/style/tokens.css` 分三层，组件只读语义层和组件层：

1. **原值**：每个色彩家族只手定实色与文字色，7 个标识色各一个 `--hue-*`，都写成 hex 或 rgba；不引入外部色板。
2. **语义层**：全站共用，按「表面、前景、边与分割、交互、状态、字、间距、圆角、阴影、动效、图标与控件高、布局、层级」分组。命名一个概念一个词：前景 `fg`、底 `bg`、边 `border`、品牌色 `accent`、状态 `-text` / `-subtle`。
3. **组件层**：只给单个组件或一类内容用，名字以组件开头（`--composer-*`、`--glass-*`、`--language-*`、`--mascot-*`）。单文件私有的静态几何尺寸直接写在各自组件样式中，能用语义档就不进这一层；颜色只在语义档与 `--tone-*` 槽位里取，不写裸色值，插画与品牌色见「例外」。

`/design` 页直接读这些分区注释分组，新增 token 时写进对应小标题下。

## 七条规则

1. **一页一个强调色。** 强调色（`#5E6AD2`）只用于主操作、焦点与选中底；活动态（链接、进行中、运行指示）另走 cyan。卡片、区块不铺强调色：悬停走中性灰，选中只铺极淡的靛，不铺成彩色块。
2. **一页最多 4 种字号。** 全局只有 4 档，层级靠字重和三级文字色。
3. **默认扁平，有阴影就用环。** 不叠阴影、不发光。阴影与毛玻璃只给真正浮起来的层：命令面板与警告框用 `--glass-*`，贴着触发器的菜单、下拉、选择框与浮卡用 `--float-*` 浮层：`--bg-raised` 84% 半透明底叠 `--glass-filter` 模糊，边缘与一层淡投影都写在 `--float-shadow` 里。有阴影的卡片、浮层、输入卡与立体控件用 `box-shadow: 0 0 0 var(--border-width) ...` 画环，不写 `border`：`border` 坐在表面底色之上，会在圆角内侧留一条苍白割裂线；外环绘在盒子外侧，和阴影融成一条干净的边。扁平无阴影的静态卡片仍用 `inset` 细线或单边分割线。
4. **不卡片套卡片。** 卡片里的分组用标题加分割线。
5. **圆角同心。** 内层圆角 = 外层圆角 − 内边距。
6. **规范只有一套。** 按钮、间距、圆角、分割线、弹窗、动画、阴影全站共用。
7. **能用产品表达的，不加文案。** 纯图标按钮的 tooltip 是它的名字；可见文字已写的内容不再用 tooltip 重复。

## 颜色

### 强调色

默认强调色取 Linear 的靛（浅色 `#5E6AD2`、悬停 `#4C56B8`；深色提亮到 `#6672DC`、悬停 `#747FE5`，保证深底清晰度）。外观设置另提供 `paper` / `ocean` / `grove` / `iris` 四套精选预设，由 `utils/theme-palette.ts` 从 `canvas + accent` 双种子经 OKLCH 推导出表面阶梯、前景三级灰与强调色阶并兜底 WCAG 对比度。文档根默认取强调色调，`--tone-*` 直接读预设推导出的 `--accent-solid` / `--accent-text`，浅底与描边由它派生；子组件显式传入 `color` 时改读对应家族。

强调色分两个角色，按用法取值，不混用：

- `--accent-solid`：实心填充与描边（默认浅色 `#5E6AD2` / 深色 `#6672DC`），悬停用 `--accent-solid-hover`（浅色变深、深色提亮）。主按钮的底、发送键、指示器与选中描边用它，文字用 `--fg-on-accent`（白）。
- `--accent-text`：文字与图标前景（默认取 `indigo-11`）。焦点环、`.text-primary` 与强调色文字用它；淡底 `--accent-subtle` 与 `--bg-selected` 同一档位（浅色 `11%` / 深色 `16%`）。
- 焦点环：`--focus-color` 取 `--accent-text`（indigo），全局 `:focus-visible` 与 `--focus-ring` 均由它派生。
- 链接 `--link` 取 `--info-text`，与「进行中」同一种 cyan，不跟强调色走。
- 「进行中」与强调色分开：运行状态、转圈、上下文进度条与用量环走 `--info-*`，文字取 `--info-text`（浅色 `#0B6F88`，深色 cyan-11），填充取 `--info-solid`（cyan-9），浅底取 cyan 第 3 级 alpha。
- 悬停与选中分开：按钮、菜单项、侧栏行深浅均走半透明叠加，`--bg-hover` 走中性叠加（浅色 `fg 6%` / 深色 `white 6%`），`--bg-selected` 走淡强调色叠加（浅色 `accent-solid 11%` / 深色 `accent-solid 16%`），只铺极淡的一层，不铺成彩色块。
- 按钮变体四种：`solid`（主操作）、`secondary`（`--bg-muted` 底）、`outline`（`--control-border` 环加 `--control-bg` 底，环由 `--control-shadow` 绘出）、`ghost`（固定盒，悬停才铺 `--bg-hover`）。一页只出现一个 solid 主按钮，其余用 secondary、outline 或 ghost。
- 输入卡的发送键用强调色实心（`--accent-solid` 配 `--fg-on-accent`），停止键用危险色实心（`--danger-solid` 配白）。「滚动到底部」仍用反色（`--bg-inverse` / `--fg-inverse`）：中灰（浅色 `#6B6B72` 配白字 5.3:1，深色 `#9DA4AE` 配深字 7.4:1），不用纯黑白。发送键不可用时换 `--bg-emphasis` 底配 `--fg-secondary` 图标，不靠降透明度。

### 中性色

表面与描边用固定 hex 与 black / white alpha；文字用带冷调的实色，与表面同一色系。控件外框用 `--border-input`；outline 按钮与选择框读 `--control-bg` / `--control-border` / `--control-shadow`（深色是半透明底、淡白框加顶边高光），对话框遮罩用 `--overlay`；`color="neutral"` 的按钮、徽章读中性语义档（`--bg-muted`、`--fg-secondary`）。

| 层                             | 浅色                      | 深色                      | token                         |
| ------------------------------ | ------------------------- | ------------------------- | ----------------------------- |
| 窗口、主区                     | `#FFFFFF`                 | `#101012`                 | `--bg`                        |
| 侧栏（主侧栏、抽屉、设置导航） | `#F7F8F8`（比主区深半档） | `#0D0D0E`（比主区暗半档） | `--sidebar`                   |
| 卡片、输入卡、气泡、工具输入   | `#F7F8F8`（与侧栏同一档） | `#17171A`                 | `--bg-surface`                |
| 浮起的实色表面                 | `#FBFBFC`                 | `#1C1C1F`                 | `--bg-raised`                 |
| 按钮与行悬停 / 选中            | `fg 6%` / `accent 11%`    | `white 6%` / `accent 16%` | `--bg-hover`、`--bg-selected` |

文字三级用实色，带一点冷调，与表面同一色系；深浅各一套，不再靠 alpha 随底自适应：

| 级  | 浅色      | 深色      | 对主区      | 用途                           |
| --- | --------- | --------- | ----------- | ------------------------------ |
| 主  | `#282A30` | `#E8EAED` | 14.4 / 15.8 | 正文、标题                     |
| 次  | `#4C5159` | `#9DA4AE` | 8.0 / 7.6   | 次要信息                       |
| 弱  | `#6A707C` | `#7C8490` | 5.0 / 5.0   | 占位提示、时间戳、分隔符、弱图标 |

描边浅色走 `black` alpha（`--border-subtle` / `--border` / `--border-strong` 对应第 1 / 2 / 3 档），深色收半档到 `4.5% / 7% / 13%` white alpha 以降低大卡片网格感。分割线只用 1px `--border-subtle`。

### 状态色

基础件的 `color` 取语义色调 `accent` / `neutral` / `info` / `success` / `warning` / `danger`，项目图标与首字母徽章另可取 7 个标识色。组件把它写成 `data-tone`，只读 4 个槽位：`--tone`（实色）、`--tone-text`（文字）、`--tone-subtle`（浅底）、`--tone-border`（描边）。悬停与按下不另定色，在原底色上叠 `--bg-hover` / `--bg-emphasis`。

四个状态族（`success` / `info` / `warning` / `danger`）与 `accent` 共用对称的三件套命名：`--*-solid`（圆点/进度/实心按钮，信息用 `--info-solid`、警告与危险深浅各一套）、`--*-text`（文字与图标）与 `--*-subtle`（实色按 `--tone-subtle-mix` 派生的浅底，浅色 8%、深色 16%）。信息是活动态、单走 cyan 族，与强调色分开，`Banner(info)` 仍走 cyan。非必要不加脉冲动效，背景任务默认安静展示，`StatusIndicator` 仅在需要引起注意时显式开启 `pulse`。

### 层级

- 局部隔离容器内：`0`（`auto`）或 `--z-behind` / `--z-raise` / `--z-sticky` / `--z-overlay`（`-1 / 1 / 2 / 3`）。
- 工作台全局浮动层：`--z-resizer` / `--z-window-controls` / `--z-menu` / `--z-drawer` / `--z-modal` / `--z-popover` / `--z-drag`（`1 / 1 / 10 / 20 / 30 / 35 / 40`）；菜单、下拉、选择框、浮卡与提示挂到 body，取 `--z-popover` 压在弹窗之上。`stylelint.config.js` 自动禁止在 `.vue` SFC 里写零散 `--*` 声明与非零数字 `z-index`。

### 例外

- `--language-*`：代码块语言图标，只在代码块里。
- Mermaid 图：浅色用 pele 自带的默认配色；深色在 `mermaid.css` 接项目语义 token（底 `--bg`、填充 `--bg-surface`、线 `--border`）。
- `--mascot-*`：吉祥物插画，深浅共用 logo 原色。
- `--favorite`、`--brand-mark-bg`：收藏星标的琥珀与 logo 蓝底，色相和明度都对不上语义家族。
- `--theme-wire-*`、强度滑条的外壳与滑块渐变：固定画浅色 / 深色的表面色，或手调的半透明白，语义档没有对应值。

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
- 项目缩写字母的图形尺寸不算字号。
- 对话区 Markdown 排版不受四档约束。

## 圆角

| token               | 值   | 给谁                                 |
| ------------------- | ---- | ------------------------------------ |
| `--radius-control`  | 6    | 输入框、标签、菜单项、侧栏行         |
| `--radius-card`     | 8    | 按钮、选择框、卡片、面板、代码块、浮层 |
| `--radius-dialog`   | 12   | 对话框、设置里的分行卡片             |
| `--composer-radius` | 18   | 输入卡                               |
| `--radius-pill`     | 9999 | 胶囊、圆形按钮                       |

- 嵌套写 `calc(外层 - 内边距)`；结果太小时用 `max()` 兜到 `--radius-control` 的一半。菜单：外 8、内边距 4、项取 `--radius-control` 6，比同心值 4 大 2px。

## 阴影与层级

| token               | 给谁                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `--shadow-popover`  | 提示、悬停卡、拖拽中的行、滚动到底按钮                                                                   |
| `--shadow-dialog`   | 对话框、抽屉、图片预览                                                                                   |
| `--composer-shadow` | 输入卡：柔投影；与 `--composer-bg` 的高不透明毛玻璃底、`--composer-inset` 的顶边高光、1px 外环组合使用     |

- **有阴影的表面用环不用 `border`。** `box-shadow: 0 0 0 var(--border-width) ...` 画在盒子外侧，与投影连成一条边缘；`border` 占着盒内一圈，比阴影更靠里，圆角处会露出苍白割裂线。
- 外环已并入各组阴影，深浅各一套：`--shadow-popover`、`--shadow-dialog` 自带 1px 环；菜单、下拉、选择框与浮卡的 1px 环在 `--float-shadow` 里（不再有 `--float-border`）；居中模态浮层的环在 `--glass-shadow` 里；outline 按钮与选择框等立体控件的环在 `--control-shadow` 里（读 `--control-border`）。组件只写 `box-shadow: var(--float-shadow)` 之类的一行，不再补 `border`。
- 毛玻璃只给浮起来的层：命令面板与警告框用 `--glass-*` 面板，菜单、下拉、选择框与浮卡用 `--float-bg` / `--float-shadow` 加 `--glass-filter`；需要实色底的卡片用 `--bg-surface`。
- 输入卡用 `--composer-bg`（浅色 `--bg-raised` 92%、深色 `--bg-surface` 90% 的高不透明毛玻璃）配 `--glass-filter`，加 1px 外环、`--composer-inset` 轻顶边高光与 `--composer-shadow` 柔投影；聚焦时只轻微加深外环（`--composer-border` → `--composer-border-hover`），不做抬升。
- 扁平无阴影的静态卡片用 1px `--border` 的 `inset` 细线或不铺底；描边与底色差只用一种。
- 分行卡片一律用 `CardList` + `CardRow`（`@components/ui/card`），不自写行线与内边距：12 圆角，行左右 16、上下 12，行线贴边；`interactive` 加悬停底；`bleed` 不带左右内边距，内容自己读 `--card-padding`。对话里的工具卡片留 8 圆角，与代码卡一致。
- 焦点环：`--focus-color` 取 `--accent-text`（`--focus-ring` = 2px 实色 `--focus-color`）；危险态 `--focus-ring-danger`。

## 间距与尺寸

- 间距基数 4px：`--space-2xs/xs/sm/md/lg/xl/2xl` = 4/8/12/16/24/28/32。
- 控件高三档：`--control-sm/md/lg` = 28/32/36（按钮与选择框 s/m/l 依次取三档，图标按钮默认与侧栏行 28，菜单项与输入卡控件 32）。
- 图标四档：`--icon-sm/md/lg/xl` = 12/14/16/32，线宽 `--icon-stroke`。
- 头部高 `--header-height` 44px；macOS 标题条 `--titlebar-inset` 44px，其余平台 0。

## 动画

浮层进出 140ms / 100ms，只动透明度与位移；对话框进出用 `scale`（0.98 → 1）与 `opacity`，不只位移；主题切换用 200ms 柔和 cross-fade。动效只表达在跑、层级变化与状态切换，遵守 `prefers-reduced-motion`。

## 组件

- 设置行由标题、一行简短说明与控件组成，不再堆叠多余提示。
- 项目缩写用灰色 soft Badge。
- AI 工作台与通用基础件收口到 `components/ui/`：`StatusIndicator` 统一圆点/图标状态表达（侧栏状态、子任务点、摘要角标），`Collapsible` 已接入 `RailCard`、`ProviderModelList`、`RailTasks`，`Checkbox` 补全表单复选能力并在 `/design` 提供示例。
- `TextFieldRoot` 通过 `invalid` prop 表达校验错误态（危险色内环加危险色焦点环）；居中模态浮层（`Dialog`、`AlertDialog`、`CommandPalette`）统一使用 `--radius-dialog`（12px）圆角。

## 不要

- 不加第二个强调色、装饰色、渐变、光晕；毛玻璃只用于居中模态浮层、贴着触发器的浮层与悬浮输入卡，不给静止正文卡片或侧栏加毛玻璃。
- 不给静止的卡片、侧栏、工具栏加阴影；有阴影的表面不叠 `border`，环一律写进阴影。
- 不加第 5 种字号，不加第 4 级文字灰。
- 不写说明产品本身已经说清楚的文案。
