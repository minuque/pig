# 代码库结构

pig 是 Pi Agent GUI：`apps/web` 与 `apps/desktop` 负责 UI，`packages/gateway` 负责平台接入与本地安全。Agent Loop / Session / Model Runtime 由 Pi 拥有。能力走 Pi Extension API，不在 pig 内置终端、浏览器与 Git。

下面是 pnpm workspace 的目录，逐个写清职责、边界与目录内的约定。

```
apps/web/              Vue 3 + TypeScript + Vite
apps/desktop/          Electron main / preload
packages/gateway/      Thin Host：平台接入与本地安全
packages/protocol/     gateway 与 web 之间的 WS 消息与 HTTP 数据形状，只有类型
packages/extensions/   pig 内置的 pi 扩展，只用公开 Extension API，只由 gateway 加载
packages/environment/  工具运行的环境：本机或 SSH；执行命令、读写文件、搜索、环境列表
e2e/                   浏览器 UI 旅程（Playwright，跨 Web 构建物与 Gateway）
scripts/               开发、构建、发版、架构看板与 check 入口
docs/                  设计、产品与代码库文档；架构看板的数据与生成结果
```

## apps/web

```
apps/web/src/
├── App.vue         # 主题与路由出口
├── assets/         # 字体等静态资源
├── style/          # 全局样式：app.css 是入口，tokens.css 定 token，components.css 是原子类
├── client/         # 网络、凭证、传输、本地目录偏好
├── components/
│   ├── icons/      # 图标：Lucide 注册表、语言与供应商标
│   ├── layout/     # 壳层
│   └── ui/         # 基础件：@ui-sdk/vue 的行为 + 自持外观
├── features/       # 领域模块
├── shell/          # 应用壳：启动门、布局与全局弹层的组合
├── i18n/           # 文案与语言切换
├── utils/          # 跟领域无关的小工具（storage、motion、theme-mode）
├── types/          # 公共类型：xxx-type.ts；三方类型：common-type.ts
└── router/
```

### 组合根与状态

