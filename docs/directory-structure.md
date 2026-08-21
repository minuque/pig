# 目录结构

pnpm workspace：

- `apps/web/` — Vue 3 + TypeScript + Vite
- `apps/desktop/` — Electron main / preload
- `packages/gateway/` — 本地 Gateway（auth / pi / server；目录选择在 `src/directory.ts`）

## apps/web/src

- `App.vue` 组合根：`usePiClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再把 `connect` / `initialize` 交给启动门。子树只用 `useSession()` / `useNav()`，不写创建/发送/重命名等领域规则。
- `client/` 网络、凭证、传输、本地目录偏好
- `components/layout/` 壳层；`components/ui/` shadcn-vue 基础件
- `features/` 领域模块
- `style/` 全局样式
- `router/` 路由
- `utils/` 通用工具
- `apps/web/test/` 镜像 `src/` 分层。测 `src` 根文件的用例用相对路径。

## features/\<module\>/

```
index.vue        唯一视图入口
index.ts         provide / use（有跨树共享时才建）
types.ts         对外契约；仅本模块用的类型可放 lib/
components/      私有视图
hooks/           私有 composable
lib/             两处及以上生产消费的纯逻辑
```

1. 跨模块引用视图写 `index.vue`，引用组合写 `index.js`，不省略文件名。跨模块用 `@features/<module>/...`，模块内可用相对路径。
2. 模块级 `provide` / `use` 放根目录 `index.ts`，不进 `hooks/`。
3. 单点消费的函数放回对应 `.vue` / `hooks/`，不为测试单独抽文件。根目录不平铺 `*.ts`（`types.ts` 除外）。没有可复用逻辑时不建 `lib/`。
4. `lib/` 不按子领域再切。
5. 一个 feature 只做一件领域事。跨模块共享的类型放被依赖方。

| 模块                | 职责 |
| ------------------- | ---- |
| `chat-input`        | 对话输入卡 |
| `session-nav`       | 左侧导航：会话列表、工作目录筛选 |
| `session-workbench` | 会话工作台：转录、欢迎页、运行时 |
| `startup`           | 启动门、遮罩、失败页 |
| `theme`             | 主题切换 |

`components/ui/` 只放 shadcn-vue 基础件，业务样式不回流到这里。新领域先归既有模块，边界不清再拆 feature。
