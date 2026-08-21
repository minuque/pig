# UI Guidelines

## 依赖与接线

Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + VueUse + markstream-vue + vue-router。

- Vue 管 UI state 与组件接线。SFC 区块顺序：`template` → `script` → `style`。
- `src/components/` 只放布局壳与 shadcn-vue 基础件。领域 UI 进 `features/`。业务只 import `@components/ui/...`，不直接 import `reka-ui`。
- 新增或更新 shadcn-vue 组件用 CLI，不手抄 registry、不从 GitHub 扒文件：
  `pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`
  装完按仓库习惯改 import（`@utils/utils.js`、`lucide-vue-next`），需要时补 reka 的 `exactOptionalPropertyTypes` cast。已按 DESIGN.md token 改过的包装（如 dropdown-menu、tooltip）不要用 `--overwrite` 整包覆盖。
- Session 操作入口是 `@earendil-works/pi-client` 的 `RemoteSession`。
- transcript 用 markstream-vue。视觉 token 以 `DESIGN.md` 为准。

## 信息架构

两栏：左栏会话列表（顶部按工作目录筛选），中央 Transcript / phase / Prompt / Steer / Abort。无第三栏。

Session 切换由 `/sessions/:sessionId` 驱动。

```text
授权工作目录 → 选择或创建 Session → 查看 Transcript
  → 发送 Prompt → 运行中 Steer 或 Abort → phase 回到 idle
```

## 产品契约

### 布局与表面

两栏铺满。≥901px 左栏收成 rail（56px，macOS 桌面 90px）。移动端左栏为抽屉。

侧栏 `canvas-soft`，对话列 `surface`，均不透明。sunset / dusk 只做装饰。

### 启动

完整加载播 Pi 组装动画，与 boot 并行；Logo 播完即进工作台。遮罩只播 Logo，背景不透明 `surface`。退出时 Logo 缩小淡出，遮罩与工作台交叉淡变。

bootstrap / connect / initialize 失败进 `/error`（含连接超时）。已连接后的连接错误用 `StartupError`：icon + 文本居中，侧栏和顶栏仍在。

### 桌面壳

Electron 无原生 File 菜单。macOS hiddenInset；Windows `titleBarStyle: hidden` + caption overlay；Linux 无框。窗体不透明。毛玻璃只给输入卡和菜单。

`?pig-desktop-platform=` 打开 drag 与输入卡毛玻璃。浏览器无该参数则无铬层。关窗即退出并释放 Gateway，不驻留托盘。

### Transcript

主列连续排版。Assistant Message 无卡片背景，通栏 markstream（15px / 行高 1.7），思考默认折叠，条目不含 toolCall。长文用 markstream 节点虚拟滚动。

User Message 右对齐 primary 蓝胶囊，最长约内容列 86%，文字 on-primary。图片在胶囊下方同一右栏，点击 Dialog 放大。

Tool Call 默认：状态图标、名称、截断入参。展开后完整入参与输出，顶栏可复制。

视口 ≥1400px：正文与输入卡同宽，占主栏 60%。

### Session

重命名走 Pi `SessionManager.appendSessionInfo`。删除只删 Pi 会话文件。

模型仅 `idle` 时可改。列表真相在 Pi：按会话平铺，创建时间新→旧，活动不重排。工作目录只做顶部筛选。

卡片三行：目录名 + 相对时间、标题、消息数 + 当前模型（space-between）。侧栏底设置齿轮占位。折叠钮旁 pig 标回 `/`。侧栏操作失败用右上 Alert。

### 顶栏

Session 标题 + 淡 cwd 名。右上 ThemeToggle。thinking 为 off 时不显示芯片。phase / 连接只在非 idle 显示。

### ChatInput

有 Transcript 时输入卡绝对贴对话列底部，transcript 通栏滚动。欢迎页和 idle 空 Session：居中「在 {目录名} 开始」，输入卡在标题下、不 dock。欢迎页目录名可切换；空 Session 用 session cwd，缺则 lastCwd。

桌面输入卡和模型/思考菜单：backdrop-filter（blur 12px / 深色 16px，填充 80%）。浏览器用不透明 `canvas-soft`。`prefers-reduced-transparency` 时桌面同样回退。dock 不铺实底。模型与思考在左，primary 发送圆钮在右。

### Gateway

正常时无常驻指示。连接中不挡页面，只在顶栏给一句状态。错误走主栏空画布，与启动失败同款。

启动链接携带 bootstrap secret。同一 secret 在 Gateway 生命周期内重复兑换得到同一凭证。页面兑换成功后清 URL hash。

浏览器验收交给用户；除非用户明确要求，否则不启动服务。
