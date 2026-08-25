# AGENTS.md

## 文档

- 新增或调整模块目录、领域边界前，阅读 [`docs/directory-structure.md`](docs/directory-structure.md)。
- 修改 UI、桌面壳、交互或视觉前，阅读 [`docs/ui-guidelines.md`](docs/ui-guidelines.md) 和 [`DESIGN.md`](DESIGN.md)。

## 约束

- 每一轮修改实施完成后，做一次原子git commit，方便回溯。
- 组件样式色走 `DESIGN.md` 对应 CSS 变量，色值只写在 `apps/web/src/style/app.css` 的 token 定义处。
- 单轮改动后运行 `pnpm check:touched`（只校验脏文件所属包）。
- 浏览器验收交给用户；除非用户明确要求，否则不启动调试服务器或CDP。
