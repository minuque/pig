# AGENTS.md

## 约束

- `docs/*` 只读，用户点名才改。
- 注释默认不超过 1 行。
- 单文件 <= 500 行，拆不开就写理由。
- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交；文档改动不 commit。
- 依赖缺陷升级或提交上游，不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 单测只覆盖 [`JOURNEYS.md`](JOURNEYS.md) 数据路径，每个分支一条；失败路径需点名。浏览器旅程在 `e2e/`。

## 代码偏好

- 顶层函数之间、变量声明与函数之间空一行。
- Vue `<style>` 与 CSS：不同选择器族之间空一行；同一族（元素、伪类、伪元素、状态）不空行；`@media` / `@layer` 前空一行。

## UI

- Vue SFC：`template` → `script` → `style`。
- 修改已安装的 shadcn-vue 组件先读本地源码；新增或同步上游才用 CLI，参数先核对当前版本帮助。新增用 `pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`，禁用安装生命周期脚本，装完对齐 `@utils/utils.js`、`@lucide/vue`；已改 token 的包装不加 `--overwrite`。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token（`var(--*)` 或 `@theme` 类）。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- UI、桌面壳、交互、视觉：[`DESIGN.md`](DESIGN.md)

## 验收

- 一个逻辑任务改完后，对本会话改过的文件执行 `pnpm exec prettier --write <paths>`，再跑 `pnpm check:touched`；文档改动除外。检查失败后定向修复，输入未变时不重复检查。
- 浏览器验收交给用户；不启动调试服务器或 CDP，除非用户要求。
- Electron 验收用 `pnpm dev:desktop`（`--dev` 在主进程挂 CDP 9333）。不要直接跑 `electron.exe`：命令行 `--remote-debugging-port` 无效，且 `--dev` 依赖 pnpm 注入的 Node。已有 pig 窗口则复用，不要另起。
- 清理临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`（会误伤 `--device-scale-factor`）。
