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
├── stories/        # Storybook 故事与夹具，只用于手看设计
├── types/          # 公共类型：xxx-type.ts；三方类型：common-type.ts
└── router/
```

`App.vue`：`usePiClient` + `useLocalWorkspaces` → `provideSession(pi, cwd)` → `provideNav(pi, cwd, session)`，再把 `connect` / `initialize` 交给启动门。子树只用 `useSession()` / `useNav()`，不写创建/发送/重命名等领域规则。

`apps/web/test/` 镜像 `src/` 分层：`test/components/ui/` 对 `src/components/ui/`，`test/features/<module>/` 对 `features/<module>/`，`test/style/` 对 `style/`。根级只放 `setup.ts`。测 `src` 根文件的用例用相对路径。整页浏览器旅程不要放进本目录，写到仓库根 `e2e/`。

`style/`：`reset.css` 归零浏览器默认值，`palettes.css` 引 Radix 色板，`rt.css` 引 Radix Themes 的 base 与 components 并把间距圆角接到本项目刻度，`components.css` 汇总 `components/` 下的布局、排版、颜色类。

`components/ui/rt/`：Radix Themes 的接入层。`ThemeRoot.vue` 是 `.radix-themes` 作用域容器（弹层要在 teleport 里再包一层），`props.ts` 是 rt 的 prop → 类名引擎的精简版，`size.ts` 把对外的 s / m / l 映射到 rt 的 1 / 2 / 3。基础件的 props 照 rt 的语义（`size`、`variant`、`color`、`highContrast`、`radius`），尺寸档只有 s / m / l 三档。

`style/components/`：原子类的类名沿用 shadcn 与 Tailwind 的写法（`flex`、`items-center`、`truncate`、`w-full`、`text-body-md`、`rounded-md`），值只读 `app.css` 的 token。间距按 `--space-*` 命名（`gap-sm`、`p-md`）而不是数字刻度：项目已经把间距收进 `--space-*` 命名空间，再引入一套数字换算就是两套刻度并行。新增类名前先确认名字没有被任何 scoped 块当作业务类名用过。

`types/`：被两条及以上路径依赖的类型，按业务写成 `xxx-type.ts`，消费写 `@/types/xxx-type.js`。三方依赖类型（如 `@earendil-works/*`）放 `types/common-type.ts` 再导出，消费写 `@/types/common-type.js`；运行时值仍从原包引入。模块或组件目录内多文件共用的类型放该目录 `type.ts`。只被一个文件使用的类型留在该文件。

`stories/`：Storybook 的故事与夹具，只用于手看设计与文档，不参与自动化。`fixtures/` 放样本数据，`decorators.ts` 放主题、宽度、内存路由等共享装饰器，`WorkbenchStory.vue` / `WorkbenchChrome.vue` 是整页组合的壳与状态。

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
├── directory.ts    # 目录选择、canonicalizePath
├── auth/           # 浏览器启动凭证与通行证
├── pi/             # Session 运行时、transcript、卡片
└── server/         # HTTP / WebSocket host
```

`test/` 跟 `src/` 同层。
