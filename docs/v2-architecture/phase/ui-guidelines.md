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

工作台采用三个主要区域：

1. Workspace 与 Session 导航。
2. 当前 Session 的会话记录（Transcript）与实时活动。
3. Prompt 输入及当前 Run 操作。

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
