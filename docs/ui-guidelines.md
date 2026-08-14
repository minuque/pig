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

1. 左栏：已授权 Workspace，以及按 cwd 分组的其它 Pi Session。
2. 中央：当前 Session 的 Transcript、phase、Prompt、Steer 与 Abort 操作。

Session 切换由 `/sessions/:sessionId` 路由驱动。撤销 Workspace 只修改本地授权偏好，不删除 Pi Session。

## 3. 核心旅程

```text
授权 Workspace
  → 选择或创建 Session
  → 查看 Transcript
  → 发送 Prompt
  → 根据 phase 查看实时进度
  → 运行中 Steer 或 Abort
  → phase 回到 idle
```

## 4. 当前产品契约

- **布局**：两栏铺满；≥901px 左栏折叠为 rail（56px，macOS 桌面 90px），移动端左栏为抽屉。无第三栏。
- **表面**：侧栏默认不透明 `canvas-soft`；桌面窗（darwin/win32）侧栏用 `color-mix(canvas-soft 72%, transparent)` 透出亚克力/vibrancy。对话列始终不透明 `surface`。视觉跟 `DESIGN.md`：浅色冷蓝灰，深色近灰工作台，装饰 sunset/dusk。
- **桌面壳**：Electron 无原生 File 菜单。macOS hiddenInset，Windows `titleBarStyle: hidden` + caption overlay，Linux 无框。仅侧栏接受原生材质。URL `?pig-desktop-platform=` 只开 drag / 玻璃，浏览器无参数则无铬层。
- **Transcript**：主列是文档，不是气泡。用户句克制，助手通栏 markstream；工具一行摘要，思考默认折叠。
- **Session 操作**：重命名走 Pi `SessionManager.appendSessionInfo`；删除只删 Pi 会话文件。不自建第二套 Session 库。
- **计数**：composer 下「N 轮 · M 步」由官方 Transcript 的 user / tool 条数派生，不编造耗时或 token。
- **模型**：Session 为 `idle` 时可修改；运行中禁用 ModelPicker 与 ThinkingLevelSelect。
- **Session 列表**：Pi 拥有 Session 真相。已授权目录优先显示，其它 Session 继续按 cwd 显示。行展示标题 + 相对时间，默认展开 lastCwd（否则第一项）。
- **Composer**：对话列内绝对贴底 overlay，transcript 通栏滚动；与欢迎页共用 PromptEditor 卡。发送钮用 primary。欢迎页在卡上方选工作区。
- **Gateway 状态**：正常时不显示常驻指示；连接中不挡欢迎/对话页，只在顶栏给一句状态。错误使用 banner。
- **启动授权**：启动链接携带一次性 bootstrap secret；兑换成功后清除 URL hash。
- **关窗**：桌面关窗仍退出并释放 Gateway，不搬托盘驻留。

## 5. Upstream gaps

- 消息重跑与虚拟滚动未实现。官方协议具备稳定契约后再接入，不建立第二套状态。

## 6. 浏览器验收

浏览器验收交给用户；除非用户明确要求，否则不启动服务。
