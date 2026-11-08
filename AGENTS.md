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
- 弹层用 `<ThemeRoot>` 包住 teleport 内容：rt 的面板与阴影 token 挂在 `.radix-themes` 上，飞出文档流就取不到。
- 动画复用 `apps/web/src/style/motion.css` 的类与 `@keyframes`。缺档先补 `motion.css`，再写组件。

### 设计约束

完整规范见 [`apps/web/DESIGN.md`](apps/web/DESIGN.md)。改 UI 前先守住下面几条：

- 基调克制、安静、舒服。优先级：解决问题 > 易于使用 > 好看美观。
- 能用产品本身表达清楚的，不加说明文字。纯图标按钮的 tooltip 是它的名字；可见文字已写的内容，不再用 tooltip 重复。
- 一页只留一个强调色。品牌蓝 abyss 只用于主操作、选中态、焦点、链接；深色下文字类用法取第 11 级。一页只放一个 solid 主按钮。
- 状态色只在真有状态时出现，用第 11 级文字配第 3 级浅底，不实色填充。不加装饰色、渐变、光晕。
- 字号只用 `--text-meta`、`--text-body`、`--text-title`、`--text-heading` 四档，代码用 `--text-code`。一页最多 4 种字号，层级靠字重（400/500/600）和三级文字色。
- 文字色只有主、次、弱三级，一律用 `--contrast-foreground*`。
- 圆角只用 `--radius-control`、`--radius-card`、`--radius-dialog`、`--radius-pill`。嵌套圆角同心：内层 = 外层 − 内边距。
- 页面默认扁平：不叠阴影、不发光、不加毛玻璃。阴影只给真正浮起来的层：`--shadow-popover` 或 `--shadow-dialog`。
- 不卡片套卡片。卡片内分组用标题加分割线；分割线只用 1px `--border-soft`。卡片的描边和底色差只用一种。
- 按钮、间距、圆角、分割线、弹窗、动画、阴影全站一套规则，不为单个页面另起一档。

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
- 主进程改动跑 `pnpm test:electron`；看画面用 `pnpm dev:desktop`（默认 CDP 9999，`PIG_CDP=0` 关）。
- 耗时、滚动、流式改动跑 `pnpm test:bench`。
- 其余自动跑，不用记：UI 改动带映射的 e2e（`--no-e2e` 可关）、平台差异由 CI 覆盖。
- 清临时窗口按 PID 或 `user-data-dir`，不要匹配命令行 `--dev`。
