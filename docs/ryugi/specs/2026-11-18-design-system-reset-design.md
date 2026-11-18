# 设计系统重整：token 收敛与新方向

日期：2026-11-18
状态：待批准
分支：`feat/design-system`（worktree `../pig-design`）

## 意图

pig 的设计系统参考 t3code、Radix UI 和 Claude Desktop 一点点磨出来，现在 token 太多太碎，成不了体系：

- `tokens.css` 与 `rt.css` 共定义 252 个变量（去掉 `.dark` 的同名覆盖后）。
- 只在 token 文件里出现、业务代码不直接引用的有 58 个；只被 1 个文件引用的有 95 个。
- `--size-*` 一个前缀就有 42 个。

目标质感：类 t3code，但更简洁、干净、舒适。

做法分两步：先把 token 收成三层体系，再在新体系上换视觉方向。两步之间停一次，由用户在方向对照图里挑方向。

## 目标

- token 分三层：原色阶 → 语义层 → 组件层。组件只消费语义层或组件层，不直接写原色阶。
- 总数从 252 降到约 120。
- 语义层改用短而规整的新名字，一次替换全部引用，不留旧名别名。
- 换方向后的画面满足下文「方向（已定）」一节。
- 引入 4 个外部 skill，只在本次重构里用来产出规则和做审查。

## 非目标

- 不换组件底座：Radix Themes（`rt-*` 类加 `data-*` 属性）保留，组件骨架和交互行为不动。
- 不改字号：4 档仍是 12 / 14 / 16 / 24；代码字号设置（`--text-code`）与 S / M / L 界面缩放原样保留。
- 不改强调色：全站 `data-accent-color="indigo"` 不动，Radix 组件（开关、滑块、Tabs、soft 按钮、悬停/选中底）照旧跟 indigo。
- 不改 AGENTS.md 的验收规则。
- 不装 `interface-review`：它要靠 `better-interface` 及其 3 个子 skill 才能出结论，用户决定不装这条链。
- 不动 `apps/desktop` 主进程。

## 反目标（出现即算失败）

- 为了凑数把语义上不同的东西并成同一个 token，比如把「描边」和「分割线」硬并、把状态色并进强调色。
- 换名后留一层旧名到新名的别名。
- SFC 里声明 `--*`、写裸 hex/rgb/`color-mix`（AGENTS.md 已禁止，重构中也不例外）。
- 方向步把强调色铺到卡片、区块或侧栏底色上。

## 约束

- 守 `apps/web/DESIGN.md` 的「七条规则」和 AGENTS.md 的 UI 约束。
- 每个逻辑步骤通过 `pnpm fix:touched` → `pnpm check:touched` 后做一次原子提交。
- 改到动效 token 跑 `pnpm test:bench`；改到主进程相关的跑 `pnpm test:electron`（预计不涉及）。
- 依赖：本次不新增 npm 依赖。

## 第 0 步：引入 skill

装 4 个 skill 到 `.claude/skills/`，只装本项目，不装全局：

| skill | 来源 | 锁定 commit |
|---|---|---|
| `better-colors` | jakubkrehel/skills | `276449adf5fa509adaab842b3559cb375ca868a4` |
| `better-typography` | jakubkrehel/skills | 同上 |
| `better-ui` | jakubkrehel/skills | 同上 |
| `review-animations` | emilkowalski/skills | `64eb3deb9a5fbfa041faf783e0bc3fd635872e9c` |

- 用 `gh api repos/<repo>/contents/<path>?ref=<sha>` 取每个 skill 目录下的全部文件（SKILL.md 和它引用的 `.md`），原样写入 `.claude/skills/<name>/`。不运行 `npx skills`。
- `agents/openai.yaml` 是给别的 harness 用的，不复制。
- 每个目录加一行来源说明文件 `SOURCE.md`：仓库、commit、许可证（两个仓库都是 MIT）。
- 这些 skill 的示例多用 Tailwind 或 React。只取判断标准和数值，不照抄写法；与 AGENTS.md 冲突时以 AGENTS.md 为准。

## 第 1 步：token 重构

### 三层

