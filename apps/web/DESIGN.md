---
name: pig 工作台
description: 本机 Pi agent 的多会话并行工作台界面
colors:
  primary: "#3E63DD"
  primary-hover-light: "#3358D4"
  primary-hover-dark: "#5472E4"
  primary-on: "#FFFFFF"
  link-light: "#3A5BC7"
  link-dark: "#9EB1FF"
  window-light: "#F4F4F4"
  sidebar-light: "#ECECEC"
  overlay-light: "#FBFBFC"
  window-dark: "#101012"
  sidebar-dark: "#0B0B0D"
  card-dark: "#17171A"
  overlay-dark: "#1C1C1F"
  ink-light: "#282A30"
  ink-secondary-light: "#4C5159"
  ink-faint-light: "#6A7077"
  ink-dark: "#E8EAED"
  ink-secondary-dark: "#9DA4AE"
  ink-faint-dark: "#838993"
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

克制、安静、舒服，表面与文字取 Linear 的冷灰基调。主题色 Radix indigo，中性色 Radix slate。

优先级：解决问题 > 易于使用 > 好看美观。界面靠布局和控件本身说话，不靠说明文字和装饰。

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

强调色用 Radix 的 `indigo`。`index.html` 与 `ThemeRoot` 的 `data-accent-color="indigo"` 把它映射到 `--accent-*`。

- `--primary`：第 9 级。实心主按钮的底，文字用 `--primary-foreground`（白）。
- `--link`、`--info`、焦点环：第 11 级。深色下文字类用法必须用第 11 级。
- 一页只出现一个 solid 主按钮，其余用 soft 或 ghost。

### 中性色

中性色用 Radix 的 `slate`（`data-gray-color="slate"`），描边与 rt 基础件的灰阶跟着它走；表面与文字是下表的固定值，取自 Linear 基调。

| 层                             | 浅色                      | 深色                      | token                           |
| ------------------------------ | ------------------------- | ------------------------- | ------------------------------- |
| 窗口、主区                     | `#F4F4F4`                 | `#101012`                 | `--background`                  |
| 侧栏（主侧栏、抽屉、设置导航） | `#ECECEC`（比主区深一档） | `#0B0B0D`（比主区深一档） | `--sidebar`                     |
| 代码块                         | `#F7F8F8`                 | `#0B0C0D`                 | `--code-background`             |
| 卡片                           | `#F7F8F8`                 | `#17171A`                 | `--card`                        |
| 输入卡                         | `#FFFFFF`                 | `#17171A`                 | `--composer-background`         |
| 浮层                           | `#FBFBFC`                 | `#1C1C1F`                 | `--popover`                     |
| 按钮与行悬停 / 选中            | `#F1F2F4` / `#FFFFFF`     | `#121728` / `#1A2143`     | `--btn-hover`、`--btn-selected` |

文字只有三级，都走 `--contrast-foreground*` 派生层：

| 级  | 浅色      | 深色      | 用途              |
| --- | --------- | --------- | ----------------- |
| 主  | `#282A30` | `#E8EAED` | 正文、标题        |
| 次  | `#4C5159` | `#9DA4AE` | 次要信息          |
| 弱  | `#6A7077` | `#838993` | 非必要信息，≥ 3:1 |

描边只有 `--border`（gray-a6）与 `--border-soft`（gray-a5）。分割线只用 1px `--border-soft`。

### 状态色

文字色（`--success`、`--info`、`--warning`、`--danger`）配同色相浅底（`--*-bg`）。成功取 Radix green 第 11 级与第 3 级 alpha，信息文字取 accent 第 11 级；警告、危险与信息底用项目自定色值，深浅各一套。不用实色填充，不加光晕。状态色只在真有状态时出现。

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
| `--text-heading` | 20      | 20   | 20   | 页面大标题                     |
| `--text-code`    | 13 等宽 | 12   | 14   | 代码、路径、快捷键             |

- 字重只用 400、500、600。
- `--text-monogram`、`--text-glyph` 是图形尺寸，不算字号。
- 对话区 Markdown 排版对齐 cc-wrapper，不受四档约束。

## 圆角

| token               | 值   | 给谁                                 |
| ------------------- | ---- | ------------------------------------ |
| `--radius-control`  | 6    | 按钮、输入框、标签、菜单项、侧栏行   |
| `--radius-card`     | 10   | 卡片、面板、代码块、图片、下拉、浮层 |
| `--radius-dialog`   | 14   | 对话框                               |
| `--radius-composer` | 19.2 | 输入卡                               |
| `--radius-pill`     | 9999 | 胶囊、圆形按钮                       |

- rt 的 `--radius-1..6` 在 `rt.css` 接到这三档。
- 嵌套写 `calc(外层 - 内边距)`；结果太小时用 `max()` 兜到 `--radius-control` 的一半。rt 菜单本身同心：外 10、内边距 4、项 6。

## 阴影与层级

| token               | 给谁                                               |
| ------------------- | -------------------------------------------------- |
| `--shadow-popover`  | 下拉、菜单、提示、悬停卡、拖拽中的行、滚动到底按钮 |
| `--shadow-dialog`   | 对话框、抽屉、图片预览                             |
| `--shadow-composer` | 输入卡：浅色 4px/18px 柔投影，深色 6px/24px 深投影 |

- rt 的 `--shadow-4/5` 接 popover；`--shadow-6` 留 rt 原值，rt 对话框用它画外环与阴影。
- 浮层底色是实色 `--popover`（`.surface-float`），不透明，不模糊。
- 卡片用 1px `--border` 描边、不铺底；描边与底色差只用一种。
- 焦点环：`--focus-ring` = 2px 实色第 11 级；危险态 `--focus-ring-danger`。

## 间距与尺寸

- 间距基数 4px：`--space-xxs/xs/sm/md/lg/xl/xxl` = 4/8/12/16/24/28/32。
- 控件 40px（`--size-control`），图标按钮 28px，侧栏行 28px，图标 14px。
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
