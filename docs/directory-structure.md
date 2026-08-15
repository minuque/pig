# 目录结构规范

## 1. 仓库顶层（monorepo）

pnpm workspace 管理三个包：

- `apps/web/` — Web 前端（Vue 3 + TypeScript + Vite）
- `apps/desktop/` — Electron 桌面壳（main / preload）
- `packages/gateway/` — 本地 Gateway（auth / native / pi / server）

## 2. apps/web/src 分层

```
apps/web/src/
├── app/          # 应用入口与全局状态（App.vue、app.css、hooks/use-app.ts）
├── client/       # 平台接入（PiClient、HTTP、transport、workspace）
├── components/   # 跨域共享组件
│   ├── layout/   #   壳层布局（AppLayout）
│   └── ui/       #   shadcn-vue 基础组件（dropdown-menu、tooltip、badge）
├── features/     # 领域功能模块
├── router/       # 路由
└── utils/        # 通用工具（cn 等）
```

- `components/` 只放跨域共享的 `layout` 与 `ui`；领域组件一律进 `features/`。
- `client/` 是 platform concern（网络、bootstrap、目录选择），不进入 Agent Domain。

## 2.1 test 目录

`test/` 镜像 `src/` 分层，按被测模块分目录：

```
apps/web/test/
├── chat-input/          # 对应 features/chat-input
├── session-nav/         # 对应 features/session-nav
├── session-workbench/   # 对应 features/session-workbench
├── client/              # 对应 src/client
├── layout/              # 对应 src/components/layout
├── router/              # 对应 src/router
└── app/                 # 对应 src/app 与 src 根
```

- 测试文件随被测模块同目录；别名 import（`@features/...` 等）不受目录层级影响。
- 测 `src` 根文件的用例用相对路径（如 `../../src/desktop-marker.js`）。

## 3. features/ 模块排版规范

每个 feature 是一个自包含的领域模块，入口组件收敛为 `index.vue`，其余按职责分目录：

```
features/<module>/
├── index.vue        # 模块入口组件（唯一）
├── components/      # 模块私有视图组件
├── hooks/           # 模块私有 composable
├── <logic>.ts       # 纯逻辑：类型投影、格式化、状态机（平铺根目录）
└── types.ts         # 模块类型
```

规则：

1. 入口组件必须是 `index.vue`，不放根目录其它视图组件。
2. 视图组件收进 `components/`。
3. composable 收进 `hooks/`。
4. 纯逻辑（类型、格式化、投影、状态）平铺根目录，用明确文件名（如 `transcript-format.ts`、`session-state.ts`）。
5. 跨模块引用用别名 `@features/<module>/...`，不写相对路径；模块内引用可用相对路径。
6. 一个 feature 只做一件领域事；耦合两个功能的模块应拆成两块（如 `session-nav` / `session-workbench`）。
7. 跨模块共享的类型放被依赖方（如 workspace 类型在 `session-nav`，`session-workbench` 引用它）。

## 4. 现有模块

| 模块                | 职责                                                         |
| ------------------- | ------------------------------------------------------------ |
| `chat-input`        | 对话输入卡：PromptEditor、模型/思考强度选择、发送、错误提示     |
| `session-nav`       | 左侧导航：会话列表、workspace 分组、虚拟列表、会话标题/时间工具 |
| `session-workbench` | 会话工作台：转录视图、对话轮、欢迎页、控制栏、session 运行时    |
| `mascot`            | 吉祥物：状态→表情映射、弹簧过渡、Canvas 绘制                     |
| `theme`             | 主题切换                                                     |

## 5. 边界原则

- `components/ui/` 只承接 shadcn-vue 生成的基础组件；业务样式不回流到这里。
- 新增 feature 前先确认是否属于既有模块；领域边界不清时拆新模块而非塞进 `components/`。
