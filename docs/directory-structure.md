# 目录结构

pig 是 Pi Agent GUI：`apps/web` 与 `apps/desktop` 负责 UI，`packages/gateway` 负责平台接入与本地安全。Agent Loop / Session / Model Runtime 由 Pi 拥有。能力走 Pi Extension API，不在 pig 内置 Git、终端、浏览器。

pnpm workspace：

- `apps/web/` — Vue 3 + TypeScript + Vite
- `apps/desktop/` — Electron main / preload
- `packages/gateway/` — Thin Host：平台接入与本地安全
- `packages/protocol/` — gateway 与 web 之间的 WebSocket 协议，只有类型
- `packages/extensions/` — pig 内置的 pi 包（subagent、remote-workspace），只用公开 Extension API，pi TUI 里也能装
- `packages/environment/` — 工具运行的环境：本机或 SSH 主机；执行命令、读写文件、搜索、环境列表

浏览器 UI 旅程在仓库根 `e2e/`（Playwright，跨 Web 构建物与 Gateway），不是 `apps/web/test/` 的模块单测。`pnpm test:e2e` 写出 `playwright-report/`。

## apps/web/src

```
apps/web/src/
├── App.vue         # 组合根
├── assets/         # 字体等静态资源
├── style/          # 全局样式：app.css 定 token，components.css 汇总组件层
├── client/         # 网络、凭证、传输、本地目录偏好
├── components/
│   ├── layout/     # 壳层
│   └── ui/         # 基础件：Reka 的行为 + Radix Themes 的外观
├── features/       # 领域模块
├── shell/          # 应用壳：启动门、布局与全局弹层的组合
├── i18n/           # 文案与语言切换
├── utils/          # 跟领域无关的小工具（storage、motion）
├── types/          # 公共类型：xxx-type.ts；三方类型：common-type.ts
└── router/
```

`App.vue`：`usePiClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再把 `connect` / `initialize` 交给启动门。子树只用 `useSession()` / `useNav()`，不写创建/发送/重命名等领域规则。

`apps/web/test/` 镜像 `src/` 分层：`test/components/ui/` 对 `src/components/ui/`，`test/features/<module>/` 对 `features/<module>/`，`test/style/` 对 `style/`。根级只放 `setup.ts`。测 `src` 根文件的用例用相对路径。整页浏览器旅程不要放进本目录，写到仓库根 `e2e/`。

`style/`：`app.css` 是入口，按顺序引重置、Radix 色板与各分片；`reset.css` 归零浏览器默认值（放在 `base` 层，不压库样式），`tokens.css` 放全局 token 与深浅覆盖，`rt.css` 引 Radix Themes 的 base 与 components 并把间距圆角接到本项目刻度，`desktop.css` 放桌面壳的拖拽与弹层规则，`markdown.css` 是助手正文（Comark 渲染）的排版，`mermaid.css` 把 pele 图的主题变量接到 token，`components.css` 是布局、排版、颜色与圆角的原子类。

`components/ui/rt/`：Radix Themes 的接入层。`ThemeRoot.vue` 是 `.radix-themes` 作用域容器（弹层要在 teleport 里再包一层），`props.ts` 是 rt 的 prop → 类名引擎的精简版，`size.ts` 把对外的 s / m / l 映射到 rt 的 1 / 2 / 3。基础件的 props 照 rt 的语义（`size`、`variant`、`color`、`highContrast`、`radius`），尺寸档只有 s / m / l 三档。

`style/components.css`：原子类的类名沿用 shadcn 与 Tailwind 的写法（`flex`、`items-center`、`truncate`、`w-full`、`text-body-md`、`rounded-md`），值只读 `app.css` 的 token。间距按 `--space-*` 命名（`gap-sm`、`p-md`）而不是数字刻度：项目已经把间距收进 `--space-*` 命名空间，再引入一套数字换算就是两套刻度并行。新增类名前先确认名字没有被任何 scoped 块当作业务类名用过。

`types/`：被两条及以上路径依赖的类型，按业务写成 `xxx-type.ts`，消费写 `@/types/xxx-type.js`。三方依赖类型（如 `@earendil-works/*`）放 `types/common-type.ts` 再导出，消费写 `@/types/common-type.js`；运行时值仍从原包引入。模块或组件目录内多文件共用的类型放该目录 `type.ts`。只被一个文件使用的类型留在该文件。

### features/\<module\>/

```
index.vue        唯一视图入口
index.ts         provide / use（有跨树共享时才建）
type.ts          本目录多文件用的类型
components/      私有视图
hooks/           私有 composable
lib/             多处生产消费，或有单测的纯逻辑
```

1. 跨模块引用视图写 `index.vue`，引用组合写 `index.js`，不省略文件名。跨模块用 `@features/<module>/...`，模块内可用相对路径。
2. 模块级 `provide` / `use` 放根目录 `index.ts`，不进 `hooks/`。
3. 单点消费、且没有单测的函数放回对应 `.vue` / `hooks/`。有单测的纯函数可以留在 `lib/`，即使只有一处生产消费。根目录不平铺 `*.ts`（`type.ts` 除外）。没有可复用逻辑时不建 `lib/`。
4. `lib/` 不按子领域再切。
5. 一个 feature 只做一件领域事。
6. `components/ui/` 只放基础件（Reka 的行为 + Radix Themes 的外观），业务样式不回流到这里。新领域先归既有模块，边界不清再拆 feature。

## packages/gateway/src

```
packages/gateway/src/
├── cli.ts
├── index.ts        # 导出 Gateway、DirectoryPort
├── directory.ts    # 目录选择、canonicalizePath（含远程 workspace 键）
├── auth/           # 浏览器启动凭证与通行证
├── pi/             # Session 运行时、会话索引、transcript、卡片、远程会话
└── server/         # HTTP 与 WebSocket 协议端（@pig/protocol）
```

`test/` 跟 `src/` 同层。

gateway 在进程内跑 pi SDK。内置扩展经 `additionalExtensionPaths` 加载，和用户装的扩展走同一条路；gateway 不给扩展开私有接口。

## 远程 workspace

agent 留在本机，工具经 SSH 转发到远端。

- workspace 键：本地是规范化路径，远程是 `ssh://主机/路径`。会话列表、侧栏、目录白名单都用这个键。
- 绑定：gateway 建远程会话时把 `pig.remote` 条目写进会话文件；会话 cwd 是 `~/.pig/remote/<主机>/<路径哈希>` 占位目录。
- 工具：`remote-workspace` 扩展读到绑定后替换 read / write / edit / bash，并注入远端 AGENTS.md、同步远端 skills。subagent 子会话继承父会话的绑定。
- 平台功能：文件搜索、选目录走 `@pig/environment`；非图片附件上传到远端 `/tmp/pig-attachments`。

## packages/environment

编译型内部包：gateway 构建时用 `dist`；开发、测试经 `tsconfig.base.json` 的 paths 直接用源码；扩展经 pi 的 jiti 加载 `@pig/environment/source`。同一进程里的环境挂在 `globalThis` 上，gateway 与扩展共用一条 SSH 连接。