1. **原色阶**：Radix 的 slate（中性）与 indigo（强调）色阶、状态色家族，以及现有表面与文字用的固定 hex（如 `#F4F4F4`、`#101012`）。第 1 步把这些 hex 原样收为原色阶，画面不变；是否换成 slate 色阶的值留到第 2 步按方向图定。只在语义层定义里被引用。
2. **语义层**：全站共用，约 40–60 个。命名草案（最终名单在 1a 定）：

   | 类 | 草案 |
   |---|---|
   | 表面 | `--bg`、`--bg-sidebar`、`--bg-raised`（卡片、输入卡）、`--bg-overlay`（弹层）、`--bg-inverse` |
   | 文字 | `--fg`、`--fg-muted`、`--fg-faint`、`--fg-inverse`、`--fg-on-accent` |
   | 线 | `--line`（描边）、`--line-soft`（分割线） |
   | 交互 | `--hover`、`--selected`、`--focus`（焦点环）、`--accent`、`--accent-hover`、`--link` |
   | 状态 | `--success`、`--warning`、`--danger`、`--info`，各带一个 `-bg` |
   | 字 | 4 档字号与各自行高、字距；`--font-sans`、`--font-mono`；3 档字重 |
   | 间距 | 7 档 `--space-2xs` … `--space-2xl` |
   | 圆角 | `--radius-control`、`--radius-card`、`--radius-dialog`、`--radius-pill` |
   | 阴影 | `--shadow-popover`、`--shadow-dialog` |
   | 动效 | 时长 3 档、缓动 3 档 |
   | 层级 | 现有 5 个 `--z-*` |

3. **组件层**：放在 `tokens.css` 末尾的「组件」分区，按组件分小节。能由语义层推出的写成推导式，比如 `calc(var(--space-sm) * 2)`。内容配色（代码语言色 `--language-*`、图表 `--chart-*`、吉祥物 `--mascot-*`、effort 滑块 `--effort-*`）归这一层，不进语义层。

### 收敛规则

- 零碎值吸附到最近一档语义值。允许 1–2px 级别的画面变化。
- 只有一个使用方、且值等于某个语义档的，删掉，改用语义 token。
- 只有一个使用方、值确实独特的（如 `--size-mac-traffic-lights`），进组件层。
- 定义了却无人引用的，删。
- 换名一次完成，旧名不留。

### 1a 定语义层（写入本 spec 附录后再动代码）

- 用 `better-colors`：给语义色定最终命名和分档；亮暗两套都测每对前景/背景的对比度。
- 用 `better-typography`：定 4 档字号的行高与字距。
- 用 `better-ui`：定间距、圆角、描边、阴影的分档。
- 产出：最终语义 token 表（名字、亮值、暗值、旧名映射）附在本 spec 末尾。这一步只是数值与命名，不需要用户再批，但要在交付说明里列出。

### 1b 落代码

- 重写 `tokens.css` 与 `rt.css` 的变量部分，按三层分区。
- 全仓替换引用（约 129 个文件、2466 处 `var(--…)`）。
- 更新 `apps/web/DESIGN.md` 的 token 名与数值。
- 更新 `/design` 页：`features/design-lab/lib/tokens.ts` 的分组规则改按新前缀；总览卡片按三层或按新语义分类展示。

### 1c 验收

- `pnpm fix:touched` → `pnpm check:touched` 通过。
- 改前、改后各截一组图对比：`/design` 总览与 9 类 token 页，加工作台主界面（新会话页、有对话的会话页、设置弹窗），亮暗各一套。差异只允许是并档带来的 1–2px 级变化。
- 按 `better-colors`、`better-typography`、`better-ui` 的规则自审本步 diff：对比度、截断、对齐、圆角同心。
- 动效 token 有合并时跑 `/review-animations` 与 `pnpm test:bench`。

## 第 2 步：换方向

### 方向（已定）

| 维度 | 决定 |
|---|---|
| 灰阶 | 保持 Radix slate 冷灰 |
| 强调色 | 保持 indigo，全站 `data-accent-color` 不动。主按钮也保持 indigo（用户在 builder check 轮改口：「这个不动，还是保持 indigo」，取消早先的反色主按钮） |
| 表面 | 保留侧栏 / 主区 / 卡片三层底色，层间差距收到约半档；细描边分区，基本无阴影，阴影只给弹层 |
| 圆角 | 控件 6 / 卡片 8 / 弹窗 12，同心。唯一例外：输入卡保留胶囊形（`--radius-composer`）与它的柔投影，写进 DESIGN.md |
| 字号与密度 | 4 档字号不变（12 / 14 / 16 / 24）；行高、行间距、面板内边距各放松一档 |
| 等宽字体 | 只用于机器内容：代码、路径、命令、工具名、token 数值、快捷键 |

