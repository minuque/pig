# AGENTS.md

## 文档

- 新增或调整 feature 模块目录、领域边界前，阅读 [`docs/directory-structure.md`](docs/directory-structure.md)。
- 修改 Vue、UI、桌面壳、交互或视觉前，阅读 [`docs/ui-guidelines.md`](docs/ui-guidelines.md) 和 [`DESIGN.md`](DESIGN.md)。

## 约束

- 每一轮修改实施完成后，做一次原子git commit，方便回溯。
- 单轮改动后运行 `pnpm check:touched`（只校验脏文件所属包）。
- 跨包改动或提交前运行 `pnpm check`（全量并行，不短路）。
- UI 改完需要整页证据时运行 `pnpm test:e2e`，看 `e2e-report/latest/report.md`。不把浏览器旅程放进 `pnpm check`。
- 组件样式色走 `DESIGN.md` 对应 CSS 变量（`--primary`、`--on-primary` 等）。缺中间档用 `color-mix` 叠现有 token。色值只写在 `apps/web/src/style/app.css` 的 token 定义处。
