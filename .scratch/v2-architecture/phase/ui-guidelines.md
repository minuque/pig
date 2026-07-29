# UI Guidelines

Status: proposed

本文定义跨阶段稳定的 UI 原则。具体实现范围和验收门槛由各阶段文档中的 `UI Scope` 决定。

## 1. Information Architecture

工作台采用三个主要区域：

1. Workspace 与 Session 导航。
2. 当前 Session 的会话记录（Transcript）与实时活动。
3. Prompt 输入及当前 Run 操作。

窄屏可以通过抽屉或分层页面呈现相同结构，但不得丢失当前 Session 和 Run 的上下文。

## 2. Core User Journey

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

非常用设置和诊断信息不得阻塞该旅程。

## 3. State Language

界面统一使用以下用户可见状态：

- Session：`Available`、`Unavailable`。
- Run：`Queued`、`Running`、`Cancelling`、`Completed`、`Failed`、`Cancelled`、`Interrupted`。
- Connection：`Connecting`、`Online`、`Reconnecting`、`Offline`。
- Service：`Starting`、`Ready`、`Stopping`、`Unavailable`。

实现尚未支持的状态不得提前伪造；同一状态不得在不同页面使用不同术语。

## 4. Interaction Principles

- Session 切换不得混淆草稿、实时内容或 Run 状态。
- 流式内容在原位置更新，不为每个 token 创建独立视觉元素。
- 用户正在阅读历史时不得强制滚动；提供“跳转到最新”。
- 破坏性操作必须说明影响范围，并要求明确确认。
- 禁用操作应尽可能说明原因，而不是仅降低透明度。
- 异步命令必须提供即时反馈，并防止无意重复提交。
- 错误提示应包含发生了什么、用户可以做什么及稳定关联信息。

## 5. 会话记录渲染

- Markdown、代码和链接按不可信内容处理。
- 不执行模型生成的 HTML、脚本或事件属性。
- Prompt、思考、工具活动、工具结果和普通回复应具有清晰的信息层级。
- 长工具内容默认可折叠，展开状态属于客户端临时状态。
- 复制代码或文本不得隐式复制隐藏内容。

## 6. Design Foundations

Phase 0 只建立最小设计变量，后续阶段在不改变语义的前提下扩展：

- 颜色：背景、表面、正文、弱化文本、边框、强调、成功、警告、危险。
- 间距：使用有限且一致的 spacing scale。
- 字体：正文与等宽代码字体分离。
- 形状：统一圆角、边框和控件高度。
- 状态：不能只依赖颜色表达。

组件应优先表达产品语义，避免在首版建立庞大的通用组件库。

## 7. Accessibility Baseline

所有阶段都必须满足：

- 原生按钮、输入框和链接优先。
- 交互控件具有可访问名称。
- 键盘可以到达核心操作。
- 焦点可见，弹层关闭后焦点返回合理位置。
- 实时 token 不逐个触发屏幕阅读器播报。
- 文本和状态信息不能仅依赖颜色区分。

Phase 3 再执行完整键盘旅程、语义、对比度和多主题发布门禁。

## 8. Responsive Baseline

- 宽屏优先支持导航与会话内容同时可见。
- 窄屏允许隐藏导航，但当前 Session、Run 状态和输入区必须保持可访问。
- 不以固定像素宽度假设会话记录或代码内容。
- 横向溢出的代码块独立滚动，不撑破页面。

## 9. Non-goals

- 首版不追求完整设计系统或通用组件平台。
- 不以复杂动画替代状态反馈。
- 不信任或直接渲染 Pi、模型及工具返回的 HTML。
- 不在 Phase 0 实现 pixel-perfect screenshot 门禁。

## 10. UI 依赖选型（Phase 0 最终确定）

**核心栈：** Vue 3 + TypeScript + Vite + Tailwind CSS + shadcn-vue + lucide-vue-next + vueuse + markstream-vue + vue-router

### 详细说明

- **框架**：Vue 3 + TypeScript + Vite（轻量、编译后 bundle 极小，shallow reactivity 适合 session/transcript 状态）
- **样式**：Tailwind CSS（快速实现 DESIGN.md 驱动的 token 系统：CSS var 完全映射 primary/canvas-soft/hairline/r-lg 等）
- **组件库**：shadcn-vue（组件生态完整，高度适配 token 设计体系）
- **路由**：vue-router（支持 session 切换、标签页、抽屉导航）
- **图标**：lucide-vue-next
- **状态管理**：vueuse（当前阶段足够）
- **流式输出**：markstream-vue（AI SSE 对话核心）
- **可选**：vue-virtual-scroller（长 transcript 虚拟滚动）

### 集成顺序

1. 安装依赖：`pnpm add vue@3 typescript@5 tailwindcss@3 @tailwindcss/typography shadcn-vue lucide-vue-next vueuse markstream-vue vue-router`
2. 创建 `router/index.ts` 并注册 routes
3. Tailwind 配置 + markstream-vue CSS import（layer(components)）
4. markstream-vue 模式选择（mode="chat" + smooth-streaming="auto"）
5. shadcn-vue 组件集成

### 理由

符合本地优先 Pi Agent 工作台的轻量克制定位（Notion 式暖纸底、单一蓝、hairline），不选 React/Svelte/Reka UI（bundle 或生态不匹配）。

此选型已写入 DESIGN.md 约束，可直接用于原型变体 A/B/C 布局。
