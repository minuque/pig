# 侧栏会话导航

把左栏从「目录筛选 + 三行平铺」改成「整行操作 + 项目/更新时间分组 + 两行两列卡片」。对标 Waku 的扫读密度，不搬日期桶、组头折叠、命令面板、第三栏。

实施时以本文为清单，并同步改 `docs/ui-guidelines.md` 的信息架构 / Session / 顶栏。视觉 token 仍走 `DESIGN.md`。

## 不做

- 今天 / 昨天 / 本周 组头
- 组头折叠
- 顶部「按工作目录筛选」
- 命令面板式 Search
- 空闲态状态图标
- 非当前会话的 live phase
- 顶栏思考强度芯片
- 卡片 kebab
- git 分支、第三栏、rail 行为改动

## 信息架构

```text
New Task（整行）
Search（整行过滤输入）
分组切换 | 加目录
────────────────
[项目组头 + 该目录新建]     ← 仅项目分组
  会话卡片
  显示更多
────────────────
⚙
```

默认分组：更新时间。两种分组都按 `updatedAt ?? createdAt` 新→旧，改名不重排。无 cwd 的会话不进侧栏。

| 分组     | 结构                     | 默认条数 | 显示更多 |
| -------- | ------------------------ | -------- | -------- |
| 更新时间 | 无组头，单列表           | 10       | 每次 +10 |
| 项目     | 目录名组头，不可折叠     | 每组 5   | 每组 +5  |

搜索词非空：取消截断，组头仍在，不出现「显示更多」。清空后回到默认截断。Reveal 计数按分组键存在内存，切分组时清零；不持久化。分组模式写入 `localStorage` 键 `pig.sidebarGrouping`，值 `updated` \| `project`。

项目分组组顺序：本地授权目录在前（含 0 会话的空目录，便于组头新建），其余 Pi cwd 跟上。

## 操作

- **New Task**：有打开中的会话用它的 cwd，否则 `lastCwd`，再没有则回欢迎页。更新时间分组只走这一条全局入口。
- **项目组头新建**：只在该组 `canonicalPath` 建会话。
- **加目录**：与分组切换同一行右侧 FolderPlus。更新时间没有组头，不能把加目录绑在第一组头。无目录空态仍保留「添加本地目录」。
- **Search**：钉在列表上方，不随列表滚动。过滤标题与目录末段名，大小写不敏感。
- **卡片菜单**：右键、触控长按、Shift+F10。项：重命名、删除。删除仍 `confirm`。

## 卡片

两行两列。标题颜色保持现状（默认 `--ink-muted`，hover/选中 `--ink`，`caption`）。

更新时间分组：

```text
标题                    时钟 + 相对时间
📁 项目名               模型名 + VendorMark
```

项目分组：

```text
标题                    时钟 + 相对时间
N 条                    模型名 + VendorMark
```

当前打开且 `phase === "turn"`：右上改为现有 `Spinner`，隐藏时钟与相对时间。其它会话、其它 phase：只显示时钟时间。消息数仍走 `sessionCards` / live 覆盖，缺则该格留空不写「0 条」。

卡片高度约 52px 量级，虚拟列表按行类型给高度：组头、卡片、显示更多各一档。

## 顶栏

标题 + 淡 cwd。右上 ThemeToggle。不显示思考强度。phase / 连接仅非 idle。模型选择仍在输入卡。

## 列表模型

纯函数放 `apps/web/src/features/session-nav/sidebar.ts`。删掉筛选：`toggleProjectScope`、`pruneProjectScope`、`listSessionsForSidebar` 的 scope 参数。`workspaceScopeLabel` 若无引用则删。

```ts
export type SidebarGrouping = "updated" | "project"

export type SidebarRow =
  | { kind: "group"; key: string; canonicalPath: string; first: boolean }
  | { kind: "session"; key: string; session: SessionMetadata }
  | { kind: "more"; key: string; groupKey: string }

export const UPDATED_PAGE = 10
export const PROJECT_PAGE = 5

export function sortSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[]
export function sidebarRows(input: {
  grouping: SidebarGrouping
  sessions: readonly SessionMetadata[]
  groups: readonly SessionGroup[]
  revealByGroup: Readonly<Record<string, number>>
  searching: boolean
}): SidebarRow[]
export function bumpReveal(current: number | undefined, page: number): number
```

- `sortSessionsForSidebar`：`sessionRecency` 降序，同分 `id`。
- 更新时间的 `groupKey` 为 `"updated"`；项目组为 canonicalPath。
- `revealByGroup[key]` 表示已露出条数，缺省即 page size。
- `bumpReveal(undefined, 10)` → 20。
- `searching === true` 时每组输出全部 session 行，不产出 `more`。

`useWorkspaceNav` 不再暴露 `projectScope` / `toggleProjectScope` / `clearProjectScope`。改为：`grouping`、`setGrouping`、`rows`、`bumpGroup`、`searchQuery`（或由 `index.vue` 持有 search，传入 `searching`）。

## 文件

| 文件 | 改动 |
| ---- | ---- |
| `session-nav/sidebar.ts` | 排序、行模型、删筛选 |
| `session-nav/format.ts` | 删除无用的 scope 文案 |
| `session-nav/hooks/use-workspace-nav.ts` | 分组 / reveal；删 scope |
| `session-nav/index.ts` | 导出与 `listedSessions` 对齐 rows |
| `session-nav/index.vue` | 整行操作、分组 UI、组头、显示更多、虚拟列表混高 |
| `session-nav/components/SessionItem.vue` | 两行两列、Spinner、ContextMenu |
| `session-workbench/components/WorkbenchHeader.vue` | 去掉 thinking 芯片 |
| `apps/web/test/session-nav/session-list.test.ts` | 覆盖排序、两种分组截断、搜索不截断、bumpReveal |
| `apps/web/test/session-nav/use-workspace-nav.test.ts` | 删 scope 用例，改为 grouping / rows |
| `docs/ui-guidelines.md` | 信息架构、Session、顶栏 |

ContextMenu：`pnpm dlx shadcn-vue@latest add context-menu --cwd apps/web --yes`，装完对齐 lucide 与 `@utils/utils.js`，token 已改过的包装不要 `--overwrite`。

## 实施顺序

1. 列表纯函数 + 单测（不改 Vue）。
2. SessionItem 与顶栏可并行。
3. `index.vue` / hook 接上 1 的 API。
4. `pnpm check:touched`。

SFC 顺序按本仓库：`template` → `script` → `style`。色值只写 token。默认不加新测试文件，只扩展现有侧栏测试。