### 2a 方向对照图

- 用已定维度画 2–3 个方向，画在真实工作台界面上（侧栏 + 对话 + 输入框 + 一个弹层），亮暗各一张。方向之间只在尚未定的细节上不同（比如半档差距的具体值、放松一档的具体量、描边强弱）。
- 用 `better-colors` 算半档表面色，查对比度；用 `better-ui` 核同心圆角与图标对齐。
- 形式：ryugi artifacts 的 HTML 画板，载入项目真实的 `rt.css` 与 `tokens.css`，每个方向叠一层覆盖值；不改应用代码。
- 用户挑一个方向，结论写回本 spec。

### 2b 套用

- 只改语义层的值（和必要的组件层值），不改组件结构。
- 更新 DESIGN.md 的基调、颜色、圆角、密度章节。

### 2c 验收

- `pnpm fix:touched` → `pnpm check:touched` 通过。
- 同 1c 的截图组，与选定方向图对照。
- 按 `better-*` 规则自审本步 diff；动效有改动时跑 `/review-animations`。

## 留给实现者

- 语义层的最终名单与数值（1a），在本 spec 的命名草案和收敛规则之内。
- 组件层的分节方式。
- `/design` 总览卡片的分类方式，在三层结构可见的前提下。
- 截图脚本：可沿用 `@playwright/test` 写临时脚本，不提交。

## 我替用户定的（ⓒ）

- ⓒ 「方向（已定）」里的视觉改动都放第 2 步；第 1 步只做结构调整和并档。
- ⓒ 内容配色（语言色、图表色、吉祥物、effort）归组件层。
- ⓒ 语义层规模写成 40–60（讨论时说约 40）：表里的必要项已超 40。
- ⓒ 不复制 `agents/openai.yaml`；每个 skill 目录加 `SOURCE.md`。
- ⓒ 方向对照图画 2–3 个，亮暗各一张，用 HTML 画板。
- ⓒ 字号按现状 12 / 14 / 16 / 24（讨论时我误写成 20）。
- ⓒ 第 1 步把固定 hex 表面原样收为原色阶。

## 用到的产物

- 参考图：用户粘贴的 affectUI Design System 总览截图，已用于 `/design` 总览改版（提交 `2f7ceae2`），本 spec 不再依赖。
- 讨论记录：本会话的 grill-me 四轮问答，结论已全部写入上文。

## 已决问题（builder check 轮）

1. 强调色：保持 indigo，主按钮也不反色。
2. 输入卡：保留胶囊形与柔投影，作为唯一例外。
3. `interface-review`：不装；验收改为截图对比加 `better-*` 规则自审。

## 附录：语义层定稿（1a）

依据 `better-colors/token-naming.md`：一个概念只用一个词，角色名不带用途地点，`primary` 不再表示品牌色。

- **前景用 `fg`**：`--text-*` 已是字号命名空间，前景色若也叫 text 会和字号混。
- **边用 `border`**：不用 line。分割线是单独角色，用 `--separator-top`。
- **品牌色叫 `accent`**：用 `--accent-solid` 和 `--accent-solid-hover`，不和 Radix 的 `--accent-1..12` 重名。
- **状态色**：每个状态有 `-text` 和 `-subtle` 两个 token。
- **原色阶**：表面与文字的 hex 都直接写在语义层。定稿时的 `--ink*` 输入与对比度推量层已在 `3c27aa6f` 去掉，下表 `--foreground*` → `--ink*` 三行只作历史记录。

| 组 | 语义 token |
|---|---|
| 表面 | `--bg` `--bg-sunken`（侧栏） `--bg-surface`（卡片、输入卡） `--bg-raised`（弹层） `--bg-inverse` `--bg-inverse-hover` `--scrim` |
| 前景 | `--fg` `--fg-secondary` `--fg-faint` `--fg-inverse` `--fg-on-accent` |
| 边 | `--border` `--border-subtle` `--border-width` `--separator-top` |
| 交互 | `--bg-hover` `--bg-selected` `--bg-muted` `--bg-emphasis` `--accent-solid` `--accent-solid-hover` `--link` `--focus-ring` `--focus-ring-danger` `--opacity-disabled` |
| 状态 | `--{success,info,warning,danger}-{text,subtle}` |
| 字 | `--text-{meta,body,title,heading}` 与 `--line-height`/字距、`--text-code` `--text-code-line`、`--font-sans` `--font-mono`、`--font-weight-{normal,medium,semibold,bold}` |
| 间距 | `--spacing` 与 `--space-{2xs,xs,sm,md,lg,xl,2xl}` |
| 圆角 | `--radius-{control,card,dialog,pill}` |
| 阴影 | `--shadow-popover` `--shadow-dialog` |
| 动效 | `--duration-{fast,normal,slow}` `--ease-{out,in-out,spring}` |
| 图标 | `--icon-{sm,md,lg,xl}`（12/14/16/32） `--icon-stroke` |
| 控件高 | `--control-{sm,md,lg}`（28/32/40） |
| 布局 | `--content-width` `--header-height` `--titlebar-inset` `--titlebar-controls-inset` |
| 层级 | `--z-{resizer,menu,drawer,modal,drag}` |