`shell/WorkbenchShell.vue` 是组合根：`useGatewayClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再把 `connect` / `initialize` 交给启动门。子树只用 `useSession()` / `useNav()`，不写创建/发送/重命名等领域规则。

会话状态在 `features/session/`（连接、历史、乐观消息、后台发送），没有视图。`features/session` 不引用任何别的 feature，eslint 的 `no-restricted-imports` 守住这条；它要问输入卡「用户选了什么」时，由 composer 经 `setPresetPort` 注册进来。`features/session-workbench/` 只是主视图，除了 shell 和 router 没有模块引用它。

### style/

`app.css` 只做入口，按顺序引重置与各分片；`reset.css` 归零浏览器默认值（放在 `base` 层，不压库样式），`tokens.css` 放全局 token、深浅覆盖与 `data-tone` → `--tone-*` 的色调槽位（token 都挂在文档根上，顶层弹层不用另包容器）；组件外观写在各自 SFC 的 `data-*` 规则里，`desktop.css` 放桌面壳的拖拽与弹层规则，`markdown.css` 是助手正文（Comark 渲染）的排版，`mermaid.css` 把 pele 图的主题变量接到 token，`components.css` 是布局、排版、颜色与圆角的原子类加共用组件类，`globals.css` 放字体文件与文档基线（body 的底与字色、原生元素行为、焦点环默认、滚动条）。`globals.css` 不分层且排在最后：库的默认值比 `reset.css` 的 `base` 层优先，要靠它压住。

`components.css` 只保留全站共用的基础工具类（`truncate`、`select-none`、`sr-only`、`font-*`、`size-icon*`）、毛玻璃壳类（`surface-float`、`glass-backdrop`、`glass-panel`）以及菜单基础样式（`:where([data-menu-*])`），值只读 `tokens.css` 的 token；具体组件布局与间距直接写在各自 SFC 的 scoped 样式里，不再维护全套原子工具类。新增类名前先确认名字没有被任何 scoped 块当作业务类名用过。

### components/ui/

基础件共用的尺寸档类型在 `@/types/ui-type.js`：`Size` 是 s / m / l，菜单另用 `MenuSize` 的 s / m。基础件的 props 照 Radix Themes 的语义（`size`、`variant`、`color`、`highContrast`、`radius`），尺寸档只有 s / m / l 三档。`components/ui/` 只放基础件（@ui-sdk/vue 的行为 + 自持外观），业务样式不回流到这里。

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
6. 新领域先归既有模块，边界不清再拆 feature。

### types/

被两条及以上路径依赖的类型，按业务写成 `xxx-type.ts`，消费写 `@/types/xxx-type.js`。三方依赖类型（如 `@earendil-works/*`）与 `@pig/protocol` 的接口形状放 `types/common-type.ts` 再导出；接口形状只在 `@pig/protocol` 定义，web 与 gateway 不各写一份，消费写 `@/types/common-type.js`；运行时值仍从原包引入。`client/` 自己定义的连接与会话类型留在 `client/`，import 直接写 `@client/...`：反过来从 `types/` 转出就与 `client` 成环。模块或组件目录内多文件共用的类型放该目录 `type.ts`。只被一个文件使用的类型留在该文件。

### 单测

`apps/web/test/` 镜像 `src/` 分层：`test/components/ui/` 对 `src/components/ui/`，`test/features/<module>/` 对 `features/<module>/`，`test/style/` 对 `style/`。根级只放 `setup.ts`。测 `src` 根文件的用例用相对路径。整页浏览器旅程不要放进本目录，写到仓库根 `e2e/`。

## apps/desktop

```
apps/desktop/src/
├── main/           # 窗口、菜单与权限、协议注册、外链、目录选择；起 gateway 子进程与开发服务器
└── preload/        # sandbox 里的桥：窗口底色、自画窗控、桌面平台标记
```

主进程用 `utilityProcess` 在独立进程里跑 gateway，经 `parentPort` 与它通信（`gateway-child.ts` 与 `gateway-messages.ts` 是两端共用的消息形状）；`directory-port.ts` 让 gateway 拿到原生目录选择。页面从 `pig://app` 加载，`/api` 请求由主进程带启动凭证转给 gateway 的回环端口；WS 直连该端口，凭证由 `webRequest` 只对这一个端口注入。

## packages/gateway

```
packages/gateway/src/
├── cli.ts
├── index.ts        # 导出 Gateway、DirectoryPort
├── auth/           # 浏览器启动凭证与通行证
├── pi/             # Session 运行时、会话索引、transcript、卡片、远程会话
├── server/         # HTTP 与 WebSocket 协议端（@pig/protocol）
└── system/         # directory.ts：目录选择、canonicalizePath（含远程 workspace 键）；preferences.ts / session-archives.ts：preferences.json 与 session-archives.json 读写与外部热更新
```

`test/` 跟 `src/` 同层。运行配置走环境变量：`PORT`（默认 `8787`）、`OPEN=1`（启动后打开浏览器，等价 `--open`）、`PIG_SESSION_DIR`（会话目录，默认用 Pi 的）、`PIG_CWD`（初始工作目录）、`PIG_HOME`（跨设备文件根目录，默认 `~/.pig`，`preferences.json`、`session-archives.json` 等落在里面）。

`server/` 的 HTTP 端按 `@pig/protocol` 的契约表生成：`router.ts` 是声明式 `HttpRouter`，`platform.ts` / `providers.ts` / `fs-routes.ts` 只登记「方法 + 路径 → 处理函数」，参数与响应形状来自 `http.ts`；URL 里的 `:name` 解成契约声明的 `params`。

### Pi SDK 与扩展加载

gateway 在进程内跑 pi SDK。内置扩展经 `additionalExtensionPaths` 加载；gateway 不给扩展开私有接口。用户在 pi 里装的扩展（`settings.json` 的 `packages`、`~/.pi/agent/extensions`、项目 `.pi/extensions`）一律不加载，以后由设置页统一管理。本机与仓库设置里的 `packages` 对 pi 藏起，pig 不加载也不替用户安装任何包。本机与仓库目录里直接放的 skills、prompt 模板、AGENTS.md、MCP 配置照常共用；包里带的不加载。

SDK 跟版：

- 仓库锁 `@earendil-works/pi-coding-agent` 的精确版本。本机 pi 可以比它新。
- 兼容的底线是会话格式：两边的 `CURRENT_SESSION_VERSION` 一致。本机 pi 升级后，比一次两边的 `dist/core/session-manager.js` 与这个常量。
- 升级 SDK 先读 changelog，评估后再改锁版本。

## packages/protocol

`src/` 里按域分文件，全部只有类型：`wire.ts` 是 WebSocket 消息与命令，`http.ts` 是 `/api/v1/platform/*` 的方法 + 路径契约表，另有 `session.ts`、`transcript.ts`、`task.ts`、`provider.ts`、`model.ts`、`workspace.ts`、`extension-ui.ts` 放各域的数据形状。web 与 gateway 都从这里取形状，不各写一份；运行时代码一律不放，保持零产物。

## packages/extensions

`src/` 下五个内置扩展：`turn-timing`、`file-mentions`、`subagent`、`tasks`、`remote-workspace`。它们只用公开 Extension API，只由 gateway 加载，不注册到 pi TUI。新增扩展先确认公开 API 够用，不够就不要塞私有接口。

## packages/environment

编译型内部包：gateway 构建时用 `dist`；开发、测试经 `tsconfig.base.json` 的 paths 直接用源码；扩展经 pi 的 jiti 加载 `@pig/environment/source`。同一进程里的环境挂在 `globalThis` 上，gateway 与扩展共用一条 SSH 连接。

## 远程 workspace

跨 packages：agent 留在本机，工具经 SSH 转发到远端。

- workspace 键：本地是规范化路径，远程是 `ssh://主机/路径`。会话列表、侧栏、目录白名单都用这个键。
- 绑定：gateway 建远程会话时把 `pig.remote` 条目写进会话文件；会话 cwd 是 `~/.pig/remote/<主机>/<路径哈希>` 占位目录。
- 工具：`remote-workspace` 扩展读到绑定后替换 read / write / edit / bash，并注入远端 AGENTS.md、同步远端 skills。subagent 子会话继承父会话的绑定。
- 平台功能：文件搜索、选目录走 `@pig/environment`；非图片附件上传到远端 `/tmp/pig-attachments`。

## e2e

浏览器 UI 旅程在仓库根 `e2e/`（Playwright，跨 Web 构建物与 Gateway），不是 `apps/web/test/` 的模块单测。`pnpm test:e2e` 写出 `playwright-report/`。

按界面区域分目录：`startup/` 启动与错误页，`sidebar/` 侧栏与目录，`conversation/` 会话与回合，`composer/` 输入卡，`workbench/` 面板与分屏，`settings/` 设置页。共用的夹具与替身放 `support/`，桌面壳冒烟在 `electron/`，性能基准在 `perf/`。新用例放进它测的区域，并在 `scripts/check/scope.mjs` 登记源码前缀到用例的映射。

## scripts 与 docs

`scripts/` 放 `pnpm check` 与构建发版的入口：`check/` 是检查编排与脏路径映射（`scope.mjs`），`arch/` 是架构看板生成器，其余是开发、打包、发版与 worktree 准备脚本。

架构看板：`pnpm arch` 扫描源码生成 `docs/architecture/dist/index.html`（不提交），含总览、依赖分层地图、数据流与接口表。数据流手写在 `docs/architecture/flows.ts`，每步的 `ref` 指向真实代码，`pnpm check` 校验它们仍然存在。依赖的分层手写在 `docs/architecture/layers.ts`，新增模块没归层时 `pnpm arch` 报错。
