# AGENTS.md

## 约束

- docs/* 文档只读不可编辑，除非用户指定。
- 代码注释保持简洁明了，默认不得超过1行。
- 单文件代码行数必须 <= 500，如果不能拆分说明理由。
- 每一轮修改实施完成后，做一次原子git commit(doc文档除外)。
- 遇到依赖缺陷时升级或提交上游，禁止 `patchedDependencies`、`patch-package` 和本地 vendor 补丁。
- 单元测试只维护 `JOURNEYS.md` (JOURNEYS.md) 数据路径上的分支，每个分支一条。不写 DOM 测试，未点名失败路径不新增用例。

# UI

- Vue SFC 区块顺序：`template` → `script` → `style`。
- `src/components/` 只放布局壳与 shadcn-vue 基础组件。领域 UI 进 `features/`。交互走 `@components/ui`。
- 增改 shadcn-vue 基础件：`pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`。装完对齐 `@utils/utils.js`、`lucide-vue-next`；token 已改过的包装不要 `--overwrite`。
- 组件样式色走 [`DESIGN.md`](DESIGN.md) 对应 CSS 变量，色值优先写在 `apps/web/src/style/app.css` 的 token 定义处。

## 文档

- 新增或调整模块目录、领域边界前，阅读 [`docs/directory-structure.md`](docs/directory-structure.md)。
- 修改 UI、桌面壳、交互或视觉前，阅读 [`DESIGN.md`](DESIGN.md)。

## 验收

- 单轮改动后运行 `pnpm check:touched`（只校验脏文件所属包）。
- 浏览器验收交给用户；除非用户明确要求，否则不启动调试服务器或CDP。
