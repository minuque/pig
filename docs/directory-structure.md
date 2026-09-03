# 目录结构

pig 是 Pi Agent GUI：`apps/web` 与 `apps/desktop` 负责 UI，`packages/gateway` 负责平台接入与本地安全。Agent Loop / Session / Model Runtime 由 Pi 拥有。能力走 Pi Extension API，不在 pig 内置 Git、终端、浏览器。

pnpm workspace：

- `apps/web/` — Vue 3 + TypeScript + Vite
- `apps/desktop/` — Electron main / preload
- `packages/gateway/` — Thin Host：平台接入与本地安全

浏览器 UI 旅程在仓库根 `e2e/`（Playwright，跨 Web 构建物与 Gateway），不是 `apps/web/test/` 的模块单测。`pnpm test:e2e` 写出 `playwright-report/`。

## apps/web/src

```
apps/web/src/
├── App.vue         # 组合根
├── style/          # 全局样式
├── client/         # 网络、凭证、传输、本地目录偏好
├── components/
│   ├── layout/     # 壳层
│   └── ui/         # shadcn-vue 基础件
├── features/       # 领域模块
├── types/          # 公共类型：xxx-type.ts；三方类型：common-type.ts
├── router/
└── utils/
```

`App.vue`：`usePiClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再把 `connect` / `initialize` 交给启动门。子树只用 `useSession()` / `useNav()`，不写创建/发送/重命名等领域规则。

`apps/web/test/` 镜像 `src/` 分层。测 `src` 根文件的用例用相对路径。整页浏览器旅程不要放进本目录，写到仓库根 `e2e/`。

`types/`：被两条及以上路径依赖的类型，按业务写成 `xxx-type.ts`，消费写 `@/types/xxx-type.js`。三方依赖类型（如 `@earendil-works/*`）放 `types/common-type.ts` 再导出，消费写 `@/types/common-type.js`；运行时值仍从原包引入。模块或组件目录内多文件共用的类型放该目录 `type.ts`。只被一个文件使用的类型留在该文件。

### features/\<module\>/

```
index.vue        唯一视图入口
index.ts         provide / use（有跨树共享时才建）
type.ts          本目录多文件用的类型
components/      私有视图
hooks/           私有 composable
lib/             两处及以上生产消费的纯逻辑
```

1. 跨模块引用视图写 `index.vue`，引用组合写 `index.js`，不省略文件名。跨模块用 `@features/<module>/...`，模块内可用相对路径。
2. 模块级 `provide` / `use` 放根目录 `index.ts`，不进 `hooks/`。
3. 单点消费的函数放回对应 `.vue` / `hooks/`，不为测试单独抽文件。根目录不平铺 `*.ts`（`type.ts` 除外）。没有可复用逻辑时不建 `lib/`。
4. `lib/` 不按子领域再切。
5. 一个 feature 只做一件领域事。
6. `components/ui/` 只放 shadcn-vue 基础件，业务样式不回流到这里。新领域先归既有模块，边界不清再拆 feature。

## packages/gateway/src

```
packages/gateway/src/
├── cli.ts
├── index.ts        # 导出 Gateway、DirectoryPort
├── directory.ts    # 目录选择、canonicalizePath
├── auth/           # bootstrap 凭证
├── pi/             # Session 运行时、transcript、卡片
└── server/         # HTTP / WebSocket host
```

`test/` 跟 `src/` 同层。
