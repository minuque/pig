# AGENTS.md

## 约束

- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交。
- 不写注释：`pig-comments/no-comments` 与 `pig/no-comments` 只放行五类（见 `/delete-comment`），存量在 `*-suppressions.json` 里只减不增。功能代码文件（`.ts`、`.vue`）不超过 500 行；样式表、i18n 文案不限。
- 导入能对上现有别名就写别名，不写相对路径。同目录引用可以保持 `./`。
- 已有依赖能表达就复用，不自写组件和行为；不引入功能重复的依赖。
- 依赖缺陷不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 单测只验证产品假设和数据路径（编排与状态转换），只测实现细节的不写；整页浏览器旅程写在 `e2e/`。

## UI

- 基础件自持外观：每个组件用平铺、最小的 `:where([data-slot=…])` 样式按 `docs/DESIGN.md` 的取值表达；颜色只来自 `tokens.css`，`color` 经 `data-tone` 映射到 `--tone-*` 槽位。
- 外观微调写 SFC 的 scoped 样式：scoped 选择器带 data 属性，特异性高于 `:where()` 的组件默认样式，不需要 `!important`。不要在模板里堆工具类。
- 组件样式只消费 `apps/web/src/style/tokens.css` 的 token。缺档先补 `tokens.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。
- 设计取值与规则见 [`docs/DESIGN.md`](docs/DESIGN.md)，改 UI 前读，守它的「规则」一节。

## 文档

- 代码库结构与领域边界：[`docs/CODEBASE.md`](docs/CODEBASE.md)
- 设计规则：[`docs/DESIGN.md`](docs/DESIGN.md)
- 产品定位与约束：[`docs/PRODUCT.md`](docs/PRODUCT.md)

## worktree

- 新建：`git worktree add ../<name> -b <branch>`，再在源仓库跑 `pnpm setup:worktree ../<name>`（装依赖 → 构建 gateway → 补 electron `path.txt` → 校验）。
- 跑 bench/e2e 时 cwd 必须是该 worktree，否则量的是源仓库。
- `apps/desktop/node_modules/.bin/pig` 缺失可忽略（desktop 与 bench 走 `@pig/gateway`），事后 `pnpm rebuild` 补不回来。

## 验收

- 代码改动必跑 `pnpm fix:touched` → `pnpm check:touched`，它会自动跑改动映射到的 e2e（`--no-e2e` 可关）；文档改动除外。
- 只修本次引入的失败；输入未变不重跑。
- 发版前必跑 `pnpm check:release`（唯一主动 build 的场景）。
- 主进程改动跑 `pnpm test:electron`；看画面用 `pnpm dev:desktop`（默认 CDP 9999，`PIG_CDP=0` 关）。
- 耗时、滚动、流式改动跑 `pnpm test:bench`。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
