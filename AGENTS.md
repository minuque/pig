# AGENTS.md

## 约束

- `docs/*` 只读，用户点名才改。
- 注释默认不超过 1 行，单文件 <= 500 行。
- 导入能对上现有别名就写别名，不写相对路径。同目录引用可以保持 `./`。
- 一个逻辑任务完成并通过检查后做一次原子 commit，不按单次编辑提交；文档改动不 commit。
- 依赖缺陷升级或提交上游，不用 `patchedDependencies`、`patch-package`、本地 vendor 补丁。
- 合入、rebase、reset 前先看工作区。未提交路径和将写入的路径有交集：停下问用户，禁止 `restore`/`checkout` 清掉这些文件再合。合完用 `git status` 核同一批未提交路径还在、`git diff` 非空。备份只用 `git diff`/`git show` 写文件，不用 shell 重定向；apply 失败保留完整副本，禁止再 `restore` 覆盖。

## 文档

- 目录或领域边界：[`docs/directory-structure.md`](docs/directory-structure.md)
- 单测只覆盖 [`JOURNEYS.md`](JOURNEYS.md) 数据路径。

## UI

- 修改已安装的 shadcn-vue 组件先读本地源码；新增或同步上游才用 CLI，参数先核对当前版本帮助。新增用 `pnpm dlx shadcn-vue@latest add <name> --cwd apps/web --yes`，禁用安装生命周期脚本，装完对齐 `@utils/utils.js`，并把 CLI 生成的 `@lucide/vue` 图标换成 `@components/icons` 注册表里的 Solar 图标（CLI 的 `iconLibrary` 还不支持 Solar）；已改 token 的包装不加 `--overwrite`。
- 组件样式只消费 `apps/web/src/style/app.css` 的 token（`var(--*)` 或 `@theme` 类）。缺档先补 `app.css`，再写组件；SFC 不声明 `--*`，不写裸 hex/rgb/`color-mix`。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

## worktree

- 新建：`git worktree add ../<name> -b <branch>`，再在源仓库跑 `pnpm setup:worktree ../<name>`（装依赖 → 构建 gateway → 补 electron `path.txt` → 校验）。
- 跑 bench/e2e 时 cwd 必须是该 worktree，否则量的是源仓库。
- `apps/desktop/node_modules/.bin/pig` 缺失可忽略（desktop 与 bench 走 `@pig/gateway`），事后 `pnpm rebuild` 补不回来。

## 验收

- 改完后跑 `pnpm fix:touched`，再跑 `pnpm check:touched`。文档除外。失败只修本次引入的；输入未变不重跑。
- 场景补跑：UI 旅程 `pnpm test:e2e e2e/<spec>`；滚动、流式、耗时 `pnpm test:bench`；Electron `pnpm dev:desktop`（`--dev` 默认 CDP 9333，`PIG_CDP` 可改，`0`/`off` 关；已有窗口则复用）。
- 根配置改动时 `check:touched` 升级为 `pnpm check`。不主动跑 `pnpm build`、全量 `pnpm test` 或全量 `pnpm test:e2e`。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。

## 调试与视觉验收

- 视觉改动带像素证据：改颜色、对比度、透明度、玻璃，报告给同一测点的改前改后像素值（前景与背景都测），不只说「调亮了」。
- 合成效果断言「真生效」：毛玻璃、模糊、阴影改完，开/关该属性各截一次，卡区像素差超过阈值才算生效，计算样式正常不算。
- 性能诉求先量化：卡顿、抖动、闪烁先用 `pnpm test:bench` 拿指标，改前改后同场景对比，不接受「感觉顺了」。
- 验收命令合并跑：一轮改动只在定稿时跑一次 `pnpm fix:touched` 加 `pnpm check:touched`；样式迭代期间走 HMR 加像素复验。
- 玻璃先锁定改哪一层：动玻璃与透明度前先写明这次动的是「卡片底 / 浮层底 / 模糊参数」哪一层，附对照图，不顺手翻整套 token。
- 反馈先转测点：收到 `## Page Annotation` 或剪贴板截图，先转成「选择器 + 视口 + 期望值」再动手；对照图存 `e2e/visual/`，不用 `%TEMP%` 路径当基线。
- 分通道分工：性能、控制台、网络走 chrome-devtools；元素级视觉对照走无头浏览器（headless 加 Playwright 自带 Chromium，版本贴近壳）；合成层、新 CSS 特性、DPR 的结论在桌面壳复验（`--cdp 9333`）。
