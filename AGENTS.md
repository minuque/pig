# AGENTS.md

## 约束

- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交。
- 注释默认不超过 1 行，单文件 <= 500 行。
- 导入能对上现有别名就写别名，不写相对路径。同目录引用可以保持 `./`。
- 已有依赖能正确表达就不自行设计实现组件和行为；优先复用成熟库，组件源代码可控，统一设计语言，严格限制重复依赖。
- 依赖缺陷不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。

## UI

- 基础件的样式来自 Radix Themes：`apps/web/src/style/rt.css` 引入它的 base 与 components，组件用 `rt-*` 类加 `data-*` 属性表达外观。改这些wrapper 前先读 `node_modules/@radix-ui/themes` 的对应源码，props 照它的 prop def 语义。
- 外观微调写 SFC 的 scoped 样式：scoped 选择器带 data 属性，特异性高于 rt 的 0-1-0，不需要 `!important`，也不受引入顺序影响。不要在模板里堆工具类压 rt。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- Tailwind 已移除。布局原子类与排版、颜色、圆角类在 `apps/web/src/style/components/`，类名沿用 shadcn 写法（`flex`、`items-center`、`gap-sm`、`text-body-md`、`rounded-md`），间距按 `--space-*` 命名而不是数字刻度。
- 弹层用 `<ThemeRoot>` 包住 teleport 内容：rt 的面板与阴影 token 挂在 `.radix-themes` 上，飞出文档流就取不到。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- 单测只覆盖数据路径（编排与状态转换）；整页浏览器旅程写在 `e2e/`。
- 故事（`*.stories.ts`）只用于手看设计与文档，不参与自动化；回归由 e2e 覆盖。

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
- 其余自动跑，不用记：UI 改动带映射的 e2e（`--no-e2e` 可关）、平台差异由 CI 覆盖。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
