# 布局密度与 design-lab 整页预览

把「界面字号 s/m/l」换成「布局密度 compact/normal」：compact 同时收紧字号、间距和控件高度；删掉组件的 `l` 尺寸。design-lab 的「业务」分组加一个整页，用 mock 数据拼出 pig 主界面，一页看全会话场景。

## 为什么

三档字号只改三个文字 token，`l` 用得少，组件 `l` 变体是额外维护面。用户要的是「紧凑 / 标准」两种外观布局，紧凑应当整体变密，而不只是字变小。业务 demo 现在一个组件一页，看不到组件拼在一起时的间距、层级和密度。

## 目标

1. 偏好 `uiSize: "s" | "m" | "l"` 换成 `density: "compact" | "normal"`，默认 `normal`。
2. `normal` = 现在的 `m`，视觉零变化。`compact` = 字号取现在的 `s`，间距、控件高、行高、头部高一起收紧。
3. `@pig/ui` 的 `Size` 收成 `"s" | "m"`，删除所有组件的 `l` 变体样式和 demo。
4. design-lab 顶栏加密度切换，任何 demo 页都能切 compact 预览。
5. design-lab「业务」分组新增「整页」，静态拼出侧栏 + 会话 + 输入卡 + 右栏，覆盖主要状态。

## 非目标

- 整页不能真的发送、切会话、分屏（用户选了只看全状态的方案 A）。
- 不改图标尺寸、圆角、代码字号（`codeSize` 是独立偏好）、`--content-width`。
- 不做旧偏好迁移：存着 `s` / `m` / `l` 的用户回到 `normal`（我的判断）。

## 密度取值

`normal` 列是现值，不动。`compact` 列是我的判断，落地后在 design-lab 里对着整页调。

| token | normal | compact |
| --- | --- | --- |
| `--text-meta/body/title` | 12/14/16 | 11/13/15 |
| `--spacing`（`--space-*` 由它派生） | 4px | 3.5px |
| `--control-sm/md/lg` | 28/32/36 | 24/28/32 |
| 新增 `--control-xs`（图标按钮 `s`、侧栏小行） | 24 | 20 |
| `--header-height` | 44 | 40（macOS 仍取 `--titlebar-inset`） |

`IconButton` 的 `s` 现在借用 `--space-lg` 当高度，改读 `--control-xs`；`m` 继续读 `--control-sm`，于是图标按钮 `s`/`m` 在 compact 下是 20/24。

规则：compact 的固定高度一律比 normal 小 4px。组件和业务样式里写死的行高（例如 `SessionItem` 的 36px、`SessionList` 的 28px、`SessionSection` 的 32/36px）改读 token 或由 token 推出，否则它们不会跟着变密。哪些写死值要收进 token，由实现者按「切到 compact 后肉眼看得出没变」来判定。

## 实现要点

- `html[data-density="compact"]` 覆盖上表 token，放在 `packages/ui/src/styles/tokens.css`，替换现在的 `html[data-ui-size]` 两段；应用层 token（`--header-height` 等）的 compact 值放 `apps/web/src/style/tokens.css`。
- 数据路径：`packages/protocol` 类型 → `packages/gateway` 的 preferences 默认值与校验 → `apps/web/src/client/preferences.ts`（key `pig.density`）→ `use-appearance-prefs.ts` 写 `dataset.density` → `AppearancePane` 和 `SettingsDialog` 搜索项 → i18n。
- 设置文案（我的判断）：标题「布局密度 / Layout density」，说明「控件、间距和文字的疏密。/ Spacing, control and text size.」，选项「标准 / Normal」「紧凑 / Compact」。
- `Size` 去掉 `l` 后，业务里 4 处 `size="l"`（3 处 `Spinner`、`ProviderLoginPanel` 的 `Card`）改成 `m`。`--control-lg`、`--icon-lg` 仍有非 `l` 用处，保留。
- `docs/DESIGN.md`「间距与尺寸」一节改成 normal / compact 两组值，去掉 `l`。
- 测试只改现有用例里的默认值（`uiSize: "m"` → `density: "normal"`），以及 gateway 对非法值回落默认的用例；不为 token 取值写测试。

## 整页预览

- 入口：`业务` 分组第一项「整页 / Full page」，路径 `/design/full-page`；原有单组件 demo 保留。
- 组成：真实的 `AppLayout` 外壳，侧栏、会话、输入卡、右栏用各自吃 props 的叶子组件（`SessionList` / `SessionItem`、`TurnRow` 等）配 `fixtures.ts` 数据拼装。只靠 `useNav()` / `useSession()` / `useSessionRail()` 注入的容器不直接挂，改挂它下面吃 props 的子组件；不为 design-lab 伪造整个 session / nav 上下文（我的判断：伪造上下文等于做方案 B）。
- 覆盖状态：
  - 侧栏：多个工作区分组，会话含运行中、未读、置顶、出错、普通。
  - 会话：带附件和引用的用户消息、思考、工具组（完成 / 运行中 / 失败）、Markdown 正文（标题、列表、代码、表格、mermaid）、`TimelineEventDemo` 里的全部会话事件、排队消息。
  - 输入卡：有草稿、模型选择器、上下文环。
  - 右栏：环境、上下文、任务三节都展开。
- 单文件不超 500 行：页面拆成侧栏 / 会话 / 右栏几个 demo 私有组件，fixture 继续放 `lib/fixtures.ts`（超长就按区域拆文件）。

## 留给实现者

- compact 下具体哪些写死尺寸收进 token、收成什么名字。
- 整页里某个叶子组件如果离开注入就渲染不了，选它更下一层的子组件；实在没有可用的子组件就在整页里略过该区域并在交付时说明。

## 验收

- 设置里切换两档，主界面字号、间距、控件高、侧栏行高、头部高同时变化；normal 截图与改动前一致。
- `@pig/ui` 里搜不到 `data-size="l"` 和 `Size` 的 `"l"`。
- design-lab 顶栏切 compact，整页和所有 demo 跟着变；整页一屏内能看到上面列出的状态。
- `pnpm fix:touched` → `pnpm check:touched` 通过。

## 产物

无 artboard / 文档 artifact；决定都在本文件和 2026-11-24 的对话里：用户确认间距和高度也要随 compact 调整，整页预览选方案 A（只看全状态）。
