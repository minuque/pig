# AGENTS.md

## 文档

- 新增或调整模块目录、领域边界前，阅读 [`docs/directory-structure.md`](docs/directory-structure.md)。
- 修改 UI、桌面壳、交互或视觉前，阅读 [`docs/ui-guidelines.md`](docs/ui-guidelines.md) 和 [`DESIGN.md`](DESIGN.md)。

## 约束

- docs/* 文档只读不可编辑。
- 代码注释保持简洁明了，不得超过1行。
- 单文件代码行数必须 <= 500，如果不能拆分告诉我理由。
- 依赖直接使用上游发布包；遇到依赖缺陷时升级或提交上游，禁止 `patchedDependencies`、`patch-package` 和本地 vendor 补丁。
- 每一轮修改实施完成后，做一次原子git commit(doc文档除外)。
- 组件样式色走 `DESIGN.md` 对应 CSS 变量，色值优先写在 `apps/web/src/style/app.css` 的 token 定义处。
- 单测只护 [`JOURNEYS.md`](JOURNEYS.md) 数据路径上的分支，每个分支一条。壳层、视觉和文案用 e2e 或目视。
- 单轮改动后运行 `pnpm check:touched`（只校验脏文件所属包）。
- 浏览器验收交给用户；除非用户明确要求，否则不启动调试服务器或CDP。
