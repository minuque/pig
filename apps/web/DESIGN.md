---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  void-eclipse: "#0B0B0B"
  abyss-blue: "#2B3B79"
  silver-mist: "#E4E4E4"
  primary: "#2B3B79"
  primary-on: "#E4E4E4"
  link-light: "#364887"
  link-dark: "#A6B5E0"
  window-light: "#E4E4E4"
  workbench-light: "#F4F4F4"
  card-light: "#FAFAFA"
  window-dark: "#0B0B0B"
  workbench-dark: "#121212"
  card-dark: "#181818"
  ink-light: "#0B0B0B"
  ink-secondary-light: "#4A4A4A"
  ink-faint-light: "#6A6A6A"
  ink-dark: "#E4E4E4"
  ink-secondary-dark: "#B0B0B0"
  ink-faint-dark: "#8A8A8A"
typography:
  heading:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.2px"
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
  meta:
    fontFamily: "anthropic-sans, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "anthropic-mono, ui-monospace, SF Mono, Menlo, Consolas, PingFang SC, Microsoft YaHei, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24.5px"
rounded:
  control: "6px"
  card: "10px"
  dialog: "14px"
  pill: "9999px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  xxl: "32px"
---

# Design System: pig 工作台

## 基调

克制、安静、舒服。品牌三色：Void Eclipse `#0B0B0B`、Abyss Blue `#2B3B79`、Silver Mist `#E4E4E4`。

优先级：解决问题 > 易于使用 > 好看美观。界面靠布局和控件本身说话，不靠说明文字和装饰。

## 七条规则

1. **一页一个强调色。** 品牌蓝只用于主操作、选中态、焦点、链接。卡片、行、区块不铺强调色。
2. **一页最多 4 种字号。** 全局只有 4 档，层级靠字重和三级文字色。
3. **默认扁平。** 不叠阴影、不发光、不加毛玻璃。阴影只给真正浮起来的层。
4. **不卡片套卡片。** 卡片里的分组用标题加分割线。
5. **圆角同心。** 内层圆角 = 外层圆角 − 内边距。
6. **规范只有一套。** 按钮、间距、圆角、分割线、弹窗、动画、阴影全站共用。
7. **能用产品表达的，不加文案。** 纯图标按钮的 tooltip 是它的名字；可见文字已写的内容不再用 tooltip 重复。

## 颜色

### 强调色

`style/abyss.css` 定义 12 级色阶 `abyss`，第 9 级即 `#2B3B79`，其余级由 indigo 刻度按同色相降彩度推得。`index.html` 与 `ThemeRoot` 的 `data-accent-color="abyss"` 把它映射到 `--accent-*`。

- `--primary`：第 9 级。实心主按钮的底，文字用 `--primary-foreground`（Silver Mist），对比度约 8.5:1。
- `--link`、`--info`、焦点环：第 11 级。深色下第 9 级在 `#0B0B0B` 上只有约 1.8:1，必须用第 11 级。
- 一页只出现一个 solid 主按钮，其余用 soft 或 ghost。

### 中性色

中性色用 Radix 的纯灰 `gray`，没有色偏。

| 层                 | 浅色      | 深色                  | token                                          |
| ------------------ | --------- | --------------------- | ---------------------------------------------- |
| 窗口与侧栏         | `#E4E4E4` | `#0B0B0B`             | `--background`                                 |
| 主工作区           | `#F4F4F4` | `#121212`             | `--workbench-surface`                          |
| 卡片、输入卡、浮层 | `#FAFAFA` | `#181818` / `#1C1C1C` | `--card`、`--composer-background`、`--popover` |

文字只有三级，都走 `--contrast-foreground*` 派生层：

| 级  | 浅色      | 深色      | 用途              |
| --- | --------- | --------- | ----------------- |
| 主  | `#0B0B0B` | `#E4E4E4` | 正文、标题        |
| 次  | `#4A4A4A` | `#B0B0B0` | 次要信息          |
| 弱  | `#6A6A6A` | `#8A8A8A` | 非必要信息，≥ 3:1 |

描边只有 `--border`（gray-a6）与 `--border-soft`（gray-a5）。分割线只用 1px `--border-soft`。

