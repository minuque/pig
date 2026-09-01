# AGENTS.md

## 约束

- `docs/*` 只读，用户点名才改。
- 注释默认不超过 1 行。
- 单文件 <= 500 行，拆不开就写理由。
- 每轮改完做一次原子 commit；文档改动不 commit。
- 依赖缺陷升级或提交上游，不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 单测只覆盖 [`JOURNEYS.md`](JOURNEYS.md) 数据路径，每个分支一条；失败路径需点名。浏览器旅程在 `e2e/`。

## UI

- Vue SFC：`template` → `script` → `style`。
- 布局壳与 shadcn-vue 放 `src/components/`，领域 UI 放 `features/`，交互走 `@components/ui`。
- 增改 shadcn-vue：`pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`。装完对齐 `@utils/utils.js`、`lucide-vue-next`；已改 token 的包装不加 `--overwrite`。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token（`var(--*)` 或 `@theme` 类）。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- UI、桌面壳、交互、视觉：[`DESIGN.md`](DESIGN.md)

## 验收

- 单轮改动后跑 `pnpm check:touched`。
- 浏览器验收交给用户；不启动调试服务器或 CDP，除非用户要求。
