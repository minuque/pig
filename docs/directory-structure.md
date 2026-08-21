# 目录结构规范

## 1. 仓库顶层（monorepo）

pnpm workspace 管理三个包：

- `apps/web/` — Web 前端（Vue 3 + TypeScript + Vite）
- `apps/desktop/` — Electron 桌面壳（main / preload）
- `packages/gateway/` — 本地 Gateway（auth / pi / server；目录选择端口在 `src/directory.ts`）

## 2. apps/web/src 分层

```
apps/web/src/
├── App.vue       # 组合根
├── style/        # 全局样式（reset.css、app.css tokens）
├── client/       # 平台接入
│   ├── bootstrap.ts  # 启动授权与凭证存取
│   ├── http.ts       # platformRequest / 错误文案
│   ├── transport.ts  # Browser WebSocket → ByteTransport
│   ├── pi-client.ts  # PiClient 生命周期、响应式投影、退避重连
│   └── local-cwd.ts  # 已授权目录与最近 cwd 的 localStorage 偏好
├── components/   # 跨域共享组件
│   ├── layout/   #   壳层布局（AppLayout）
│   └── ui/       #   shadcn-vue 基础组件（dropdown-menu、tooltip、badge）
├── features/     # 领域功能模块
├── router/       # 路由
└── utils/        # 通用工具（cn 等）
```

- `App.vue` 只接线：`usePiClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再 bootstrap / connect / 挂路由会话。组合根用参数传递，不包一层 Platform。
- 子树只拿两把钥匙：`useSession()` / `useNav()`。不写创建/发送/重命名等领域规则。
- `client/` 是 platform concern（网络、凭证、传输、本地目录偏好），不进入 Agent Domain；也不再导出名为 Platform 的组合对象。
- `components/` 只放跨域共享的 `layout` 与 `ui`；领域组件一律进 `features/`。

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
└── app/                 # 对应 src 根（App.vue、desktop-marker 等）
```

- 测试文件随被测模块同目录；别名 import（`@features/...` 等）不受目录层级影响。
- 测 `src` 根文件的用例用相对路径（如 `../../src/desktop-marker.js`）。

## 3. features/ 模块排版规范

每个 feature 是一个自包含的领域模块，入口组件收敛为 `index.vue`，其余按职责分目录：

```
features/<module>/
├── index.vue        # 模块入口组件（唯一视图入口）
├── index.ts         # 模块对外组合：provide / use（有跨树共享时才建）
├── types.ts         # 对外契约；仅本模块用的类型可放 lib/
├── components/      # 模块私有视图组件
├── hooks/           # 模块私有 composable
└── lib/             # 纯逻辑：投影、格式化、预设、绘制、会话 UI 状态
```

规则：

1. 入口组件必须是 `index.vue`，不放根目录其它视图组件。跨模块引用视图写 `index.vue`，引用组合写 `index.js`，不要省略文件名。
2. 视图组件收进 `components/`。
3. composable 收进 `hooks/`。模块级 `provide` / `use` 放根目录 `index.ts`，不进 `hooks/`。
4. `lib/` 只放**有两处及以上生产消费**的纯逻辑（投影、格式化、预设表）。单点消费的函数放回对应 `.vue` / `hooks/`，不要为测试单独抽文件。根目录不平铺 `*.ts`（`types.ts` 除外）。小模块没有可复用逻辑时不建 `lib/`。
5. `lib/` 是技术桶，不按子领域再切；状态机也只是其中的文件，不另开 `model/`。
6. 跨模块引用用别名 `@features/<module>/...`，不写相对路径；模块内引用可用相对路径。
7. 一个 feature 只做一件领域事；耦合两个功能的模块应拆成两块（如 `session-nav` / `session-workbench`）。
8. 跨模块共享的类型放被依赖方（如 workspace 类型在 `session-nav`，`session-workbench` 引用它）。

## 4. 现有模块

| 模块                | 职责                                                         |
| ------------------- | ------------------------------------------------------------ |
| `chat-input`        | 对话输入卡：PromptEditor、模型/思考强度选择、发送、错误提示     |
| `session-nav`       | 左侧导航：会话平铺列表、工作目录筛选、会话标题/时间工具 |
| `session-workbench` | 会话工作台：转录视图、对话轮、欢迎页、控制栏、session 运行时    |
| `startup-wait`       | 首次加载等待态：Pi 组装动画、启动阶段和离场                       |
| `theme`             | 主题切换                                                     |

## 5. 边界原则

- `components/ui/` 只承接 shadcn-vue 生成的基础组件；业务样式不回流到这里。
- 新增 feature 前先确认是否属于既有模块；领域边界不清时拆新模块而非塞进 `components/`。
