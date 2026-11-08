# 设计系统重构：克制、安静、舒服

日期：2026-11-08
状态：已批准

## 意图

把 `apps/web` 的设计系统收成一套克制、安静、舒服的基调。产品优先级是：解决问题 > 易于使用 > 好看美观。界面不打扰用户，靠布局和控件本身说话，不靠说明文字和装饰。

## 目标

- 品牌色取自用户给的三色：Void Eclipse `#0B0B0B`、Abyss Blue `#2B3B79`、Silver Mist `#E4E4E4`。
- 一页只有一个强调色。
- 全局 4 档字号。一页最多出现 4 种字号。
- 按钮、间距、圆角、分割线、弹窗、动画、阴影各只有一套规则，所有页面共用。
- 页面默认扁平。阴影只给真正浮起来的层。
- 去掉能由产品本身表达的说明文字。

## 非目标

- 不改布局结构、信息架构和交互流程。
- 不改对话区 Markdown 排版。它继续对齐 cc-wrapper（见 `2026-11-05-transcript-cc-wrapper-alignment-design.md`）。
- 不换 Radix Themes，不新增依赖。
- 不改间距档位（`--space-xxs` 到 `--space-xxl`）。

## 反目标

- 不留毛玻璃、发光、渐变装饰。
- 不留卡片阴影，不留卡片套卡片。
- 不为了「好看」加第二个强调色。

## 已定决策

| 决策 | 来源 |
| --- | --- |
| 品牌三色如上，整体克制安静舒服 | 用户 |
| 优先级：解决问题 > 易用 > 美观 | 用户 |
| 产品能表达清楚的地方不加文案 | 用户 |
| 一页一个强调色 | 用户 |
| 一页最多 4 种字号，兼顾节奏、清晰和对比度 | 用户 |
| 规范一致且克制；嵌套圆角同心，内圆角 = 外圆角 − 内边距 | 用户 |
| 默认扁平：不叠阴影、不发光、不加毛玻璃；阴影只给浮层；不卡片套卡片 | 用户 |
| 保留深浅两套主题；强调色基于 `#2B3B79` 生成 12 级色阶替换 indigo；中性色从 slate 换成纯灰 | 用户（第 1 题按建议） |
| 品牌蓝只用于主操作、选中态、焦点；状态色只在有状态时出现且降饱和；代码语法色例外；标签色与项目缩写配色改灰 | 用户（第 2 题按建议） |
| 字号 4 档：12 / 14 / 16 / 20；代码 13 号等宽；层级靠字重和三级文字色 | 用户（第 3 题按建议） |
| 对话区 Markdown 排版不动 | 用户（第 4 题按建议） |
| 圆角 6 / 10 / 14 / 全圆角，嵌套用公式算 | 用户（第 5 题按建议） |
| 删毛玻璃和装饰阴影，只留浮层与对话框 2 个阴影；卡片用色差或分割线二选一 | 用户（第 6 题按建议） |
| 最吵的地方：设置弹窗的子页面、部分 tooltip | 用户 |
| 删掉「半透明窗口」开关及其样式，窗口一律实色 | 用户 |

## 规范

### 颜色

**色阶**
- 强调色：新建一套 12 级色阶 `abyss`，深浅各一套。第 9 级等于 `#2B3B79`。按 Radix 自定义色阶的方法生成，写成静态 CSS，放进 `style/`，由 `app.css` 引入。替换 `index.html` 上的 `data-accent-color="indigo"`。
- 中性色：用 Radix 的 `gray`（纯灰），替换 `slate`。

**表面**（我的决定）
- 深色：窗口和侧栏 `#0B0B0B`；主工作区高一级，约 `#121212`。
- 浅色：窗口和侧栏 `#E4E4E4`；主工作区亮一级，约 `#F4F4F4`。这样阅读区不会整片发灰。
- 弹层底色用实色 `--popover`，不透明。

**强调色用法**
- 主按钮：填充第 9 级，文字用 Silver Mist。深色下对比度约 8.5:1。
- 链接、选中态文字、焦点框：深色用第 11 级。第 9 级在 `#0B0B0B` 上只有约 1.8:1，看不见。
- 一页只出现一个主按钮。

**文字三级**
- 主、次、弱三级：`--foreground`、`--foreground-secondary`、`--foreground-faint`。
- 合并 `--foreground-muted` 和 `--muted-foreground`。
- 主、次两级在对应底色上 ≥ 4.5:1；弱级只用于非必要信息，≥ 3:1。
- `contrast-*` 这组保留机制，跟着三级收敛。

**状态色**
- 保留 green、orange、red 三套。
- 用法改成「第 11 级文字 + 第 3 级底色」，不用实色填充。
- 删掉 `-halo` 光晕。
- `--info` 和 `--state-working` 跟随强调色。

**改成灰色**
- `--accent-skill/steel/teal/gray/green`。
- session-nav 的 `MONOGRAM_COLORS`。
- `--star`（改用主文字色的实心图标，我的决定）。

**例外保留**
- `--language-*`：只出现在代码块里。
- `--mermaid-*`。
- `--mascot-*`：插画，我的决定。