组件层用组件前缀命名，比如 `--composer-*`、`--file-tab-*`、`--settings-*`、`--model-picker-*`、`--menu-*`、`--dialog-*`、`--effort-*`、`--mascot-*`、`--language-*`、`--chart-*`、`--transcript-*`。

### 并档（画面会变）

- `--ease-hover`、`--ease-icon` 并入 `--ease-out`。
- `--size-rail-row` 是 26，并入 `--control-sm`（28）。
- 电池格、图例色块是 10，并入 `--space-sm`（12）。
- 用量条高与电量最窄宽是 6，并入 `--space-xs`（8）。
- 电池内边距是 2，并入 `--space-2xs`（4）。
- 上下文环是 15，并入 `--icon-lg`（16）。

### 旧名 → 新名

| 旧 | 新 |
|---|---|
| `--contrast-foreground-secondary` | `--fg-secondary` |
| `--contrast-foreground-faint` | `--fg-faint` |
| `--contrast-foreground` | `--fg` |
| `--foreground-secondary` | `--ink-secondary` |
| `--foreground-faint` | `--ink-faint` |
| `--foreground` | `--ink` |
| `--inverse-background-hover` | `--bg-inverse-hover` |
| `--inverse-background` | `--bg-inverse` |
| `--inverse-foreground` | `--fg-inverse` |
| `--background` | `--bg` |
| `--sidebar` | `--bg-sunken` |
| `--surface` | `--bg-surface` |
| `--popover` | `--bg-raised` |
| `--primary-active` | `--accent-solid-hover` |
| `--primary-foreground` | `--fg-on-accent` |
| `--primary` | `--accent-solid` |
| `--btn-hover` | `--bg-hover` |
| `--btn-selected` | `--bg-selected` |
| `--fill-quiet` | `--bg-muted` |
| `--fill-strong` | `--bg-emphasis` |
| `--border-soft` | `--border-subtle` |
| `--divider-top` | `--separator-top` |
| `--success-bg` | `--success-subtle` |
| `--info-bg` | `--info-subtle` |
| `--warning-bg` | `--warning-subtle` |
| `--danger-bg` | `--danger-subtle` |
| `--success` | `--success-text` |
| `--info` | `--info-text` |
| `--warning` | `--warning-text` |
| `--danger` | `--danger-text` |
| `--state-working` | `--info-text` |
| `--inline-code-background` | `--code-inline-bg` |
| `--background-soft` | `--bg` |
| `--space-xxs` | `--space-2xs` |
| `--space-xxl` | `--space-2xl` |
| `--space-dialog-compact` | `--dialog-padding-compact` |
| `--space-dialog` | `--dialog-padding` |
| `--ease-hover` | `--ease-out` |
| `--ease-icon` | `--ease-out` |
| `--ease-menu` | `--menu-ease` |
| `--duration-menu-out` | `--menu-duration-out` |
| `--duration-dock-in` | `--composer-dock-in` |
| `--duration-dock-out` | `--composer-dock-out` |
| `--duration-settle` | `--welcome-settle-duration` |
| `--duration-reveal` | `--welcome-reveal-duration` |
| `--duration-pig-peek` | `--mascot-peek-duration` |
| `--duration-theme` | `--theme-switch-duration` |
| `--duration-shimmer` | `--shimmer-duration` |
| `--text-monogram` | `--monogram-size` |
| `--border-width-quote` | `--quote-border-width` |
| `--radius-composer` | `--composer-radius` |
| `--shadow-composer` | `--composer-shadow` |
| `--corner-shape-composer` | `--composer-corner-shape` |
| `--size-icon-xs` | `--icon-sm` |
| `--size-icon-2xs` | `--icon-lg` |
| `--size-icon-hero` | `--icon-xl` |
| `--size-icon-button` | `--control-sm` |
| `--size-icon` | `--icon-md` |
| `--line-icon-width` | `--icon-stroke` |
| `--size-control` | `--control-lg` |
| `--size-nav-rail` | `--control-sm` |
| `--size-rail-row` | `--control-sm` |
| `--size-menu-item` | `--control-md` |
| `--size-composer-control` | `--control-md` |
| `--size-content` | `--content-width` |
| `--size-avatar` | `--user-avatar-size` |
| `--size-file-tab-height` | `--file-tab-height` |
| `--size-file-tab-close` | `--file-tab-close` |
| `--size-file-tab-label` | `--file-tab-label` |
| `--size-file-tab-min` | `--file-tab-min` |
| `--size-file-tab` | `--file-tab-width` |
| `--size-model-picker-list` | `--model-picker-list-height` |
| `--size-model-picker` | `--model-picker-width` |
| `--size-composer-field-max` | `--composer-field-max` |
| `--size-mac-traffic-lights` | `--traffic-lights-width` |
| `--size-drawer` | `--drawer-width` |
| `--size-rail` | `--rail-width` |
| `--size-task-output-max` | `--task-output-max` |
| `--size-battery-block` | `--space-sm` |
| `--size-battery-pad` | `--space-2xs` |
| `--size-battery-fill-min` | `--space-xs` |
| `--size-meter-block` | `--space-xs` |
| `--size-legend-swatch` | `--space-sm` |
| `--size-legend-share` | `--legend-share` |
| `--size-dialog-s` | `--dialog-width-sm` |
| `--size-settings-body` | `--settings-body-width` |
| `--size-settings-dialog-width` | `--settings-dialog-width` |
| `--size-settings-dialog-height-min` | `--settings-dialog-height-min` |
| `--size-settings-dialog-height` | `--settings-dialog-height` |
| `--size-settings-dialog-nav-narrow` | `--settings-nav-width-narrow` |
| `--size-settings-dialog-nav` | `--settings-nav-width` |
| `--size-context-ring` | `--icon-lg` |
| `--size-resize-grip-thickness` | `--resize-grip-thickness` |
| `--size-resize-grip` | `--resize-grip-length` |
| `--size-turn-estimate` | `--turn-estimate` |