### 状态色

成功、警告、危险取 Radix 的 green、orange、red：第 11 级做文字（`--success`、`--warning`、`--danger`），第 3 级 alpha 做底（`--*-bg`）。不用实色填充，不加光晕。状态色只在真有状态时出现。

### 例外

- `--language-*`：代码块语言图标，只在代码块里。
- `--mermaid-*`：图表。
- `--mascot-*`：吉祥物插画，深浅共用 logo 原色。

## 字号

| token            | 默认    | S 档 | L 档 | 用途                           |
| ---------------- | ------- | ---- | ---- | ------------------------------ |
| `--text-meta`    | 12      | 11   | 13   | 辅助信息、分组标题、时间、标签 |
| `--text-body`    | 14      | 13   | 15   | 正文、按钮、菜单、列表行       |
| `--text-title`   | 16      | 15   | 17   | 会话标题、弹层标题             |
| `--text-heading` | 20      | 20   | 20   | 页面大标题                     |
| `--text-code`    | 13 等宽 | 12   | 14   | 代码、路径、快捷键             |

- 字重只用 400、500、600。
- `--text-monogram`、`--text-glyph` 是图形尺寸，不算字号。
- 对话区 Markdown 排版对齐 cc-wrapper，不受四档约束。

## 圆角

| token              | 值   | 给谁                                 |
| ------------------ | ---- | ------------------------------------ |
| `--radius-control` | 6    | 按钮、输入框、标签、菜单项、侧栏行   |
| `--radius-card`    | 10   | 卡片、面板、代码块、图片、下拉、浮层 |
| `--radius-dialog`  | 14   | 对话框、输入卡                       |
| `--radius-pill`    | 9999 | 胶囊、圆形按钮                       |

- rt 的 `--radius-1..6` 在 `rt.css` 接到这三档。
- 嵌套写 `calc(外层 - 内边距)`；结果太小时用 `max()` 兜到 `--radius-control` 的一半。rt 菜单本身同心：外 10、内边距 4、项 6。

## 阴影与层级

| token              | 给谁                                               |
| ------------------ | -------------------------------------------------- |
| `--shadow-popover` | 下拉、菜单、提示、悬停卡、拖拽中的行、滚动到底按钮 |
| `--shadow-dialog`  | 对话框、抽屉、图片预览                             |

- rt 的 `--shadow-4/5` 接 popover，`--shadow-6` 接 dialog。
- 浮层底色是实色 `--popover`（`.surface-float`），不透明，不模糊。
- 卡片用 1px `--border` 描边、不铺底；描边与底色差只用一种。
- 焦点环：`--focus-ring` = 2px 实色第 11 级；危险态 `--focus-ring-danger`。

## 间距与尺寸

- 间距基数 4px：`--space-xxs/xs/sm/md/lg/xl/xxl` = 4/8/12/16/24/28/32。
- 控件 40px（`--size-control`），图标按钮 28px，侧栏行 28px，图标 14px。
- 头部高 `--header-height` 44px；macOS 标题条 `--titlebar-inset` 44px，其余平台 0。

## 动画

只复用 `motion.css` 的类、`@keyframes` 与 `--duration-*`、`--ease-*`，不新增。浮层进出 140ms / 100ms，只动透明度与位移。动效只表达在跑、层级变化与状态切换，遵守 `prefers-reduced-motion`。

## 组件

- 基础件来自 `components/ui/` 包过的 Radix Themes，外观由 `rt-*` 类与 `data-*` 决定；微调写 scoped 样式。
- 弹层内容包 `ThemeRoot`，否则飞出文档流后拿不到 rt token。
- 设置行只有标签和控件，没有说明文字。
- 项目缩写用灰色 soft Badge；上下文用量图用强调色同色系深浅区分各段。

## 不要

- 不在 SFC 里写裸 hex、`rgb()`、`color-mix()`，不声明 `--*`；缺档先补 `tokens.css`。
- 不加第二个强调色、装饰色、渐变、光晕、毛玻璃。
- 不给静止的卡片、侧栏、工具栏加阴影。
- 不加第 5 种字号，不加第 4 级文字灰。
- 不写说明产品本身已经说清楚的文案。