**删掉**
- 没有用途的 Radix 色板引入（blue、sky、cyan、teal，如果改灰后不再引用）。

### 字号

| 新 token | 大小 | 替换 |
| --- | --- | --- |
| `--text-meta` | 12 | micro、eyebrow、caption、caption-mono、xs |
| `--text-body` | 14 | body-sm、body-md、button、base、sm |
| `--text-title` | 16 | title、body-lg |
| `--text-heading` | 20 | heading-2 |
| `--text-code` | 13 等宽 | code、code-line；code-sm 并入 `--text-meta` 等宽 |

- 现有字号档（S/M/L 设置）继续缩放这 4 档。
- `--text-monogram` 和 `--text-glyph` 是图形尺寸，不算字号，保留。
- 层级靠字重和三级文字色。字重只用 400、500、600。

### 圆角

| token | 值 | 给谁 |
| --- | --- | --- |
| `--radius-control` | 6 | 按钮、输入框、标签、菜单项 |
| `--radius-card` | 10 | 卡片、面板、代码块、下拉和浮动提示 |
| `--radius-dialog` | 14 | 对话框、输入卡 |
| `--radius-pill` | 9999 | 胶囊形状 |

- 嵌套元素一律写成 `calc(外层圆角 - 内边距)`，最小不低于 `--radius-control` 的一半。
- 删掉其余圆角 token。
- 输入卡从 32px 改成 `--radius-dialog`（我的决定，见「请核对」）。

### 阴影与层级

- 只留 2 个阴影：
  - `--shadow-popover`：下拉、菜单、浮动提示、右键菜单。
  - `--shadow-dialog`：对话框、抽屉。
- 删除 `--shadow-float`、`-logo`、`-soft`、`-elevated`、`-card`。用到它们的地方：如果元素真的浮起来，改用上面两个之一；否则去掉阴影。
- 删除 `--glass-*`、`--material-*`，以及所有 `backdrop-filter`。同时删掉 `motion.css` 里菜单退出动画的模糊帧，只保留透明度和位移。
- 侧栏选中态 `--glass-selected-bg` 改成中性色第 4 级的实色。
- 删掉「半透明窗口」设置：偏好字段、`ThemeRoot` 的 `data-panel-background`、相关样式与文案。

### 分割线与卡片

- 分割线只有一种：1px，`--border-soft`。
- 卡片和底色之间，色差和描边只用一种。默认用色差（我的决定）。
- 卡片里不再放卡片。内层改成分组：标题 + 用分割线隔开的行。

### 按钮与动画

- 按钮用 Radix Button。每页一个 solid 主按钮，其余用 soft 或 ghost。
- 动画只复用 `motion.css` 现有的时长和缓动，不新增。

### 文案

规则：控件和布局能说清楚的，不加说明。纯图标按钮的 tooltip 就是它的名字，保留；可见文字已经写了的内容，不再用 tooltip 重复。

设置页 hint 的处理（我的决定，逐条见「请核对」）：

| 现有 hint | 处理 |
| --- | --- |
| `languageHint`、`fontSizeHint`、`chatWidthHint` | 删 |
| `notifySystemHint`、`notifySoundHint` | 删 |
| `userNameHint` | 删，把「Pig」写成输入框的占位文字 |
| `translucentWindow`、`translucentWindowHint` | 随开关一起删 |
| `apiKeyHint` | 保留，缩短到一句 |
| `pasteHint`、`authNote` | 保留，只在相关状态下显示 |

tooltip 的处理：
- `ModelPicker` 触发器：文字被截断时才显示。
- `SessionItem` 标题：文字被截断时才显示。
- composer 的长 tooltip（`composer/index.vue` 106 行）：缩成一行。

### 设置弹窗

- 设置弹窗本身是浮层。弹窗里的子页面最多一层 `Card`。
- `ProviderDetail`、`ProviderLoginPanel`、`ProviderModelList`、`CustomProviderForm` 里的 `CustomModelCard`：检查嵌套。有嵌套的，内层改成分组 + 分割线。

## 留给实施者

- 色阶的具体 12 级数值，以及表面色的精确值。只要满足上面的对比度要求即可。
- 每处旧字号映射到哪一档。上表是默认映射；个别位置换一档后更合适，可以改，但一页不超过 4 种。
- token 改名后，把所有引用一次迁移完，不留别名。

## 实施顺序

1. **token**：色阶、表面、文字三级、字号、圆角、阴影，删掉毛玻璃。
2. **组件迁移**：清理删掉的 token 的所有引用。卡片套卡片改成分组。
3. **文案**：设置页 hint 和 tooltip。
4. **文档**：更新 `apps/web/DESIGN.md` 和设计页 `/design` 的总览分组。

每步跑 `pnpm fix:touched` 和 `pnpm check:touched`。每步完成后在 `/design` 和真实页面看深浅两套主题的画面，确认对比度。

## 请核对（我的决定）

- 主工作区比窗口亮或暗一级，形成两层表面。
- 卡片默认用色差，不用描边。
- 输入卡圆角从 32px 改成 14px。
- 星标改成主文字色。
- 吉祥物保留原色。
- 设置页 hint 的删留清单。
