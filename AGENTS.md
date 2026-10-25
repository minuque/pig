# AGENTS.md

## 约束

- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交。
- 注释默认不超过 1 行，单文件 <= 500 行。
- 导入能对上现有别名就写别名，不写相对路径。同目录引用可以保持 `./`。
- 已有依赖能正确表达就不自行设计实现组件和行为；优先复用成熟库，组件源代码可控，统一设计语言，严格限制重复依赖。
- 依赖缺陷不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。

## UI

- 修改已安装的 shadcn-vue 组件先读本地源码；新增或同步上游才用 CLI，参数先核对当前版本帮助。新增用 `pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`，禁用安装生命周期脚本，装完对齐 `@utils/utils.js`，并把 CLI 生成的 `@lucide/vue` 图标换成 `@components/icons` 注册表里的 Solar 图标（CLI 的 `iconLibrary` 还不支持 Solar）；已改 token 的包装不加 `--overwrite`。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token（`var(--*)` 或 `@theme` 类）。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- 单测只覆盖数据路径（编排与状态转换）；整页浏览器旅程写在 `e2e/`。

## worktree

- 新建：`git worktree add ../<name> -b <branch>`，再在源仓库跑 `pnpm setup:worktree ../<name>`（装依赖 → 构建 gateway → 补 electron `path.txt` → 校验）。
- 跑 bench/e2e 时 cwd 必须是该 worktree，否则量的是源仓库。
- `apps/desktop/node_modules/.bin/pig` 缺失可忽略（desktop 与 bench 走 `@pig/gateway`），事后 `pnpm rebuild` 补不回来。

## 验收

- 代码改动必跑 `pnpm fix:touched` → `pnpm check:touched`；文档改动除外。
- 只修本次引入的失败；输入未变不重跑。
- 发版前必跑 `pnpm check:release`（唯一主动 build 的场景）。
- 像素基线只在 Windows 比对（`-chromium-win32`）；mac/linux 重写的基线不要提交。
- 主进程改动跑 `pnpm test:electron`；看画面用 `pnpm dev:desktop`（默认 CDP 9999，`PIG_CDP=0` 关）。
- 耗时、滚动、流式改动跑 `pnpm test:bench`。
- 其余自动跑，不用记：UI 改动带映射的 e2e（`--no-e2e` 可关）、改 `components/ui` 或故事带 `test:stories`、平台差异由 CI 覆盖。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
