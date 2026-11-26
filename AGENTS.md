# AGENTS.md

## 约束

- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交。
- 不写注释：`pig-comments/no-comments` 与 `pig/no-comments` 只放行五类（见 `/delete-comment`），存量在 `*-suppressions.json` 里只减不增。功能代码文件（`.ts`、`.vue`）不超过 500 行；样式表、i18n 文案不限。
- 导入能对上现有别名就写别名，不写相对路径。同目录引用可以保持 `./`。
- 已有依赖能表达就复用，不自写组件和行为；不引入功能重复的依赖。
- 用 ui-sdk 前，装了 ui-sdk skill 就先按它走，并读 `node_modules/@ui-sdk/vue/docs/llms.txt`；新建组件时再按标题搜 `node_modules/@ui-sdk/vue/docs/core.md`，并读同目录的 `rendering.md`。
- 依赖缺陷不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 单测只验证产品假设和数据路径（编排与状态转换），只测实现细节的不写；整页浏览器旅程写在 `e2e/`。
- `e2e/` 只保留失败会破坏产品核心形态、本机资产持久化、多会话/外部协作或安全边界的端到端旅程；纯前端微交互、排版样式、控件细节、单测已覆盖的规则与历史 bug 像素级回归不进 `e2e/`；新增验证优先并入已有主干旅程，禁止拆出子集重复用例。
- 不写恒真断言（已删除的类名、路由、属性不存在），同一用例不重复断言同一事实；删功能时连同针对它的负断言一起删。

## 文档

- 代码库结构与领域边界：[`docs/CODEBASE.md`](docs/CODEBASE.md)
- 设计规则：[`docs/DESIGN.md`](docs/DESIGN.md)，改 UI 前读并遵守。只记偏好与规则，不抄 token 取值（以 design-lab `/design` 为准）；新规则须用户提出或确认，每条不超过两行，先合并已有条目。
- design-lab 业务场景只维护「整页」一个 demo（`features/design-lab/demos/FullPageDemo.vue`），新场景加进它的 fixture。
- 产品定位与约束：[`docs/PRODUCT.md`](docs/PRODUCT.md)

## worktree

- 新建：`git worktree add ../<name> -b <branch>`，再在源仓库跑 `pnpm setup:worktree ../<name>`（装依赖 → 构建 gateway → 补 electron `path.txt` → 校验）。
- 跑 bench/e2e 时 cwd 必须是该 worktree，否则量的是源仓库。
- `apps/desktop/node_modules/.bin/pig` 缺失可忽略（desktop 与 bench 走 `@pig/gateway`），事后 `pnpm rebuild` 补不回来。

## 验收

- 代码改动必跑 `pnpm fix:touched` → `pnpm check:touched`（只跑静态分析、类型检查与单测）；文档改动除外。运行时 E2E 在推送分支或提 PR 后由 CI 运行，需要本地复现时手动跑 `pnpm test:e2e`。
- 只修本次引入的失败；输入未变不重跑。
- 发版前必跑 `pnpm check:release`（唯一主动 build 的场景）。
- 主进程改动跑 `pnpm test:electron`；看画面用 `pnpm dev:desktop`（默认 CDP 9999，`PIG_CDP=0` 关）。
- 耗时、滚动、流式改动跑 `pnpm test:bench`。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
