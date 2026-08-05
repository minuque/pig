# UI Guidelines

## 1. UI 依赖选型

**核心栈：** Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + vueuse + markstream-vue + vue-router

### 详细说明

- **框架**：Vue 3 + TypeScript + Vite（轻量、编译后 bundle 极小，shallow reactivity 适合 session/transcript 状态）
- **样式**：Tailwind CSS（快速实现 DESIGN.md 驱动的 token 系统）
- **组件库**：shadcn-vue（组件生态完整，高度适配 token 设计体系）
- **路由**：vue-router（支持 session 切换、标签页、抽屉导航）
- **图标**：lucide-vue-next
- **状态管理**：vueuse（当前阶段足够）
- **流式输出**：markstream-vue（AI SSE 对话核心）
- **可选**：vue-virtual-scroller（长 transcript 虚拟滚动）

## 2. Information Architecture

工作台采用两个主要区域（右栏 ContextPanel 已裁切，见 `docs/adr/0001-drop-context-panel.md`）：

1. 左栏：Workspace 与 Session 导航。
2. 中央：当前 Session 的会话记录（Transcript）、实时活动、Prompt 输入及 Run 操作。

Session 切换由路由驱动（`/sessions/:sessionId`，见 `docs/adr/0002-router-driven-session-switching.md`）。

## 3. Core User Journey

核心旅程保持为：

```text
授权 Workspace
  → 选择或创建 Session
  → 查看会话记录
  → 输入 Prompt
  → 查看实时活动
  → Steer 或 Cancel
  → Run 完成
```

## 4. 打磨规格（当前轮）

- **布局**：两栏（左导航可折叠 + 中央 chat），无右栏；桌面优先，移动端左栏为抽屉。
- **Session 切换**：路由驱动 `/sessions/:sessionId`；`/` 渲染空态视图（HomePage 死代码删除）。
- **样式**：手写 CSS + token（Tailwind v4 `@theme` 已映射），shadcn 按需摘抄。
- **动效**：状态驱动（press 缩放 0.98、disabled、focus-ring 统一、loading shimmer）+ 入场（transcript 切换 blur-in 280ms `--ease-out`、左栏抽屉位移过渡 `--ease-smooth`）。不做新消息入场动效。
- **Transcript**：用户消息 surface 卡片、Agent 消息通栏；思考/工具活动默认折叠为摘要行（工具名+状态），grid-rows 展开；Run 终态标记“已并入”并收拢动画。
- **Session 列表**：卡片 kebab 菜单（重命名/删除，删除需确认 dialog）。
- **Gateway 状态**：正常态无常驻指示，仅错误 banner。
- **延后项**：虚拟滚动、消息操作（复制/重跑）、拖拽物理、落地页引导。
