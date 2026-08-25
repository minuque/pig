# UI Guidelines

## 依赖与接线

Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + VueUse + markstream-vue + vue-router。

- Vue 管 UI state 与组件接线。SFC 区块顺序：`template` → `script` → `style`。
- `src/components/` 只放布局壳与 shadcn-vue 基础件。领域 UI 进 `features/`。交互走 `@components/ui`（reka 包在这一层）。
- 增改 shadcn-vue 基础件：`pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`。装完对齐 `@utils/utils.js`、`lucide-vue-next`；token 已改过的包装不要 `--overwrite`。
- Session 操作入口是 `@earendil-works/pi-client` 的 `RemoteSession`。
- transcript 用 markstream-vue。视觉 token 以 `DESIGN.md` 为准。

## 信息架构

两栏：左栏会话列表（按项目或更新时间分组），中央 Transcript / phase / Prompt / Abort。无第三栏。

Session 切换由 `/sessions/:sessionId` 驱动。

```text
授权工作目录 → 选择或创建 Session → 查看 Transcript
  → 发送 Prompt → 运行中可 Abort → phase 回到 idle
```

## 产品契约

会话交互优先。不做 git 版本管理、内置终端、内置浏览器。这些能力走 Pi Extension，不进 pig core。

### 布局与表面

两栏铺满。≥901px 左栏收成 rail（56px，macOS 桌面 90px）。移动端左栏为抽屉。

侧栏 `sidebar`（浅色等同 `canvas-soft`），对话列 `surface`，均不透明。sunset / dusk 只做装饰。

原生 `button` 只做 reset：透明、无 padding、无 min-height、无主色。主色圆钮和图标钮在使用处显式写宽高与色。不要把 CTA 药丸写在 `button` 元素选择器上。

### 启动

完整加载播 Pi 组装动画，与 boot 并行。积木落定后在 Logo 下打出标语 There are many agent harnesses / but this one is yours。标语用系统衬线斜体（Georgia / Palatino），heading-3；yours 用 primary、加粗。标语打完即进工作台。遮罩背景不透明 `surface`。退出时 Logo 与标语缩小淡出，遮罩与工作台交叉淡变。

bootstrap / connect / initialize 失败进 `/error`（含连接超时）。已连接后的连接错误用 `StartupError`：icon + 文本居中，侧栏和顶栏仍在。

### 桌面壳

Electron 无原生 File 菜单。macOS hiddenInset；Windows `titleBarStyle: hidden` + caption overlay；Linux 无框。窗体不透明。毛玻璃只给输入卡和菜单。

`?pig-desktop-platform=` 打开 drag 与输入卡毛玻璃。浏览器无该参数则无铬层。关窗即退出并释放 Gateway，不驻留托盘。

### Transcript

主列连续排版。Assistant Message 无卡片背景，通栏 markstream（15px / 行高 1.7），思考默认折叠，条目不含 toolCall。长文用 markstream 节点虚拟滚动。打开或切换 Session 时视口贴底（最新消息）；离开时仍缓存行高，再进入不恢复中间滚动位置。「加载更早」是时间线首行，随列表滚动，不悬浮顶栏。

User Message 右对齐气泡，最长约内容列 86%，底 `--bubble`，文字 `ink`。图片在气泡下方同一右栏，点击 Dialog 放大。

Tool Call 默认：状态图标、名称、截断入参。展开后完整入参与输出，顶栏可复制。

输入卡固定 748px，正文固定 732px 居中，每侧内收 8px；主栏更宽时只加留白，侧栏拖拽不挤压正文。主栏窄于各自固定宽度时随列宽收缩。

### Session

重命名走 Pi `SessionManager.appendSessionInfo`。删除只删 Pi 会话文件。

模型仅 `idle` 时可改。列表按当前分组的活动时间新→旧，改名不重排。无顶部工作目录筛选。细则见 [`prd/session-nav.md`](prd/session-nav.md)。

默认「更新时间」平铺，10 条后「显示更多」每次 +10。可切「项目」：目录名组头不可折叠，每组 5 条，末尾每次 +5。搜索时取消截断。New Task 与搜索是列表上方整行；分组切换与加目录同一行。项目组头可在该目录新建。

卡片两行两列。标题 `caption`。右上时钟 + 相对时间；当前会话 `turn` 时改为 Spinner 并藏时钟。第二行左侧：更新时间分组为项目名，项目分组为消息数；右侧模型名 + VendorMark。无 kebab；右键 / 长按 / Shift+F10 打开重命名与删除。侧栏底设置齿轮占位。折叠钮旁 pig 标回 `/`。侧栏操作失败用右上 Alert。

### 顶栏

Session 标题（`caption`）+ 淡 cwd 名。右上 ThemeToggle。不显示思考强度。phase / 连接只在非 idle 显示。

### ChatInput

有 Transcript 时输入卡绝对贴对话列底部，transcript 通栏滚动。欢迎页和 idle 空 Session：居中「在 {目录名} 开始」，输入卡在标题下、不 dock。欢迎页目录名可切换；空 Session 用 session cwd，缺则 lastCwd。

桌面输入卡和模型/思考菜单：backdrop-filter（blur 12px / 深色 16px，填充 80%）。浏览器用不透明 `composer`。`prefers-reduced-transparency` 时桌面同样回退。dock 铺 `surface` 挡住底部透出，顶部不留着色 padding，右侧让出滚动条。模型与思考在左，primary 发送圆钮在右。

输入卡下方状态条只显示当前工作目录（Folder + 末段名）和上下文占用环，不展示 git / 主机等其余项。点击占用环在输入卡上方展开估算面板：百分比、已用/窗口 token，以及系统提示词、记忆、Skills、Tool 定义、Tool 结果、当前会话上下文、其他、空闲。可预览的分段点击后弹框看原文。欢迎页不展示该状态条。

### Gateway

正常时无常驻指示。连接中不挡页面，只在顶栏给一句状态。错误走主栏空画布，与启动失败同款。

启动链接携带 bootstrap secret。同一 secret 在 Gateway 生命周期内重复兑换得到同一凭证。页面兑换成功后清 URL hash。
