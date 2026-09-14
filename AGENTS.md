# AGENTS.md

## 约束

- `docs/*` 只读，用户点名才改。
- 注释默认不超过 1 行。
- 单文件 <= 500 行，拆不开就写理由。
- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交；文档改动不 commit。
- 依赖缺陷升级或提交上游，不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 单测只覆盖 [`JOURNEYS.md`](JOURNEYS.md) 数据路径，每个分支一条；失败路径需点名。浏览器旅程在 `e2e/`。

## UI

- Vue SFC：`template` → `script` → `style`。
- 修改已安装的 shadcn-vue 组件先读本地源码；新增或同步上游才用 CLI，参数先核对当前版本帮助。新增用 `pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`，禁用安装生命周期脚本，装完对齐 `@utils/utils.js`、`@lucide/vue`；已改 token 的包装不加 `--overwrite`。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token（`var(--*)` 或 `@theme` 类）。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- UI、桌面壳、交互、视觉：[`DESIGN.md`](DESIGN.md)

## 验收

- 改完后跑 `pnpm fix:touched`，再跑 `pnpm check:touched`。文档除外。失败只修本次引入的；输入未变不重跑。
- 场景补跑：UI 旅程 `pnpm test:e2e e2e/<spec>`；滚动、流式、耗时 `pnpm test:bench`；Electron `pnpm dev:desktop`（主进程 CDP 9333；已有窗口则复用）。
- 根配置改动时 `check:touched` 升级为 `pnpm check`。不主动跑 `pnpm build`、全量 `pnpm test` 或全量 `pnpm test:e2e`。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
