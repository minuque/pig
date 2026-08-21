# UI Guidelines

## 1. UI 依赖

Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + VueUse + markstream-vue + vue-router。

- Vue 负责 UI state 与组件接线。
- Vue SFC 顶层区块顺序为 `template` → `script` → `style`。
- `@earendil-works/pi-client` 的 `RemoteSession` 是 Session 操作入口。
- markstream-vue 渲染 transcript 内容。

## 2. 信息架构

工作台有两个区域：

1. 左栏：已授权工作目录，以及按 cwd 分组的其它 Pi Session。
2. 中央：当前 Session 的 Transcript、phase、Prompt、Steer 与 Abort 操作。

Session 切换由 `/sessions/:sessionId` 路由驱动。

## 3. 核心旅程

```text
授权工作目录
  → 选择或创建 Session
  → 查看 Transcript
  → 发送 Prompt
  → 根据 phase 查看实时进度
  → 运行中 Steer 或 Abort
  → phase 回到 idle
```

## 4. 当前产品契约

### 布局

两栏铺满，无第三栏。≥901px 左栏收成 rail（56px，macOS 桌面 90px）。移动端左栏为抽屉。

### 表面

侧栏不透明 `canvas-soft`，对话列不透明 `surface`。视觉跟 `DESIGN.md`：浅色冷蓝灰，深色近灰工作台，sunset/dusk 只做装饰。

### 启动等待态

- 每次完整加载逐帧播放 Pi 组装动画。落块关键帧之间平滑补间，消行与闪烁保持离散。
- 初始化完成前隐藏工作台与 Session 内容，各平台用不透明 `surface`。
- 退出时 Logo 缩小淡出，遮罩与工作台交叉淡变。

### 桌面壳

- Electron 无原生 File 菜单。macOS hiddenInset，Windows `titleBarStyle: hidden` + caption overlay，Linux 无框。
- 窗体不透明（无 vibrancy/acrylic）。毛玻璃只给输入卡和菜单。
- URL `?pig-desktop-platform=` 只开 drag / 输入卡毛玻璃。浏览器无该参数则无铬层。
- 关窗即退出并释放 Gateway，不驻留托盘。

### Transcript

- 主列连续排版。Assistant Message 无卡片背景。
- User Message 右对齐，primary 蓝胶囊：按内容收缩，最长约内容列 86%，文字 on-primary。
- User 图片在胶囊下方同一右栏，限宽，点击 Dialog 放大。
- Assistant Message 通栏 markstream，15px / 行高 1.7。思考默认折叠。助手条目不含 toolCall。
- Tool Call 默认：状态图标、名称、截断入参。展开后完整入参与输出，顶栏可复制。
- 长 Assistant Message 用 markstream 节点虚拟滚动。
- 视口 ≥1400px：正文与输入卡同宽，占主栏 60%。

### Session

- 重命名走 Pi `SessionManager.appendSessionInfo`。删除只删 Pi 会话文件。不自建第二套 Session 库。
- 模型仅 `idle` 时可改。运行中禁用 ModelPicker 与 ThinkingLevelSelect。
- 列表真相在 Pi。默认按会话维平铺，创建时间新→旧，活动不重排。
- 工作目录只做顶部筛选（「全部工作目录」）。搜索按标题过滤，命中后换成单行结果。
- 卡片三行：目录名 + 相对时间、标题、消息数 + 当前模型（space-between）。
- 侧栏底设置齿轮占位。折叠钮旁 pig 标回 `/`。

### 顶栏

Session 标题 + 淡 cwd 名。右上 ThemeToggle。thinking 为 off 时不显示芯片。phase / 连接只在非 idle 显示。

### ChatInput

- 有 Transcript 时输入卡绝对贴对话列底部，transcript 通栏滚动。
- 欢迎页和 idle 空 Session：居中短句「在 {目录名} 开始」，输入卡在标题下（不 dock）。
- 欢迎页目录名可切换。空 Session 用 session cwd，缺则 lastCwd。
- 桌面输入卡和模型/思考菜单：backdrop-filter（blur 12px / 深色 16px，填充 80%）。
- 浏览器输入卡和菜单用不透明 `canvas-soft`。`prefers-reduced-transparency` 时桌面同样回退。
- dock 不铺实底。模型与思考选项在左，primary 发送圆钮在右。

### Gateway

- 正常时无常驻指示。连接中不挡欢迎/对话页，只在顶栏给一句状态。错误用 banner。
- 启动链接携带 bootstrap secret。同一 secret 在 Gateway 生命周期内重复兑换得到同一凭证。页面兑换成功后清 URL hash。

## 5. 浏览器验收

浏览器验收交给用户；除非用户明确要求，否则不启动服务。
