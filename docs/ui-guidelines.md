# UI Guidelines

## 1. UI 依赖

Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + VueUse + markstream-vue + vue-router。

- Vue 负责 UI state 与组件接线。
- Vue SFC 顶层区块顺序为 `template` → `script` → `style`。
- `@earendil-works/pi-client` 的 `RemoteSession` 是 Session 操作入口。
- markstream-vue 渲染 transcript 内容。
- WebSocket、bootstrap、目录选择属于 platform concern，不进入 Agent Domain。

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

- **布局**：两栏铺满；≥901px 左栏折叠为 rail（56px，macOS 桌面 90px），移动端左栏为抽屉。无第三栏。
- **表面**：侧栏不透明 `canvas-soft`，对话列不透明 `surface`。视觉跟 `DESIGN.md`：浅色冷蓝灰，深色近灰工作台，装饰 sunset/dusk。
- **启动等待态**：每次完整加载逐帧播放 Pi 组装动画，落块关键帧之间平滑补间，消行与闪烁保持离散。初始化完成前隐藏工作台。各平台使用不透明 `surface`。所有平台均隐藏 Session 内容。退出时 Logo 缩小淡出，遮罩与工作台交叉淡变。
- **桌面壳**：Electron 无原生 File 菜单。macOS hiddenInset，Windows `titleBarStyle: hidden` + caption overlay，Linux 无框。窗体不透明（无 vibrancy/acrylic），输入卡和菜单才能用 CSS 毛玻璃。URL `?pig-desktop-platform=` 只开 drag / 输入卡毛玻璃，浏览器无参数则无铬层。
- **Transcript**
  - 主列连续排版，不给 Assistant Message 添加卡片背景。
  - User Message 右对齐，使用 primary 蓝胶囊。宽度按内容收缩，最长约为内容列的 86%，文字使用 on-primary。
  - User Message 的图片放在胶囊下方的同一右栏。图片限制宽度，点击后用 Dialog 放大。
  - Assistant Message 通栏使用 markstream，字号 15px，行高 1.7。思考默认折叠，不显示助手条目中的 toolCall。
  - Tool Call 默认显示状态图标、名称和截断入参。展开后显示完整入参与输出，顶栏提供复制操作。
  - 长 Assistant Message 使用 markstream 节点虚拟滚动。
  - 视口宽度不小于 1400px 时，正文与输入卡同宽，占主栏 60%。
- **Session 操作**：重命名走 Pi `SessionManager.appendSessionInfo`；删除只删 Pi 会话文件。不自建第二套 Session 库。
- **模型**：Session 为 `idle` 时可修改；运行中禁用 ModelPicker 与 ThinkingLevelSelect。
- **Session 列表**：Pi 拥有 Session 真相。默认按会话维平铺（创建时间新→旧，活动不重排），工作目录只做顶部筛选（「全部工作目录」）。搜索按标题过滤，命中时列表换成单行结果。卡片行：目录名 + 相对时间、标题。侧栏底放 ThemeToggle；折叠钮旁 pig 标回 `/`。
- **顶栏**：Session 标题 + 淡 cwd 名；thinking chip；phase / 连接只在非 idle。无主题开关。
- **ChatInput**
  - 有 Transcript 时输入卡绝对贴在对话列底部，transcript 通栏滚动。
  - 欢迎页和 idle 空 Session 居中短句「在 {目录名} 开始」，输入卡在标题下（不 dock）。欢迎页目录名可切换；空 Session 用 session cwd，缺则 lastCwd。thinking 为 off 时顶栏不显示芯片。
  - 桌面输入卡和模型/思考菜单使用 backdrop-filter（blur 12px / 深色 16px，填充 80%）。
  - 浏览器输入卡和菜单使用不透明 `canvas-soft`，不跟桌面玻璃。
  - `prefers-reduced-transparency` 时桌面回退不透明 `canvas-soft`。
  - dock 不铺实底。模型和思考选项放在左侧，primary 发送圆钮放在右侧。
- **Gateway 状态**：正常时不显示常驻指示；连接中不挡欢迎/对话页，只在顶栏给一句状态。错误使用 banner。
- **启动授权**：启动链接携带 bootstrap secret。同一 secret 在 Gateway 生命周期内重复兑换得到同一凭证；页面兑换成功后清除 URL hash。
- **关窗**：桌面关窗仍退出并释放 Gateway，不搬托盘驻留。


## 5. 浏览器验收

浏览器验收交给用户；除非用户明确要求，否则不启动服务。
