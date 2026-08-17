# AGENTS.md

pig 是一个 local-first 的 Pi-first Web 与 Desktop GUI；

- 单轮改动后运行 `pnpm check:touched`（只校验脏文件所属包）。
- 跨包改动或提交前运行 `pnpm check`（全量并行，不短路）。

## 按需阅读

- 新增或调整 feature 模块目录、领域边界前，阅读 [`docs/directory-structure.md`](docs/directory-structure.md)。
- 修改 Vue、UI、桌面壳、交互或视觉前，阅读 [`docs/ui-guidelines.md`](docs/ui-guidelines.md) 和 [`DESIGN.md`](DESIGN.md)。