### 数量

这一步只改名、分层、并档，删掉的有限，预计从 213 降到约 190，达不到 spec 写的约 120。原因是：
- 组件专属值占了大头：尺寸、内容配色、动效时长。
- AGENTS.md 规定 SFC 不能声明 `--*`，也不能写裸值，所以这些值只能留在 `tokens.css` 的组件分区。

要再往下降，只能靠第 2 步让组件改用语义档，这一步会改变画面。

## 方向选定（2a 结果）

用户在 `artboard/design-directions` 选了 **A 石墨**（2026-11-18），之后在 `/design` 颜色调节页调成「石墨 · 柔和」（OKLCH 色相 285°，表面色度 0.005，文字取两倍）。下面是最终值。
- **表面：** 三层各差约半档。
  - 浅色：`--bg #f2f2f6`、`--bg-sunken #eeeef2`、`--bg-surface #f6f6fa`、`--bg-raised #fbfbff`。
  - 深色：`--bg #131316`、`--bg-sunken #101012`、`--bg-surface #17171a`、`--bg-raised #1e1e20`。
- **文字：** 三级固定色，在主区、侧栏、卡片上都不低于 4.5:1。弱级也承载会话标题、分组标题、空状态与占位符，所以不按 3:1 放宽。
  - 浅色：`--fg #3c3c42`、`--fg-secondary #57575e`、`--fg-faint #6b6b72`（侧栏最低 4.57）。
  - 深色：`--fg #d3d3db`、`--fg-secondary #9d9ea5`、`--fg-faint #85858c`（浮层最低 4.54）。
- **表格：** rt 的表格行字色写死 `--gray-12`，在 `rt.css` 接回 `--fg`。
- **描边：** `--border` 取 gray-a4，`--border-subtle` 取 gray-a3。
- **密度：** 正文行高从 1.43 改为 1.5；对话内条目间距 `--transcript-item-gap` 从 16 改为 20。
- **圆角：** 6 / 8 / 12。输入卡保留胶囊形。
- **主按钮：** 仍是 indigo。方向图就是按 indigo 画的，页面上那道「主按钮颜色」问题用户还没提交。
